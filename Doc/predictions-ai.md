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
4. [Alimentation des Données : Modes Direct & FHIR (LOINC)](#4-alimentation-des-données--modes-direct--fhir-loinc)
5. [Structure de la Requête de Prédiction (API Request)](#5-structure-de-la-requête-de-prédiction-api-request)
   - [5.1 Endpoints HTTP](#51-endpoints-http)
   - [5.2 Schéma JSON de la Requête (`PredictionRequest`)](#52-schéma-json-de-la-requête-predictionrequest)
   - [5.3 Exemples de Requêtes (Features Directes vs IDs FHIR)](#53-exemples-de-requêtes-features-directes-vs-ids-fhir)
6. [Structure de la Réponse de Prédiction (API Response & FHIR)](#6-structure-de-la-réponse-de-prédiction-api-response--fhir)
   - [6.1 Schéma JSON de la Réponse (`PredictionResponse`)](#61-schéma-json-de-la-réponse-predictionresponse)
   - [6.2 Exemple de Réponse Complète avec FHIR `RiskAssessment`](#62-exemple-de-réponse-complète-avec-fhir-riskassessment)
7. [Exemples de Commandes cURL](#7-exemples-de-commandes-curl)

---

## 1. Vue d'Ensemble du Microservice IA

Le service **AI Diagnosis Service** (`ai-diagnosis-service`, exécuté sur le port **3007** et accessible via le Nginx Gateway sur `http://localhost:5030/api/diagnosis/predict`) utilise des modèles d'arbre de décision (*DecisionTreeClassifier* via Scikit-Learn) pour analyser en temps réel l'état de santé du patient et calculer des scores de risque médical explicables.

```
┌─────────────────────────┐      HTTP POST /predict      ┌─────────────────────────┐
│ Client (Electron / Web) │ ───────────────────────────> │ Nginx Reverse Proxy     │
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

| Identifiant du Modèle (`nomModele`) | Objectif Médical | Niveaux de Risque Générés | Code SNOMED-CT |
| :--- | :--- | :--- | :--- |
| `sepsis-risk-v1` | **Risque de Sepsis & Choc Septique** (SIRS / qSOFA / Défaillance d'organes) | `CRITICAL`, `HIGH`, `MODERATE`, `LOW` | `91302008` |
| `malaria-risk-v1` | **Dépistage & Probabilité de Paludisme** (Accès palustre / Paludisme grave) | `HIGH`, `LOW` | `61462000` |
| `readmission-risk-v1` | **Risque de Réhospitalisation à 30 jours** (Fragilité post-sortie) | `HIGH`, `LOW` | `410605003` |
| `cardiovascular-risk-v1` | **Risque de Décompensation Cardiovasculaire** (Hypertension / Crise) | `HIGH`, `LOW` | `49436004` |
| `lab-anomaly-detection-v1` | **Détection d'Anomalies Biologiques** (Atteinte rénale, hépatique, sang) | `HIGH`, `LOW` | `166312007` |

---

## 3. En Fonction de Quoi l'IA Fait ses Prédictions (Features & Règles)

Pour chaque modèle, l'IA analyse un ensemble spécifique de **constantes vitales**, **bilans biologiques**, **antécédents** et **données démographiques**. Si une donnée n'est pas fournie, une valeur physiologique par défaut est utilisée.

---

### 3.1 Évaluation du Risque de Sepsis (`sepsis-risk-v1`)

#### 📌 En fonction de quoi l'IA prédit :
- **Constantes Vitales** : Température (°C), Fréquence Cardiaque (bpm), Pression Artérielle Systolique (mmHg), Fréquence Respiratoire (cycles/min), Saturation en Oxygène (SpO2 %), Score de Glasgow (GCS 3-15).
- **Analyses de Laboratoire** : Leucocytes / Globules Blancs (/mm³), Lactate sanguin (mmol/L), Plaquettes (/mm³), Protéine C-Réactive / CRP (mg/L).
- **Données Patient** : Âge (années).

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
| `lactate` | `> 2.0 mmol/L` | `HIGH` / `CRITICAL` | Hyperlactatémie (Hypoperfusion tissulaire) |
| `scoreGlasgow` | `< 15` | `HIGH` | Altération de l'état de conscience |

---

### 3.2 Dépistage & Probabilité de Paludisme (`malaria-risk-v1`)

#### 📌 En fonction de quoi l'IA prédit :
- **Test Biologique Spécifique** : Test de Diagnostic Rapide Paludisme (`tdrMalaria` : `1.0` = Positif, `0.0` = Négatif).
- **Constantes Vitales** : Température (°C), Fréquence Cardiaque (bpm).
- **Numération Formule Sanguine (NFS)** : Plaquettes (/mm³), Hémoglobine (g/dL).
- **Contexte Clinique** : Durée des symptômes (jours), Âge, Sexe.

#### 📊 Seuils Physiologiques et Impacts Analysés par l'IA :

| Variable (`feature`) | Valeur / Seuil Détecté | Impact Identifié | Explication clinique |
| :--- | :--- | :--- | :--- |
| `tdrMalaria` | `= 1.0` | `CRITICAL` | Test de Diagnostic Rapide (TDR) Paludisme Positif |
| `temperature` | `>= 38.5 °C` | `HIGH` | Fièvre palustre élevée |
| `plaquettes` | `< 150 000 /mm³` | `HIGH` | Thrombopénie associée au paludisme |
| `hemoglobine` | `< 11.0 g/dL` | `MODERATE` | Anémie palustre |

---

### 3.3 Risque de Réhospitalisation à 30 jours (`readmission-risk-v1`)

#### 📌 En fonction de quoi l'IA prédit :
- **Historique Médical & Séjour** : Nombre d'hospitalisations récentes (`nbHospitalisationsRecentes`), Durée du séjour actuel en jours (`dureeSejourJours`), Nombre de comorbidités associées (`comorbiditesCount`).
- **Autonomie & État Général** : Score d'autonomie (`autonomie` en %), Score de Glasgow (`scoreGlasgow`), IMC (`bmi`), Âge.

#### 📊 Seuils Physiologiques et Impacts Analysés par l'IA :

| Variable (`feature`) | Valeur / Seuil Détecté | Impact Identifié | Explication clinique |
| :--- | :--- | :--- | :--- |
| `nbHospitalisationsRecentes` | `>= 2` | `HIGH` | Réhospitalisations multiples récentes |
| `dureeSejourJours` | `>= 7 jours` | `MODERATE` | Séjour prolongé générateur de fragilité |
| `comorbiditesCount` | `>= 3` | `HIGH` | Polypathologie complexe |
| `autonomie` | `< 60 %` | `MODERATE` | Perte d'autonomie fonctionnelle |

---

### 3.4 Risque de Décompensation Cardiovasculaire (`cardiovascular-risk-v1`)

#### 📌 En fonction de quoi l'IA prédit :
- **Tension Artérielle & Pouls** : Pression Systolique (mmHg), Pression Diastolique (mmHg), Fréquence Cardiaque (bpm).
- **Métabolisme & Biométrie** : IMC / BMI (kg/m²), Cholestérol (mmol/L), Diabète (`diabete` 0/1), Tabagisme (`tabagisme` 0/1), Âge.

#### 📊 Seuils Physiologiques et Impacts Analysés par l'IA :

| Variable (`feature`) | Valeur / Seuil Détecté | Impact Identifié | Explication clinique |
| :--- | :--- | :--- | :--- |
| `pressionSystolique` | `>= 160 mmHg` | `CRITICAL` | Hypertension systolique de Grade 2/3 |
| `pressionSystolique` | `>= 140 mmHg` | `HIGH` | Hypertension systolique modérée |
| `pressionDiastolique` | `>= 100 mmHg` | `CRITICAL` | Hypertension diastolique sévère |
| `pressionDiastolique` | `>= 90 mmHg` | `HIGH` | Hypertension diastolique modérée |
| `bmi` | `>= 30 kg/m²` | `MODERATE` | Obésité (Facteur de risque cardiovasculaire) |

---

### 3.5 Détection d'Anomalies Biologiques Multi-organes (`lab-anomaly-detection-v1`)

#### 📌 En fonction de quoi l'IA prédit :
- **Bilan Régal & Hépatique** : Créatininémie (µmol/L), Bilirubinémie totale (µmol/L).
- **Bilan Inflammatoire & Hématologique** : Protéine C-Réactive / CRP (mg/L), Leucocytes (/mm³), Plaquettes (/mm³), Hémoglobine (g/dL).
- **Ionogramme Sanguin** : Potassium (mmol/L), Natrémie / Sodium (mmol/L).

#### 📊 Seuils Physiologiques et Impacts Analysés par l'IA :

| Variable (`feature`) | Valeur / Seuil Détecté | Impact Identifié | Explication clinique |
| :--- | :--- | :--- | :--- |
| `creatinine` | `> 130 µmol/L` | `HIGH` | Insuffisance rénale aiguë / chronique |
| `bilirubine` | `> 35 µmol/L` | `HIGH` | Hyperbilirubinémie (Atteinte hépatique / Ictère) |
| `crp` | `> 50 mg/L` | `HIGH` | Syndrome inflammatoire majeur |
| `plaquettes` | `< 100 000 /mm³` | `HIGH` | Thrombopénie sévère |

---

## 4. Alimentation des Données : Modes Direct & FHIR (LOINC)

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
| `2160-0` | Creatinine [Mass/volume] in Serum/Plasma | `creatinine` |
| `1975-2` | Bilirubin.total [Mass/volume] in Serum/Plasma | `bilirubine` |
| `1988-5` | C reactive protein [Mass/volume] in Serum/Plasma | `crp` |

---

## 5. Structure de la Requête de Prédiction (API Request)

### 5.1 Endpoints HTTP

- **Route via Nginx Gateway** : `POST http://localhost:5030/api/diagnosis/predict`
- **Route Directe Service** : `POST http://localhost:3007/predict`
- **En-têtes (Headers)** :
  ```http
  Content-Type: application/json
  Authorization: Bearer <accessToken>
  ```

---

### 5.2 Schéma JSON de la Requête (`PredictionRequest`)

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
| `features` | `object` | Optionnel* | Dictionnaire clé-valeur contenant les constantes et mesures. |
| `observationIds` | `array[str]`| Optionnel* | Liste des identifiants des ressources `Observation` enregistrées dans FHIR. |

*\* Note : Il est recommandé de fournir au moins `features` ou `observationIds`.*

---

### 5.3 Exemples de Requêtes

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
    "age": 54
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

---

## 6. Structure de la Réponse de Prédiction (API Response & FHIR)

L'API répond avec une structure JSON standardisée contenant le résultat explicable et une ressource FHIR **`RiskAssessment`**.

### 6.1 Schéma JSON de la Réponse (`PredictionResponse`)

| Champ | Type | Description |
| :--- | :--- | :--- |
| `success` | `boolean` | Indique le succès du traitement (`true`). |
| `inferenceId` | `string` | UUID unique de la prédiction générée (ex: `inf-a1b2c3d4...`). |
| `timestamp` | `string` | Horodatage ISO 8601 de l'inférence (UTC). |
| `nomModele` | `string` | Modèle utilisé pour la prédiction. |
| `modelVersion` | `string` | Version du modèle ML entraîné (ex: `1.0.0`). |
| `patientId` | `string` | Identifiant du patient évalué. |
| `prediction.scoreProbabilite` | `float` | Score de probabilité calculé par le modèle (0.00 à 1.00). |
| `prediction.niveauRisque` | `string` | Niveau de risque qualitatif (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`). |
| `prediction.intituleDiagnostic` | `string` | Titre/Diagnostic généré par l'IA. |
| `prediction.facteursContributifs`| `array[object]`| Liste détaillée des facteurs ayant influencé la décision avec leur impact. |
| `prediction.recommandations` | `array[string]`| Actions cliniques recommandées au praticien. |
| `fhirResource` | `object` | Ressource HL7/FHIR `RiskAssessment` prête à l'archivage. |

---

### 6.2 Exemple de Réponse Complète avec FHIR `RiskAssessment`

```json
{
  "success": true,
  "inferenceId": "inf-8f7b2c1a-4d3e-9b8a-7c6f-5e4d3c2b1a0f",
  "timestamp": "2026-09-09T11:00:00.000000+00:00",
  "nomModele": "sepsis-risk-v1",
  "modelVersion": "1.0.0",
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

## 7. Exemples de Commandes cURL

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
      "hemoglobine": 10.2
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
      "plaquettes": 90000
    }
  }'
```
