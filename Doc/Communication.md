# Guide de Communication et API — Willo Server

Ce document détaille l'architecture réseau, les protocoles de communication et les formats de requêtes HTTP / WebSocket pour l'ensemble des microservices de l'application **Willo**.

---

## 📐 1. Architecture Réseau & Points d'Accès

Le système Willo est structuré en **12 microservices** derrière un **Reverse Proxy Nginx** (`sih-nginx`).

### Diagramme de Routage

```
                       ┌─────────────────────────────────────────┐
                       │  Client Client (Electron / Web App)     │
                       └────────────────────┬────────────────────┘
                                            │
                                 http://localhost:5030
                                            │
                                   ┌────────┴────────┐
                                   │  sih-nginx      │
                                   └────────┬────────┘
        ┌──────────────────┬────────────────┼──────────────────┬──────────────────┐
        │ /api/auth/       │ /api/fhir/     │ /api/labo/       │ /api/pharmacie/  │ /ws/
        ▼                  ▼                ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐ ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ auth-service  │  │ fhir-service  │ │ labo-service  │  │pharmacie-serv │  │realtime-gtw   │
│  (port 3001)  │  │  (port 3002)  │ │  (port 3003)  │  │  (port 3004)  │  │  (port 3011)  │
└───────────────┘  └───────────────┘ └───────────────┘  └───────────────┘  └───────────────┘
```

---

## 🗺️ 2. Tableau Récapitulatif des Microservices

| Service | Port Direct (Dev) | Route Nginx (Production / Proxy) | Rôle & Modèles Principaux |
| :--- | :--- | :--- | :--- |
| **`auth-service`** | `http://localhost:3001` | `http://localhost:5030/api/auth/` | Authentification, Utilisateurs, Rôles, Postes, Sessions |
| **`fhir-service`** | `http://localhost:3002` | `http://localhost:5030/api/fhir/` | Cœur clinique HL7 FHIR R4 (Patient, Encounter, etc.) |
| **`labo-service`** | `http://localhost:3003` | `http://localhost:5030/api/labo/` | Examens, Échantillons, Catalogue de tests (`test_catalog`) |
| **`pharmacie-service`** | `http://localhost:3004` | `http://localhost:5030/api/pharmacie/` | Dispensations, Stocks (`stock_items`, `stock_movements`) |
| **`facturation-service`** | `http://localhost:3005` | `http://localhost:5030/api/facturation/` | Tarifs (`tarif_actes`), Factures (`invoices`), Paiements |
| **`statistiques-service`** | `http://localhost:3006` | `http://localhost:5030/api/statistiques/` | Indicateurs (`indicators`), Snapshots de rapports |
| **`ai-diagnosis-service`** | `http://localhost:3007` | `http://localhost:5030/api/diagnosis/` | Modèles ONNX (`model_versions`), Logs d'inférence, Risques |
| **`notification-service`** | `http://localhost:3008` | `http://localhost:5030/api/notification/` | Templates (`notification_templates`), Envois SMS/Push |
| **`audit-service`** | `http://localhost:3009` | `http://localhost:5030/api/audit/` | Traçabilité FHIR (`AuditEvent`), Logs d'accès (`access_logs`) |
| **`file-service`** | `http://localhost:3010` | `http://localhost:5030/api/file/` | Gestion des fichiers binaire et imagerie MinIO (`file_metadata`) |
| **`realtime-gateway`** | `ws://localhost:3011` | `ws://localhost:5030/ws/` | Passerelle WebSocket temps réel (événements, notifs) |
| **`clinique-service`** | `http://localhost:3016` | `http://localhost:5030/api/clinique/` | Orchestration clinique & raccourcis métiers |

---

## 🔐 3. Authentification & En-têtes Standard

