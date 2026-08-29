# Communication Client ⇄ Serveur, Synchronisation & WebSocket
### Explication détaillée — comment les trois mécanismes s'articulent

---

## 1. Les deux canaux de communication, et pourquoi

L'application utilise **deux canaux réseau complémentaires**, jamais un seul :

| Canal | Protocole | Rôle | Qui l'initie |
|---|---|---|---|
| **REST / HTTPS** | HTTP sur TLS, port 5030 | Lire/écrire une ressource précise, de façon garantie (requête → réponse) | Le client, à la demande |
| **WebSocket** | `wss://`, même port 5030 (upgrade HTTP) | Recevoir les changements **en temps réel**, sans avoir à redemander | Le serveur, en continu |

Le REST sert à **agir** (créer un patient, enregistrer une consultation, tirer un rattrapage de données).
Le WebSocket sert à **être informé** (un autre poste vient de modifier un dossier, un résultat de labo est
arrivé, le module IA a terminé une analyse). Aucun des deux ne remplace l'autre : le REST garantit la
livraison d'une action précise, le WebSocket ne garantit rien en cas de coupure (voir section 5) — c'est
pour ça qu'on garde toujours une synchronisation REST en filet de sécurité, même avec le WebSocket actif.

---

## 2. Le chemin complet d'une requête, du clic à la base de données

```
┌───────────────────────────── Poste client (Electron) ─────────────────────────────┐
│                                                                                      │
│  Renderer (React)                                                                   │
│      │  fetch/axios → http://127.0.0.1:5031/api/local/...                           │
│      ▼                                                                              │
│  API locale (Fastify, processus main)                                               │
│      │                                                                              │
│      ├─ LECTURE ──► SQLite locale (réponse immédiate, aucun réseau)                 │
│      │                                                                              │
│      └─ ÉCRITURE ─► 1) écrit dans SQLite locale (optimiste, l'UI se met à jour)      │
│                      2) ajoute l'opération dans la table "outbox"                    │
│                      3) tente l'envoi immédiat si en ligne (sinon retry plus tard)   │
│                              │                                                       │
└──────────────────────────────┼───────────────────────────────────────────────────────┘
                                │  HTTPS (Bearer JWT)
                                ▼
                    Nginx (serveur central, port 5030 — TLS + reverse proxy)
                                │
                                ▼
                    Microservice Fastify concerné (ex. fhir-service)
                                │
                                ▼
                          PostgreSQL (source de vérité)
                                │
                                ▼
        Publication d'un événement "resource.updated" sur Redis (pub/sub ou Streams)
                                │
                                ▼
                    realtime-gateway → diffusion WebSocket vers les postes concernés
```

Le renderer **ne parle jamais directement** au serveur central : toujours via l'API locale. C'est ce détour
qui permet la lecture instantanée, l'écriture optimiste, et le fonctionnement en cas de coupure réseau
temporaire.

---

## 3. Authentification et session

### 3.1 Connexion (login)

```
Renderer → API locale → (si en ligne) POST https://<serveur>:5030/api/auth/login
                                             { email, password }
                         ← { accessToken (JWT, 15-30 min), refreshToken (7-30 jours) }
```

- Le `refreshToken` est stocké via **`keytar`** (trousseau système, jamais en clair sur disque).
- L'`accessToken` est gardé en mémoire dans le processus main, réutilisé pour chaque requête REST
  (`Authorization: Bearer <token>`) et pour l'authentification WebSocket (section 5.2).
- **Un premier login exige d'être en ligne** — c'est la seule opération qui ne peut pas fonctionner en mode
  local pur, ce qui est normal et attendu (on ne peut pas vérifier un mot de passe sans la base des
  utilisateurs).

### 3.2 Renouvellement du token

```ts
// client/src/main/auth/token-manager.ts
async function ensureFreshToken() {
  if (isExpiringSoon(accessToken)) {
    const { accessToken: newToken } = await axios.post(`${serverUrl}/api/auth/refresh`, {
      refreshToken: await keytar.getPassword("sih", "refreshToken"),
    }).then(r => r.data);
    accessToken = newToken;
  }
  return accessToken;
}
```

Appelé automatiquement avant chaque requête REST et avant chaque tentative de connexion WebSocket.

---

## 4. Communication REST — détail des règles

### 4.1 Lecture (`GET`)

L'API locale répond **toujours depuis SQLite**, jamais en attendant une réponse du serveur central. La
fraîcheur des données est assurée séparément par la synchronisation (section 5), pas par la requête de
lecture elle-même. C'est ce qui rend l'interface instantanée.

### 4.2 Écriture (`POST` / `PUT` / `PATCH`)

