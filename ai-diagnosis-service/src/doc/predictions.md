# 🤖 Spécifications Techniques & Guide des Prédictions IA (`ai-diagnosis-service`)

Ce document constitue la référence complète décrivant **toutes les prédictions effectuées par l'IA**, les **données et constantes médicales en fonction desquelles l'IA prend ses décisions**, ainsi que la **structure exacte des requêtes et réponses HTTP** pour l'interrogation du microservice d'inférence de la plateforme **Willo**.

---

## 📋 Sommaire

1. [Vue d'Ensemble du Microservice IA](#1-vue-densemble-du-microservice-ia)
2. [Catalogue Complet des Prédictions IA](#2-catalogue-complet-des-prédictions-ia)
3. [En Fonction de Quoi l'IA Fait ses Prédictions (Features & Règles)](#3-en-fonction-de-quoi-lia-fait-ses-prédictions-features--règles)
   - [3.1 Sepsis (`sepsis-risk-v1`)](#31-évaluation-du-risque-de-sepsis-sepsis-risk-v1)
   - [3.2 Paludisme / Malaria (`malaria-risk-v1`)](#32-dépistage--probabilité-de-paludisme-malaria-risk-v1)
   - [3.3 Réhospitalisation à 30 jours (`readmission-risk-v1`)](#33-risque-de-réhospitalisation-à-30-jours-readmission-risk-v1)
   - [3.4 Risque Cardiovasculaire (`cardiovascular-risk-v1`)](#34-risque-de-décompensation-cardiovasculaire-cardiovascular-risk-v1)
   - [3.5 Anomalies Biologiques (`lab-anomaly-detection-v1`)](#35-détection-danomalies-biologiques-multi-organes-lab-anomaly-detection-v1)
4. [Valeurs par Défaut des Features (Fallback)](#4-valeurs-par-défaut-des-features-fallback)
5. [Alimentation des Données : Modes Direct & FHIR (LOINC)](#5-alimentation-des-données--modes-direct--fhir-loinc)
6. [Structure de la Requête de Prédiction (API Request)](#6-structure-de-la-requête-de-prédiction-api-request)
   - [6.1 Endpoints HTTP](#61-endpoints-http)
   - [6.2 Schéma JSON de la Requête (`PredictionRequest`)](#62-schéma-json-de-la-requête-predictionrequest)
   - [6.3 Exemples de Requêtes (Features Directes vs IDs FHIR)](#63-exemples-de-requêtes-features-directes-vs-ids-fhir)
7. [Structure de la Réponse de Prédiction (API Response & FHIR)](#7-structure-de-la-réponse-de-prédiction-api-response--fhir)
   - [7.1 Schéma JSON de la Réponse (`PredictionResponse`)](#71-schéma-json-de-la-réponse-predictionresponse)
   - [7.2 Exemple de Réponse Complète avec FHIR `RiskAssessment`](#72-exemple-de-réponse-complète-avec-fhir-riskassessment)
8. [Exemples de Commandes cURL](#8-exemples-de-commandes-curl)

---

## 1. Vue d'Ensemble du Microservice IA

Le service **AI Diagnosis Service** (`ai-diagnosis-service`, exécuté sur le port **3007** et accessible via le Nginx Gateway sur `http://localhost:5030/api/diagnosis/predict`) utilise des modèles d'arbre de décision (*DecisionTreeClassifier* via Scikit-Learn) pour analyser en temps réel l'état de santé du patient et calculer des scores de risque médical explicables.

```
┌─────────────────────────┐      HTTP POST /predict      ┌─────────────────────────┐
│ Client (Electron / Web) │ ──────────────────────────-> │ Nginx Reverse Proxy     │
│  ou Microservice Willo  │                              │ (Port 5030)             │
└─────────────────────────┘                              └────────────┬────────────┘
                                                                      │
                                                                      ▼
┌─────────────────────────┐    Extraction Obs. FHIR      ┌─────────────────────────┐
│ fhir-service            │ <─────────────────────────── │ ai-diagnosis-service    │
│ (Port 3002)             │     (Codes LOINC FHIR)       │ (Port 3007 - FastAPI)   │
└─────────────────────────┘                              └────────────┬────────────┘
                                                                      │
                                                                      ▼
                                                         ┌─────────────────────────┐
                                                         │ PostgreSQL (sih_db)     │
                                                         │ Schema `ai` (Logs)      │
                                                         └─────────────────────────┘
```

---

## 2. Catalogue Complet des Prédictions IA

L'IA propose **5 modèles de prédiction spécialisés** :

| Identifiant du Modèle (`nomModele`) | Version | Objectif Médical | Niveaux de Risque Générés | Code SNOMED-CT |
| :--- | :--- | :--- | :--- | :--- |
| `sepsis-risk-v1` | `1.2.0` | **Risque de Sepsis & Choc Septique** (SIRS / qSOFA / Défaillance d'organes) | `CRITICAL`, `HIGH`, `MODERATE`, `LOW` | `91302008` |
| `malaria-risk-v1` | `1.1.0` | **Dépistage & Probabilité de Paludisme** (Accès palustre / Paludisme grave) | `HIGH`, `LOW` | `61462000` |
| `readmission-risk-v1` | `1.0.0` | **Risque de Réhospitalisation à 30 jours** (Fragilité post-sortie) | `HIGH`, `LOW` | `410605003` |
| `cardiovascular-risk-v1` | `1.1.0` | **Risque de Décompensation Cardiovasculaire** (Hypertension / Crise) | `HIGH`, `LOW` | `49436004` |
| `lab-anomaly-detection-v1` | `1.0.0` | **Détection d'Anomalies Biologiques** (Atteinte rénale, hépatique, sang) | `HIGH`, `LOW` | `166312007` |

---

## 3. En Fonction de Quoi l'IA Fait ses Prédictions (Features & Règles)

Pour chaque modèle, l'IA analyse un ensemble spécifique de **constantes vitales**, **bilans biologiques**, **antécédents** et **données démographiques**. Si une donnée n'est pas fournie, une valeur physiologique par défaut est utilisée (voir [section 4](#4-valeurs-par-défaut-des-features-fallback)).

---

### 3.1 Évaluation du Risque de Sepsis (`sepsis-risk-v1`)

**Version :** `1.2.0` | **Classes :** 3 niveaux (0 = Faible, 1 = Modéré, 2 = Élevé/Critique)

#### 📌 Features utilisées par le modèle (dans l'ordre exact) :

| # | Feature (`clé`) | Unité | Description |
| :--- | :--- | :--- | :--- |
| 1 | `temperature` | °C | Température corporelle |
| 2 | `frequenceCardiaque` | bpm | Fréquence cardiaque |
| 3 | `pressionSystolique` | mmHg | Pression artérielle systolique |
| 4 | `pressionDiastolique` | mmHg | Pression artérielle diastolique |
| 5 | `frequenceRespiratoire` | cycles/min | Fréquence respiratoire |
| 6 | `saturationO2` | % | Saturation en oxygène (SpO2) |
| 7 | `leucocytes` | /mm³ | Globules blancs |
| 8 | `lactate` | mmol/L | Lactate sanguin |
| 9 | `scoreGlasgow` | 3-15 | Score de Glasgow |
| 10 | `plaquettes` | /mm³ | Plaquettes sanguines |
| 11 | `crp` | mg/L | Protéine C-Réactive (CRP) |
| 12 | `age` | années | Âge du patient |
| 13 | `sexe` | 0/1 | Sexe (0 = Féminin, 1 = Masculin) |

#### 📊 Seuils Physiologiques et Impacts Analysés par l'IA :

| Variable (`feature`) | Valeur / Seuil Détecté | Impact Identifié | Explication clinique |
| :--- | :--- | :--- | :--- |
| `temperature` | `> 38.3 °C` | `HIGH` | Hyperthermie majeure |
| `temperature` | `< 36.0 °C` | `CRITICAL` | Hypothermie critique |
| `pressionSystolique` | `<= 90 mmHg` | `CRITICAL` | Hypotension artérielle (Choc septique) |
| `pressionSystolique` | `< 100 mmHg` | `MODERATE` | Pression systolique limite |
| `frequenceCardiaque` | `> 90 bpm` | `MODERATE` | Tachycardie |
| `frequenceRespiratoire`| `>= 22 cycles/min` | `HIGH` | Tachypnée (Critère qSOFA) |
| `leucocytes` | `> 12 000 /mm³` | `MODERATE` | Hyperleucocytose inflammatoire |
| `leucocytes` | `< 4 000 /mm³` | `HIGH` | Leucopénie séro-immunitaire |
| `lactate` | `> 2.0 mmol/L` | `HIGH` | Hyperlactatémie (Hypoperfusion tissulaire) |
| `lactate` | `> 4.0 mmol/L` | `CRITICAL` | Hyperlactatémie sévère (Choc) |
| `scoreGlasgow` | `< 15` | `HIGH` | Altération de l'état de conscience |

#### 🔴 Logique de Niveaux de Risque Final :

| Condition | `niveauRisque` | `intituleDiagnostic` |
| :--- | :--- | :--- |
| `pred_class == 2` **OU** `pressionSystolique <= 90` **OU** `lactate > 3.0` | `HIGH` (ou `CRITICAL` si SysBP <= 85 ou lactate > 4.0) | Risque Élevé de Sepsis / Choc Septique |
| `pred_class == 1` **OU** `nb_facteurs >= 2` | `MODERATE` | Risque Modéré de Sepsis |
| Sinon | `LOW` | Risque Faible de Sepsis |

---

### 3.2 Dépistage & Probabilité de Paludisme (`malaria-risk-v1`)

**Version :** `1.1.0` | **Classes :** 2 niveaux (0 = Faible, 1 = Élevé)

#### 📌 Features utilisées par le modèle (dans l'ordre exact) :

| # | Feature (`clé`) | Unité | Description |
| :--- | :--- | :--- | :--- |
| 1 | `temperature` | °C | Température corporelle |
| 2 | `frequenceCardiaque` | bpm | Fréquence cardiaque |
| 3 | `age` | années | Âge du patient |
| 4 | `tdrMalaria` | 0/1 | Test de Diagnostic Rapide Paludisme (1 = Positif) |
| 5 | `plaquettes` | /mm³ | Plaquettes sanguines |
| 6 | `hemoglobine` | g/dL | Hémoglobine |
| 7 | `sexe` | 0/1 | Sexe (0 = Féminin, 1 = Masculin) |
| 8 | `dureeSymptomesJours` | jours | Durée des symptômes |

#### 📊 Seuils Physiologiques et Impacts Analysés par l'IA :

| Variable (`feature`) | Valeur / Seuil Détecté | Impact Identifié | Explication clinique |
| :--- | :--- | :--- | :--- |
| `tdrMalaria` | `= 1.0` | `CRITICAL` | Test de Diagnostic Rapide (TDR) Paludisme Positif |
| `temperature` | `>= 38.5 °C` | `HIGH` | Fièvre palustre élevée |
| `plaquettes` | `< 150 000 /mm³` | `HIGH` | Thrombopénie associée au paludisme |
| `hemoglobine` | `< 11.0 g/dL` | `MODERATE` | Anémie palustre |

#### 🔴 Logique de Niveaux de Risque Final :

| Condition | `niveauRisque` | `intituleDiagnostic` |
| :--- | :--- | :--- |
| `pred_class == 1` **OU** `tdrMalaria == 1.0` **OU** `température >= 39.0 °C` | `HIGH` | Probabilité Élevée de Paludisme |
| Sinon | `LOW` | Probabilité Faible de Paludisme |

---

### 3.3 Risque de Réhospitalisation à 30 jours (`readmission-risk-v1`)

**Version :** `1.0.0` | **Classes :** 2 niveaux (0 = Faible, 1 = Élevé)

#### 📌 Features utilisées par le modèle (dans l'ordre exact) :

| # | Feature (`clé`) | Unité | Description |
| :--- | :--- | :--- | :--- |
| 1 | `age` | années | Âge du patient |
| 2 | `nbHospitalisationsRecentes` | nombre | Nombre d'hospitalisations récentes |
| 3 | `dureeSejourJours` | jours | Durée du séjour actuel |
| 4 | `comorbiditesCount` | nombre | Nombre de comorbidités associées |
| 5 | `scoreGlasgow` | 3-15 | Score de Glasgow |
| 6 | `bmi` | kg/m² | Indice de Masse Corporelle (IMC) |
| 7 | `autonomie` | % | Score d'autonomie fonctionnelle |

#### 📊 Seuils Physiologiques et Impacts Analysés par l'IA :

| Variable (`feature`) | Valeur / Seuil Détecté | Impact Identifié | Explication clinique |
| :--- | :--- | :--- | :--- |
| `nbHospitalisationsRecentes` | `>= 2` | `HIGH` | Réhospitalisations multiples récentes |
| `dureeSejourJours` | `>= 7 jours` | `MODERATE` | Séjour prolongé générateur de fragilité |
| `comorbiditesCount` | `>= 3` | `HIGH` | Polypathologie complexe |
| `autonomie` | `< 60 %` | `MODERATE` | Perte d'autonomie fonctionnelle |

#### 🔴 Logique de Niveaux de Risque Final :

| Condition | `niveauRisque` | `intituleDiagnostic` |
| :--- | :--- | :--- |
| `pred_class == 1` **OU** `nbHospitalisationsRecentes >= 2` **OU** `comorbiditesCount >= 4` | `HIGH` | Risque Élevé de Réhospitalisation à 30 jours |
| Sinon | `LOW` | Risque Faible de Réhospitalisation |

---

### 3.4 Risque de Décompensation Cardiovasculaire (`cardiovascular-risk-v1`)

**Version :** `1.1.0` | **Classes :** 2 niveaux (0 = Faible/Modéré, 1 = Élevé)

#### 📌 Features utilisées par le modèle (dans l'ordre exact) :

| # | Feature (`clé`) | Unité | Description |
| :--- | :--- | :--- | :--- |
| 1 | `pressionSystolique` | mmHg | Pression artérielle systolique |
| 2 | `pressionDiastolique` | mmHg | Pression artérielle diastolique |
| 3 | `frequenceCardiaque` | bpm | Fréquence cardiaque |
| 4 | `age` | années | Âge du patient |
| 5 | `bmi` | kg/m² | Indice de Masse Corporelle (IMC) |
| 6 | `diabete` | 0/1 | Diabète (0 = Non, 1 = Oui) |
| 7 | `tabagisme` | 0/1 | Tabagisme actif (0 = Non, 1 = Oui) |
| 8 | `cholesterol` | mmol/L | Cholestérolémie totale |

#### 📊 Seuils Physiologiques et Impacts Analysés par l'IA :

| Variable (`feature`) | Valeur / Seuil Détecté | Impact Identifié | Explication clinique |
| :--- | :--- | :--- | :--- |
| `pressionSystolique` | `>= 160 mmHg` | `CRITICAL` | Hypertension systolique de Grade 2/3 |
| `pressionSystolique` | `>= 140 mmHg` | `HIGH` | Hypertension systolique modérée |
| `pressionDiastolique` | `>= 100 mmHg` | `CRITICAL` | Hypertension diastolique sévère |
| `pressionDiastolique` | `>= 90 mmHg` | `HIGH` | Hypertension diastolique modérée |
| `bmi` | `>= 30 kg/m²` | `MODERATE` | Obésité (Facteur de risque cardiovasculaire) |

#### 🔴 Logique de Niveaux de Risque Final :

| Condition | `niveauRisque` | `intituleDiagnostic` |
| :--- | :--- | :--- |
| `pred_class == 1` **OU** `pressionSystolique >= 160` **OU** `pressionDiastolique >= 100` | `HIGH` | Risque Cardiovasculaire Élevé |
| Sinon | `LOW` | Risque Cardiovasculaire Modéré / Faible |

---

### 3.5 Détection d'Anomalies Biologiques Multi-organes (`lab-anomaly-detection-v1`)

**Version :** `1.0.0` | **Classes :** 2 niveaux (0 = Normal, 1 = Anomalie Détectée)

#### 📌 Features utilisées par le modèle (dans l'ordre exact) :

| # | Feature (`clé`) | Unité | Description |
| :--- | :--- | :--- | :--- |
| 1 | `creatinine` | µmol/L | Créatininémie (Bilan rénal) |
| 2 | `leucocytes` | /mm³ | Globules blancs (Bilan inflammatoire/hématologique) |
| 3 | `plaquettes` | /mm³ | Plaquettes sanguines (Hémostase) |
| 4 | `bilirubine` | µmol/L | Bilirubinémie totale (Bilan hépatique) |
| 5 | `crp` | mg/L | Protéine C-Réactive (Inflammation) |
| 6 | `hemoglobine` | g/dL | Hémoglobine (Anémie) |
| 7 | `potassium` | mmol/L | Kaliémie (Ionogramme) |
| 8 | `natremie` | mmol/L | Natrémie / Sodium (Ionogramme) |

#### 📊 Seuils Physiologiques et Impacts Analysés par l'IA :

| Variable (`feature`) | Valeur / Seuil Détecté | Impact Identifié | Explication clinique |
| :--- | :--- | :--- | :--- |
| `creatinine` | `> 130 µmol/L` | `HIGH` | Insuffisance rénale aiguë / chronique |
| `bilirubine` | `> 35 µmol/L` | `HIGH` | Hyperbilirubinémie (Atteinte hépatique / Ictère) |
| `crp` | `> 50 mg/L` | `HIGH` | Syndrome inflammatoire majeur |
| `plaquettes` | `< 100 000 /mm³` | `HIGH` | Thrombopénie sévère |

#### 🔴 Logique de Niveaux de Risque Final :

| Condition | `niveauRisque` | `intituleDiagnostic` |
| :--- | :--- | :--- |
| `pred_class == 1` **OU** au moins 1 facteur contributif détecté | `HIGH` | Anomalies Biologiques Majeures Détectées |
| Sinon | `LOW` | Profil Biologique Dans Les Limites Normales |

---

## 4. Valeurs par Défaut des Features (Fallback)

Si une feature n'est pas fournie dans la requête, le moteur d'inférence (`InferenceEngine`) utilise automatiquement les valeurs physiologiques normales suivantes :

| Feature | Valeur par Défaut | Unité | Signification |
| :--- | :--- | :--- | :--- |
| `temperature` | `37.0` | °C | Normothermie |
| `frequenceCardiaque` | `75.0` | bpm | Fréquence cardiaque normale |
| `pressionSystolique` | `120.0` | mmHg | Pression systolique normale |
| `pressionDiastolique` | `80.0` | mmHg | Pression diastolique normale |
| `frequenceRespiratoire` | `16.0` | cycles/min | Fréquence respiratoire normale |
| `saturationO2` | `98.0` | % | SpO2 normale |
| `leucocytes` | `7000.0` | /mm³ | GB normal |
| `lactate` | `1.0` | mmol/L | Lactate normal |
| `scoreGlasgow` | `15.0` | 3-15 | Conscience normale |
| `plaquettes` | `250000.0` | /mm³ | Plaquettes normales |
| `crp` | `3.0` | mg/L | Inflammation absente |
| `age` | `45.0` | années | — |
| `sexe` | `1.0` | 0/1 | Masculin par défaut |
| `tdrMalaria` | `0.0` | 0/1 | TDR négatif |
| `hemoglobine` | `13.5` | g/dL | Hémoglobine normale |
| `dureeSymptomesJours` | `2.0` | jours | — |
| `nbHospitalisationsRecentes` | `0.0` | nombre | — |
| `dureeSejourJours` | `3.0` | jours | — |
| `comorbiditesCount` | `0.0` | nombre | — |
| `bmi` | `24.0` | kg/m² | Poids normal |
| `autonomie` | `90.0` | % | Autonomie fonctionnelle complète |
| `diabete` | `0.0` | 0/1 | Pas de diabète |
| `tabagisme` | `0.0` | 0/1 | Non-fumeur |
| `cholesterol` | `4.8` | mmol/L | Cholestérol normal |
| `creatinine` | `85.0` | µmol/L | Fonction rénale normale |
| `bilirubine` | `12.0` | µmol/L | Bilirubine normale |
| `potassium` | `4.2` | mmol/L | Kaliémie normale |
| `natremie` | `140.0` | mmol/L | Natrémie normale |

---

## 5. Alimentation des Données : Modes Direct & FHIR (LOINC)

Le service autorise **deux modes d'entrée des données** :

1. **Mode Direct (`features`)** : Le client passe directement un dictionnaire clé/valeur des mesures.
2. **Mode Automatique FHIR (`observationIds`)** : Le client transmet des IDs d'observations FHIR (`Observation`). Le service contacte automatiquement `fhir-service` (Port 3002) et convertit les **codes LOINC** en variables de prédiction :

| Code LOINC FHIR | Libellé Médical Standard | Variable Externe IA (`feature`) |
| :--- | :--- | :--- |
| `8310-5` | Body temperature | `temperature` |
| `8867-4` | Heart rate | `frequenceCardiaque` |
| `8480-6` | Systolic blood pressure | `pressionSystolique` |
| `8462-4` | Diastolic blood pressure | `pressionDiastolique` |
| `9279-1` | Respiratory rate | `frequenceRespiratoire` |
| `2708-6` | Oxygen saturation | `saturationO2` |
| `6690-2` | Leukocytes [#/volume] in Blood | `leucocytes` |
| `777-3` | Platelets [#/volume] in Blood | `plaquettes` |
| `2571-8` | Triglycerides [Mass/volume] in Serum/Plasma | `triglycerides` |
| `2160-0` | Creatinine [Mass/volume] in Serum/Plasma | `creatinine` |
| `1975-2` | Bilirubin.total [Mass/volume] in Serum/Plasma | `bilirubine` |
| `1988-5` | C reactive protein [Mass/volume] in Serum/Plasma | `crp` |

> **Note :** Si une observation FHIR retourne une feature déjà présente dans `features` (mode direct), la valeur directe a la priorité.

---

## 6. Structure de la Requête de Prédiction (API Request)

### 6.1 Endpoints HTTP

- **Route via Nginx Gateway** : `POST http://localhost:5030/api/diagnosis/predict`
- **Route Directe Service** : `POST http://localhost:3007/predict`
- **En-têtes (Headers)** :
  ```http
  Content-Type: application/json
  Authorization: Bearer <accessToken>
  ```

---

### 6.2 Schéma JSON de la Requête (`PredictionRequest`)

```json
{
  "nomModele": "string (ex: sepsis-risk-v1)",
  "patientId": "string (ex: pat-uuid-99)",
  "encounterId": "string (optionnel, ex: enc-uuid-12)",
  "features": {
    "nomFeature1": 0.0,
    "nomFeature2": 0.0
  },
  "observationIds": [
    "string (ID ressource FHIR Observation)"
  ]
}
```

#### Description des Champs de la Requête :

| Champ | Type | Obligatoire | Description |
| :--- | :--- | :--- | :--- |
| `nomModele` | `string` | **Oui** | Nom exact du modèle d'IA (`sepsis-risk-v1`, `malaria-risk-v1`, `readmission-risk-v1`, `cardiovascular-risk-v1`, `lab-anomaly-detection-v1`). |
| `patientId` | `string` | **Oui** | UUID unique ou identifiant FHIR du patient. |
| `encounterId` | `string` | Non | UUID de la consultation / hospitalisation en cours (`Encounter`). |
| `features` | `object` | Optionnel* | Dictionnaire clé-valeur contenant les constantes et mesures. Les features manquantes sont remplacées par les valeurs par défaut (section 4). |
| `observationIds` | `array[str]`| Optionnel* | Liste des identifiants des ressources `Observation` enregistrées dans FHIR. |

*\* Note : Il est recommandé de fournir au moins `features` ou `observationIds`.*

---

### 6.3 Exemples de Requêtes

#### Exemple 1 : Transmission Directe des Features (Sepsis)

```json
{
  "nomModele": "sepsis-risk-v1",
  "patientId": "pat-uuid-99",
  "encounterId": "enc-uuid-12",
  "features": {
    "temperature": 38.9,
    "frequenceCardiaque": 115,
    "pressionSystolique": 90,
    "pressionDiastolique": 60,
    "frequenceRespiratoire": 24,
    "saturationO2": 93,
    "leucocytes": 14500,
    "lactate": 3.2,
    "scoreGlasgow": 14,
    "plaquettes": 95000,
    "crp": 112,
    "age": 54,
    "sexe": 1
  }
}
```

#### Exemple 2 : Transmission par Références FHIR (Paludisme)

```json
{
  "nomModele": "malaria-risk-v1",
  "patientId": "pat-uuid-45",
  "encounterId": "enc-uuid-34",
  "observationIds": [
    "obs-temp-2026-001",
    "obs-pouls-2026-002",
    "obs-tdr-2026-003"
  ]
}
```

#### Exemple 3 : Transmission Directe (Cardiovasculaire)

```json
{
  "nomModele": "cardiovascular-risk-v1",
  "patientId": "pat-uuid-88",
  "features": {
    "pressionSystolique": 165,
    "pressionDiastolique": 102,
    "frequenceCardiaque": 98,
    "age": 62,
    "bmi": 31.5,
    "diabete": 1,
    "tabagisme": 0,
    "cholesterol": 6.8
  }
}
```

---

## 7. Structure de la Réponse de Prédiction (API Response & FHIR)

L'API répond avec une structure JSON standardisée contenant le résultat explicable et une ressource FHIR **`RiskAssessment`**.

### 7.1 Schéma JSON de la Réponse (`PredictionResponse`)

| Champ | Type | Description |
| :--- | :--- | :--- |
| `success` | `boolean` | Indique le succès du traitement (`true`). |
| `inferenceId` | `string` | UUID unique de la prédiction générée (ex: `inf-a1b2c3d4...`). |
| `timestamp` | `string` | Horodatage ISO 8601 de l'inférence (UTC). |
| `nomModele` | `string` | Modèle utilisé pour la prédiction. |
| `modelVersion` | `string` | Version du modèle ML entraîné (ex: `1.2.0`). |
| `patientId` | `string` | Identifiant du patient évalué. |
| `prediction.scoreProbabilite` | `float` | Score de probabilité calculé par le modèle (0.00 à 1.00). |
| `prediction.niveauRisque` | `string` | Niveau de risque qualitatif (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`). |
| `prediction.intituleDiagnostic` | `string` | Titre/Diagnostic généré par l'IA. |
| `prediction.facteursContributifs`| `array[object]`| Liste détaillée des facteurs ayant influencé la décision avec leur impact. |
| `prediction.recommandations` | `array[string]`| Actions cliniques recommandées au praticien. |
| `fhirResource` | `object` | Ressource HL7/FHIR `RiskAssessment` prête à l'archivage. |

---

### 7.2 Exemple de Réponse Complète avec FHIR `RiskAssessment`

```json
{
  "success": true,
  "inferenceId": "inf-8f7b2c1a-4d3e-9b8a-7c6f-5e4d3c2b1a0f",
  "timestamp": "2026-09-09T11:00:00.000000+00:00",
  "nomModele": "sepsis-risk-v1",
  "modelVersion": "1.2.0",
  "patientId": "pat-uuid-99",
  "prediction": {
    "scoreProbabilite": 0.845,
    "niveauRisque": "HIGH",
    "intituleDiagnostic": "Risque Élevé de Sepsis / Choc Septique",
    "facteursContributifs": [
      {
        "feature": "temperature",
        "valeur": 38.9,
        "impact": "HIGH",
        "explication": "Hyperthermie majeure (38.9°C > 38.3°C)"
      },
      {
        "feature": "pressionSystolique",
        "valeur": 90,
        "impact": "CRITICAL",
        "explication": "Hypotension artérielle systolique (90 mmHg <= 90 mmHg)"
      },
      {
        "feature": "frequenceCardiaque",
        "valeur": 115,
        "impact": "MODERATE",
        "explication": "Tachycardie (115 bpm > 90 bpm)"
      },
      {
        "feature": "frequenceRespiratoire",
        "valeur": 24,
        "impact": "HIGH",
        "explication": "Tachypnée (24 c/min >= 22)"
      },
      {
        "feature": "lactate",
        "valeur": 3.2,
        "impact": "HIGH",
        "explication": "Hyperlactatémie (3.2 mmol/L)"
      }
    ],
    "recommandations": [
      "Placer le patient sous surveillance continue des constantes vitales.",
      "Réaliser un bilan de lactatémie et des hémocultures en urgence.",
      "Envisager un remplissage vasculaire et un avis de réanimation immédiat."
    ]
  },
  "fhirResource": {
    "resourceType": "RiskAssessment",
    "id": "risk-inf-8f7b2c1a-4d3e-9b8a-7c6f-5e4d3c2b1a0f",
    "status": "final",
    "subject": {
      "reference": "Patient/pat-uuid-99"
    },
    "occurrenceDateTime": "2026-09-09T11:00:00.000000+00:00",
    "prediction": [
      {
        "outcome": {
          "coding": [
            {
              "system": "http://snomed.info/sct",
              "code": "91302008",
              "display": "Risque Élevé de Sepsis / Choc Septique"
            }
          ],
          "text": "Risque Élevé de Sepsis / Choc Septique"
        },
        "probabilityDecimal": 0.845,
        "qualitativeRisk": {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/risk-probability",
              "code": "high",
              "display": "HIGH risk"
            }
          ]
        },
        "rationale": "Score basé sur l'analyse des symptômes: temperature=38.9, pressionSystolique=90, frequenceCardiaque=115"
      }
    ],
    "encounter": {
      "reference": "Encounter/enc-uuid-12"
    }
  }
}
```

---

## 8. Exemples de Commandes cURL

### Requête 1 : Prédiction du Risque de Sepsis

```bash
curl -X POST http://localhost:5030/api/diagnosis/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "nomModele": "sepsis-risk-v1",
    "patientId": "pat-uuid-99",
    "encounterId": "enc-uuid-12",
    "features": {
      "temperature": 38.9,
      "frequenceCardiaque": 115,
      "pressionSystolique": 90,
      "frequenceRespiratoire": 24,
      "leucocytes": 14500,
      "lactate": 3.2,
      "scoreGlasgow": 14
    }
  }'
```

### Requête 2 : Prédiction du Risque de Paludisme

```bash
curl -X POST http://localhost:5030/api/diagnosis/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "nomModele": "malaria-risk-v1",
    "patientId": "pat-uuid-45",
    "features": {
      "temperature": 39.2,
      "frequenceCardiaque": 105,
      "tdrMalaria": 1.0,
      "plaquettes": 110000,
      "hemoglobine": 10.2,
      "age": 32,
      "sexe": 0,
      "dureeSymptomesJours": 4
    }
  }'
```

### Requête 3 : Détection d'Anomalies Biologiques

```bash
curl -X POST http://localhost:5030/api/diagnosis/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "nomModele": "lab-anomaly-detection-v1",
    "patientId": "pat-uuid-77",
    "features": {
      "creatinine": 155.0,
      "bilirubine": 42.0,
      "crp": 88.0,
      "plaquettes": 90000,
      "leucocytes": 17500,
      "hemoglobine": 9.5,
      "potassium": 3.0,
      "natremie": 130
    }
  }'
```

### Requête 4 : Risque Cardiovasculaire

```bash
curl -X POST http://localhost:5030/api/diagnosis/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "nomModele": "cardiovascular-risk-v1",
    "patientId": "pat-uuid-88",
    "features": {
      "pressionSystolique": 165,
      "pressionDiastolique": 102,
      "frequenceCardiaque": 98,
      "age": 62,
      "bmi": 31.5,
      "diabete": 1,
      "tabagisme": 0,
      "cholesterol": 6.8
    }
  }'
```

### Requête 5 : Risque de Réhospitalisation

```bash
curl -X POST http://localhost:5030/api/diagnosis/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "nomModele": "readmission-risk-v1",
    "patientId": "pat-uuid-55",
    "encounterId": "enc-uuid-77",
    "features": {
      "age": 72,
      "nbHospitalisationsRecentes": 3,
      "dureeSejourJours": 9,
      "comorbiditesCount": 4,
      "scoreGlasgow": 14,
      "bmi": 29.0,
      "autonomie": 50
    }
  }'
```