Toutes les requêtes API (sauf l'authentification initiale et le healthcheck) doivent inclure un jeton JWT dans le header `Authorization`.

### Headers HTTP Obligatoires

```http
Content-Type: application/json
Authorization: Bearer <VOTRE_JWT_ACCESS_TOKEN>
X-Poste-Id: <UUID_POSTE_TRAVAIL>  (Optionnel - pour traçabilité du poste)
```

---

## 📡 4. Spécifications & Exemples de Requêtes par Service

---

### 🔑 4.1. Auth Service (`auth-service`)

Gestion des comptes, permissions, postes de travail et sessions.

* **Base URL via Proxy** : `http://localhost:5030/api/auth`
* **Base URL Directe** : `http://localhost:3001`

#### Endpoints Clés
* `POST /login` : Authentification utilisateur (retourne `accessToken`, `refreshToken`, et `user`)
* `POST /refresh` : Renouvellement de l'accessToken
* `GET /me` : Profil de l'utilisateur connecté avec ses rôles et permissions
* `POST /users` : Création d'utilisateur (Admin)
* `GET /roles` : Liste des rôles et leurs permissions
* `POST /pairing/code` : Génération d'un code d'appairage de poste

#### Exemple : Connexion (`POST /login`)

```bash
curl -X POST http://localhost:5030/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "medecin@willo.health",
    "password": "Password123!"
  }'
```

**Réponse de succès (`200 OK`)** :
```json
{
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "d8f7e2a1-...",
    "expiresIn": 900
  },
  "user": {
    "id": "u47a1b2c-...",
    "email": "medecin@willo.health",
    "nom": "KABORE",
    "prénom": "Jean",
    "roles": [
      {
        "nom": "médecin",
        "permissions": ["patient:read", "patient:write", "prescription:write"]
      }
    ]
  }
}
```

---

### 🏥 4.2. FHIR Service (`fhir-service`)

Cœur du dossier médical patient. Stocke les ressources au format **HL7 FHIR R4** dans la table `fhir_resources` (JSONB).

* **Base URL via Proxy** : `http://localhost:5030/api/fhir`
* **Base URL Directe** : `http://localhost:3002`

#### Ressource FHIR Supportées
`Patient`, `Practitioner`, `Encounter`, `Observation`, `Condition`, `MedicationRequest`, `MedicationDispense`, `ServiceRequest`, `Specimen`, `DiagnosticReport`, `ImagingStudy`, `DocumentReference`, `CarePlan`, `RiskAssessment`, `Coverage`, `Claim`, `Appointment`, etc.

#### Endpoints Standard FHIR
* `GET /:resourceType` : Recherche de ressources (supporte query params : `subject`, `encounter`, `status`, `_page`, `_limit`)
* `GET /:resourceType/:fhirId` : Récupération par ID FHIR
* `POST /:resourceType` : Création/Insertion d'une nouvelle ressource FHIR
* `PUT /:resourceType/:fhirId` : Mise à jour complète
* `DELETE /:resourceType/:fhirId` : Suppression / Archivage

#### Exemple : Créer un Patient (`POST /Patient`)

```bash
curl -X POST http://localhost:5030/api/fhir/Patient \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "resourceType": "Patient",
    "active": true,
    "name": [
      {
        "use": "official",
        "family": "SAWADOGO",
        "given": ["Awa"]
      }
    ],
    "gender": "female",
    "birthDate": "1994-06-15",
    "telecom": [
      { "system": "phone", "value": "+22670112233", "use": "mobile" }
    ]
  }'
```

---

### 🧪 4.3. Labo Service (`labo-service`)

Gestion des examens de laboratoire, prélèvements et catalogue de tests locaux.

* **Base URL via Proxy** : `http://localhost:5030/api/labo`
* **Base URL Directe** : `http://localhost:3003`

#### Endpoints Clés
* `GET /catalog` : Consultation du catalogue des examens (`TestCatalog`)
* `POST /catalog` : Ajout d'un examen au catalogue avec ses valeurs de référence
* `GET /requests` : Liste des demandes d'examens en attente (proxy FHIR `ServiceRequest`)
* `POST /results` : Saisie des résultats d'examen (génère un `DiagnosticReport` + `Observation` FHIR)

#### Exemple : Consulter le Catalogue des Tests (`GET /catalog`)

```bash
curl -X GET http://localhost:5030/api/labo/catalog \
  -H "Authorization: Bearer <TOKEN>"
```

---

### 💊 4.4. Pharmacie Service (`pharmacie-service`)

Gestion des stocks de médicaments et dispensations d'ordonnances.

* **Base URL via Proxy** : `http://localhost:5030/api/pharmacie`
* **Base URL Directe** : `http://localhost:3004`

#### Endpoints Clés
* `GET /stock` : Liste des lots en stock avec état des périmés et alertes seuil bas
* `POST /stock` : Entrée de stock (`StockItem`)
* `POST /stock/movement` : Enregistrement d'un mouvement (`StockMovement` : entrée, sortie, ajustement)
* `POST /dispense` : Dispensation d'une ordonnance (crée un `MedicationDispense` FHIR et déduit le stock)

#### Exemple : Créer une Entrée de Stock (`POST /stock`)

```bash
curl -X POST http://localhost:5030/api/pharmacie/stock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "médicamentId": "med-paracetamol-500",
    "nomMédicament": "Paracétamol 500mg Comprimé",
    "lot": "LOT-2024-08A",
    "quantité": 500,
    "unité": "boîte",
    "datePéremption": "2026-12-31",
    "emplacement": "Rayon B2",
    "prixUnitaire": 500,
    "alerteSeuilBas": 50
  }'
```

---

### 💰 4.5. Facturation Service (`facturation-service`)

Gestion de la tarification, factures patients et paiements.

* **Base URL via Proxy** : `http://localhost:5030/api/facturation`
* **Base URL Directe** : `http://localhost:3005`

#### Endpoints Clés
* `GET /tarifs` : Référentiel des tarifs d'actes (`TarifActe`)
* `POST /invoices` : Création d'une facture (`Invoice`) avec ventilation assurance/patient
* `GET /invoices/:id` : Détails d'une facture et solde
* `POST /payments` : Enregistrement d'un paiement (`Payment` : espèces, mobile money, assurance)

#### Exemple : Enregistrer un Paiement (`POST /payments`)

```bash
curl -X POST http://localhost:5030/api/facturation/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "invoiceId": "fac-uuid-12345",
    "montant": 2500,
    "mode": "mobile_money",
    "référenceExterne": "OM-BF-88992211",
    "userId": "u47a1b2c-..."
  }'
```

---

### 📊 4.6. Statistiques Service (`statistiques-service`)

Indicateurs de pilotage, agrégation de données et tableaux de bord.

* **Base URL via Proxy** : `http://localhost:5030/api/statistiques`
* **Base URL Directe** : `http://localhost:3006`

#### Endpoints Clés
* `GET /indicators` : Liste des indicateurs configurés
* `GET /dashboard` : Tableau de bord agrégé avec derniers snapshots
* `POST /snapshots/calculate` : Déclenchement manuel du calcul d'un indicateur

---

### 🤖 4.7. AI Diagnosis Service (`ai-diagnosis-service`)

Aide au diagnostic par modèles d'intelligence artificielle ONNX.

* **Base URL via Proxy** : `http://localhost:5030/api/diagnosis`
* **Base URL Directe** : `http://localhost:3007`

#### Endpoints Clés
* `GET /models` : Liste des modèles ONNX enregistrés (`ModelVersion`)
* `POST /predict` : Exécution d'une inférence IA sur les constantes/données d'un patient
* `GET /logs` : Historique des inférences exécutées (`InferenceLog`)

#### Exemple : Lancer une Inférence (`POST /predict`)

```bash
curl -X POST http://localhost:5030/api/diagnosis/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "nomModèle": "sepsis-risk",
    "patientId": "pat-uuid-99",
    "observationIds": ["obs-temp-01", "obs-pouls-02"]
  }'
```

---

### 🔔 4.8. Notification Service (`notification-service`)

Système multi-canal de notifications (WebSocket, SMS, Push, Email).

* **Base URL via Proxy** : `http://localhost:5030/api/notification`
* **Base URL Directe** : `http://localhost:3008`

#### Endpoints Clés
* `GET /templates` : Catalogue des modèles de messages (`NotificationTemplate`)
* `POST /send` : Envoi d'une notification à un utilisateur ou patient
* `GET /sms/logs` : Traçabilité des SMS transmis (`SmsMessage`)

---

### 📋 4.9. Audit Service (`audit-service`)

Journalisation de sécurité, conformité médicale et traçabilité des accès.

* **Base URL via Proxy** : `http://localhost:5030/api/audit`
* **Base URL Directe** : `http://localhost:3009`

#### Endpoints Clés
* `POST /events` : Journalisation d'un événement (`AuditEvent` FHIR)
* `GET /events` : Consultation du registre d'audit avec filtres (par utilisateur, patient, type d'action)
* `GET /logs/access` : Logs d'accès HTTP (`AccessLog`)