Chaque écriture suit ce protocole :

1. **Écriture optimiste locale** : la donnée est enregistrée immédiatement dans SQLite avec un statut
   `pending-sync`, l'UI se met à jour tout de suite.
2. **Mise en file (outbox)** : l'opération est ajoutée à la table `outbox` avec un **identifiant unique
   généré côté client** (`clientMutationId`, un UUID).
3. **Tentative d'envoi immédiate** si le client est en ligne.
4. **Idempotence côté serveur** : chaque microservice vérifie `clientMutationId` avant d'insérer — si la
   même mutation arrive deux fois (ex. requête retransmise après un timeout réseau alors qu'elle avait en
   fait réussi), le serveur renvoie la ressource existante au lieu de la dupliquer.

```ts
// server/fhir-service/src/routes/patient.route.ts (extrait — idempotence)
app.post("/api/fhir/Patient", async (request, reply) => {
  const { clientMutationId, ...resource } = request.body as any;

  const existing = await db.query(
    "SELECT content FROM fhir_resources WHERE client_mutation_id = $1", [clientMutationId]
  );
  if (existing.rows[0]) return reply.send(JSON.parse(existing.rows[0].content)); // déjà traité

  const saved = await savePatient(resource, clientMutationId);
  await publishEvent("resource.updated", { resourceType: "Patient", resourceId: saved.id, resource: saved });
  return reply.code(201).send(saved);
});
```

### 4.3 Gestion des échecs