---

### 📁 4.10. File Service (`file-service`)

Gestion des pièces jointes et imagerie médicale stockées sur **MinIO S3**.

* **Base URL via Proxy** : `http://localhost:5030/api/file`
* **Base URL Directe** : `http://localhost:3010`

#### Endpoints Clés
* `POST /upload` : Upload d'un fichier (document, image, DICOM) → génère `FileMetadata` & `DocumentReference` FHIR
* `GET /files/:id/download` : Téléchargement direct ou génération d'URL pré-signée MinIO

---

### ⚡ 4.11. Realtime Gateway (`realtime-gateway`)

Passerelle WebSocket pour les notifications temps réel, alertes de stock et mises à jour de dossiers.

* **URL WebSocket via Proxy** : `ws://localhost:5030/ws/`
* **URL Directe** : `ws://localhost:3011`

#### Connexion & Format des Messages WebSocket

```typescript
const socket = new WebSocket('ws://localhost:5030/ws/?token=' + accessToken);

socket.onopen = () => {
  console.log('Connecté au Realtime Gateway');
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Événement reçu:', data.event, data.payload);
};
```

---

## 🛠️ 5. Helper Client TypeScript Recommandé

Pour effectuer des appels réseau standardisés depuis le client Electron (`willo-client`), utilisez une fonction wrapper comme suit :

```typescript
// src/renderer/src/services/apiClient.ts

const API_BASE_URL = 'http://localhost:5030'; // Passerelle Nginx

export async function willoApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('access_token');

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
  }

  return response.json();
}
```

### Exemple d'utilisation dans le Client Frontend

```typescript
// Récupérer un patient
const patient = await willoApi<FhirPatient>('/api/fhir/Patient/pat-123');

// Consulter le stock
const stock = await willoApi<StockItem[]>('/api/pharmacie/stock');
```