| Situation | Comportement |
|---|---|
| Pas de réseau | La mutation reste `pending` dans l'outbox, retentée automatiquement (voir 5.3) |
| Timeout serveur | Retentée avec le même `clientMutationId` (sûr grâce à l'idempotence) |
| Conflit de version (`409`) | Marquée `failed`, notification affichée à l'utilisateur pour arbitrage manuel |
| Erreur de validation (`400`) | Marquée `failed` définitivement, message d'erreur affiché immédiatement |

---

## 5. Synchronisation — détail du protocole

La synchronisation a **trois mouvements distincts**, qui se complètent :

### 5.1 Synchronisation descendante initiale (bootstrap)

Au tout premier appairage d'un poste, on ne rapatrie **pas tout l'historique** — ce serait lent et inutile.
Le serveur applique un **périmètre de synchronisation** adapté au rôle du poste :

| Rôle du poste | Périmètre synchronisé |
|---|---|
| Accueil | Patients actifs, rendez-vous du jour/semaine |
| Médecin | Patients de son service, consultations en cours et récentes (ex. 90 derniers jours) |
| Pharmacie | Prescriptions actives, catalogue médicaments, niveaux de stock |
| Laboratoire | Demandes d'examens en attente et récentes |

```ts
// server/fhir-service/src/routes/sync-bootstrap.route.ts
app.get("/api/sync/bootstrap", async (request) => {
  const { role } = request.user; // injecté par le plugin JWT
  const scope = SYNC_SCOPES[role]; // ex: { resourceTypes: ["Patient","Encounter"], sinceDays: 90 }
  return buildBootstrapPayload(scope);
});
```

### 5.2 Synchronisation descendante incrémentale (delta)

Une fois le bootstrap fait, toutes les synchronisations suivantes ne demandent **que ce qui a changé**,
grâce au paramètre FHIR natif `_lastUpdated` :

```
GET /api/fhir/Observation?_lastUpdated=gt2026-08-27T10:00:00Z
```

Déclenchée : au démarrage de l'application, toutes les 5 minutes en filet de sécurité, et **immédiatement
après une reconnexion WebSocket** (point essentiel expliqué en section 6.5).

### 5.3 Synchronisation montante (outbox → serveur)

```
┌──────────────┐   flushOutbox()    ┌──────────────┐
│   outbox      │ ────────────────► │   Serveur     │
│  (SQLite)     │ ◄──────────────── │  (idempotent) │
│  status:      │   ressource       └──────────────┘
│  pending      │   confirmée
│  → sent       │   (ou 409/400)
└──────────────┘
```

`flushOutbox()` est rejouée toutes les 10 secondes tant qu'il reste des éléments `pending`, et
immédiatement dès qu'une connexion WebSocket réussit (signal fiable "on est en ligne").

### 5.4 Gestion des conflits (versioning)

Chaque ressource FHIR porte `meta.versionId` et `meta.lastUpdated`. Le client envoie la version qu'il
connaissait au moment de la modification (`If-Match`) ; si le serveur constate qu'elle a changé entre-temps
(un autre poste a modifié la même ressource), il refuse avec `409 Conflict` et renvoie la version actuelle.
Le client ne tente jamais d'écraser silencieusement — il affiche un écran d'arbitrage, essentiel en contexte
médical.

---

## 6. WebSocket — fonctionnement détaillé

### 6.1 Établissement de la connexion

```
Client                          Nginx (:5030, TLS)              realtime-gateway (interne)
  │  wss://serveur:5030/ws         │                                    │
  │ ───────────────────────────►   │  upgrade proxifié en clair (LAN)   │
  │                                 │ ──────────────────────────────►   │
  │                                 │                                    │  connexion acceptée,
  │                                 │                                    │  état = "non authentifié"
  │ ◄─── connexion ouverte ──────────────────────────────────────────── │
```

Nginx termine le TLS (le trafic n'est en clair qu'à l'intérieur de la machine serveur, jamais sur le
réseau) et transmet la connexion en interne au `realtime-gateway`.

### 6.2 Authentification de la connexion — juste après l'ouverture, pas dans l'URL

**Recommandation importante** : ne pas mettre le token JWT dans l'URL (`?token=...`), car les URL peuvent
finir dans des logs de proxy. On envoie le token dans le **premier message applicatif** :

```ts
// client — juste après l'ouverture du socket
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "auth", token: accessToken }));
};
```

```ts
// server/realtime-gateway/src/ws/connection-handler.ts
connection.socket.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());

  if (!authenticated) {
    if (msg.type !== "auth") return connection.socket.close(4401, "auth requise");
    try {
      const payload = app.jwt.verify(msg.token);
      authenticated = true;
      userId = payload.sub;
      role = payload.role;
      const channels = resolveChannelsForUser(userId, role, siteId);
      subscribeToChannels(connection.socket, channels);
      connection.socket.send(JSON.stringify({ type: "auth.ok", channels }));
    } catch {
      connection.socket.close(4401, "token invalide");
    }
    return;
  }
  // ... traitement des messages applicatifs suivants
});

// Timeout : si aucun message "auth" dans les 5 secondes, on ferme
setTimeout(() => { if (!authenticated) connection.socket.close(4401, "timeout auth"); }, 5000);
```

Le client **ne choisit jamais lui-même** ses canaux : c'est le serveur qui les détermine à partir du rôle
et du site de l'utilisateur authentifié (`resolveChannelsForUser`). Ça évite qu'un poste écoute des canaux
auxquels il n'a pas droit.

### 6.3 Taxonomie des canaux

| Canal | Portée | Exemple d'usage |
|---|---|---|
| `user:<userId>` | Personnel | "Votre patient a un nouveau résultat" |
| `role:<role>` | Tous les utilisateurs d'un rôle | "Nouveau résultat critique" poussé à tous les médecins de garde |
| `site:<siteId>` | Tout le centre de santé | Annonce générale, alerte système |
| `resource:<type>` | Abonnement à un type de ressource pour la synchro cache | Invalidation de cache ciblée |

### 6.4 Format des messages (enveloppe commune)

```ts
// shared/types/src/events.ts
export interface RealtimeMessage<T = unknown> {
  id: string;            // UUID, sert à dédupliquer côté client si le message arrive deux fois
  type: string;           // "resource.updated" | "notification.new" | "ml.result_ready" | ...
  channel: string;
  payload: T;
  timestamp: string;      // ISO 8601
}
```

**Poids du payload** : pour les ressources petites et fréquentes (`Observation`, `Notification`), on inclut
directement une version compacte de la ressource dans le message — évite un aller-retour REST supplémentaire.
Pour les ressources volumineuses (`DocumentReference`, `ImagingStudy`), on n'envoie **qu'une référence**
(`resourceType` + `resourceId`) ; le client va la chercher via l'API locale (qui elle-même ira la chercher au
serveur si absente du cache) uniquement s'il en a besoin à l'écran. Cette distinction évite de saturer le
réseau local avec de gros payloads que personne ne regarde forcément tout de suite.

### 6.5 Heartbeat et détection de coupure

Un ping applicatif toutes les 25 secondes (plus court que le timeout par défaut de Nginx sur les connexions
inactives) :

```ts
// server — realtime-gateway
setInterval(() => {
  for (const socket of allConnectedSockets) {
    if (socket.isAlive === false) return socket.terminate(); // n'a pas répondu au dernier ping
    socket.isAlive = false;
    socket.ping();
  }
}, 25_000);

socket.on("pong", () => { socket.isAlive = true; });
```

### 6.6 Reconnexion — et son lien avec la synchronisation

C'est le point le plus important à bien comprendre : **le WebSocket ne rattrape jamais tout seul les
événements manqués pendant une coupure**. Ce n'est pas une file d'attente persistante par client — si le
poste est déconnecté 10 minutes, les événements publiés pendant ces 10 minutes ne lui sont pas rejoués
automatiquement à la reconnexion.

C'est pour ça que **la reconnexion WebSocket déclenche systématiquement un `pullDeltas()`** :

```ts
// client/src/main/sync/realtime-sync.ts
function connectWebSocket() {
  const ws = new WebSocket(`wss://${serverHost}:5030/ws`);

  ws.onopen = () => authenticate(ws);

  ws.on("message", handleIncomingMessage);

  ws.onclose = () => {
    scheduleReconnect(); // backoff exponentiel : 1s, 2s, 4s, 8s, 16s, plafonné à 30s + jitter
  };
}

async function onAuthenticated() {
  await pullDeltas(serverBaseUrl, accessToken); // rattrape tout ce qui a été manqué pendant la coupure
  flushOutbox(serverBaseUrl, accessToken);       // envoie les écritures locales en attente
}
```

Le WebSocket gère le **temps réel pendant qu'on est connecté** ; le `pullDeltas()` (basé sur
`_lastUpdated`, section 5.2) gère le **rattrapage après une coupure**. Les deux mécanismes se complètent :
aucun des deux ne suffit seul.

### 6.7 Diffusion interne (fan-out) — comment un microservice pousse un événement

```
fhir-service (écrit en base)
      │
      ▼
Redis Streams : XADD events * type resource.updated resourceType Observation resourceId obs-123 ...
      │
      ▼
realtime-gateway (consumer group, lecture continue du stream)
      │
      ▼
Pour chaque socket abonné au bon canal → envoi du message JSON
```

**Redis Streams plutôt que du pub/sub Redis classique** : le pub/sub perd les messages si personne n'écoute
au moment de la publication (pas de rejouabilité). Les Streams conservent un historique court et permettent
au `realtime-gateway` de reprendre exactement où il s'est arrêté s'il redémarre — utile pour la fiabilité
du système, même si ce n'est pas le mécanisme qui gère le rattrapage côté client (ça, c'est `pullDeltas`).

### 6.8 Sécurité

- `wss://` uniquement (jamais `ws://` en clair, même en LAN).
- Authentification obligatoire dans les 5 premières secondes, sinon fermeture.
- Le client ne choisit jamais ses canaux — toujours résolus côté serveur à partir du rôle.
- Limite de taille de message et limite de fréquence d'envoi côté client (anti-abus).

---

## 7. Séquences complètes (résumé visuel)

### 7.1 Démarrage normal de l'application

```
1. Lancement app → lecture config locale (rôle, dernier serveur connu)
2. ensureFreshToken() → rafraîchit le JWT si besoin
3. pullDeltas()        → rattrape les changements depuis la dernière synchro
4. connectWebSocket()  → connexion + authentification + abonnement aux canaux
5. flushOutbox()       → envoie les écritures locales en attente
6. Application affichée, données déjà à jour depuis le cache local
```

### 7.2 Écriture d'une donnée pendant que le poste est en ligne

```
Utilisateur saisit une observation
   → écrite immédiatement en local (UI réactive)
   → ajoutée à l'outbox
   → envoyée tout de suite au serveur (idempotente)
   → serveur confirme + publie "resource.updated" sur Redis Streams
   → realtime-gateway diffuse aux AUTRES postes abonnés au bon canal
   → ces postes reçoivent l'événement en < 1 seconde, mettent à jour leur cache local
```

### 7.3 Écriture hors-ligne puis reconnexion

```
Réseau coupé
   → écriture reste en local, statut "pending" dans l'outbox
   → utilisateur voit un indicateur "en attente de synchronisation" (useSyncStatusStore)
Réseau revient
   → WebSocket se reconnecte (backoff)
   → à l'authentification réussie : pullDeltas() PUIS flushOutbox()
   → les écritures en attente partent, les changements manqués sont rattrapés
```

---

## 8. Tableau récapitulatif

| Mécanisme | Répond à quelle question | Garantie |
|---|---|---|
| REST (lecture) | "Que sait mon cache local ?" | Instantané, toujours disponible |
| REST (écriture) | "Comment j'envoie une action au serveur ?" | Garantie via idempotence + retry |
| WebSocket | "Que se passe-t-il ailleurs, maintenant ?" | Temps réel, mais pas garanti pendant une coupure |
| `pullDeltas` (delta sync) | "Qu'ai-je manqué ?" | Garantie via `_lastUpdated`, rejouée à chaque reconnexion |
| Outbox | "Comment je ne perds jamais une écriture faite hors-ligne ?" | Garantie, rejouée jusqu'à confirmation serveur |
