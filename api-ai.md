# 🤖 Documentation API - Service d'Inférence et Diagnostic IA (`ai-diagnosis-service`)

Ce document constitue le guide d'utilisation complet de l'API REST du service de diagnostic médical basé sur l'IA (**Willo AI Diagnosis Microservice**).

---

## 📌 1. Vue d'Ensemble

Le microservice d'IA fournit des prédictions médicales explicables basées sur des modèles d'arbres de décision (*DecisionTreeClassifier* via Scikit-Learn). Il s'intègre nativement avec la norme **HL7 FHIR** en générant automatiquement des ressources `RiskAssessment`.

### Architecture & URLs de Base

- **Port Direct Microservice** : `http://localhost:3007`
- **Reverse Proxy Gateway (Nginx)** : `http://localhost:5030/api/diagnosis`

| Environnement | URL de Base API |
| :--- | :--- |
| **Via Nginx Proxy** | `http://localhost:5030/api/diagnosis` |
| **Direct Local / Dev** | `http://localhost:3007` |

---

## 🚀 2. Endpoints HTTP de l'API

### 2.1 Vérification d'État (Healthcheck)

Vérifie que le service IA est fonctionnel et indique le nombre de modèles chargés.

- **Méthode** : `GET`
- **URL** : `/api/diagnosis/health` (ou `/health`)

#### Exemple de Réponse (200 OK)
```json
{
  "status": "OK",
  "service": "ai-diagnosis-service",
  "port": 3007,
  "models_loaded": 5
}
```

---

### 2.2 Liste des Modèles IA Disponibles

Retourne la liste des 5 modèles de prédiction chargés, leurs versions, leurs paramètres et leurs métriques de performance.

- **Méthode** : `GET`
- **URL** : `/api/diagnosis/models` (ou `/models`)

#### Exemple de Réponse (200 OK)
```json
{
  "success": true,
  "models": [
    {
      "nomModele": "sepsis-risk-v1",
      "version": "1.2.0",
      "max_depth": 5,
      "features": [
        "temperature", "frequenceCardiaque", "pressionSystolique", "pressionDiastolique",
        "frequenceRespiratoire", "saturationO2", "leucocytes", "lactate",
        "scoreGlasgow", "plaquettes", "crp", "age", "sexe"
      ],
      "metrics": {
        "accuracy": 0.945,
        "precision": 0.946,
        "recall": 0.945,
        "f1_score": 0.945
      },
      "feature_importances": {
        "lactate": 0.312,
        "pressionSystolique": 0.245,
        "temperature": 0.184
      }
    }
  ]
}
```

---

### 2.3 Exécuter une Prédiction Médicale

Calcule le score de risque, le niveau de risque qualitatif (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`), les facteurs contributifs et génère une ressource FHIR `RiskAssessment`.

- **Méthode** : `POST`
- **URL** : `/api/diagnosis/predict` (ou `/predict`)
- **Headers** : `Content-Type: application/json`

#### Corps de la Requête (`PredictionRequest`)

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
  },
  "observationIds": []
}
```

#### Description des Paramètres de Requête

| Champ | Type | Obligatoire | Description |
| :--- | :--- | :--- | :--- |
| `nomModele` | `string` | **Oui** | Nom du modèle (`sepsis-risk-v1`, `malaria-risk-v1`, `readmission-risk-v1`, `cardiovascular-risk-v1`, `lab-anomaly-detection-v1`) |
| `patientId` | `string` | **Oui** | Identifiant / UUID du patient |
| `encounterId` | `string` | Non | UUID du séjour / consultation hospitalière |
| `features` | `object` | Optionnel | Dictionnaire clé-valeur des constantes et bilans physiologiques |
| `observationIds` | `array[str]` | Optionnel | Liste d'IDs d'observations FHIR à récupérer automatiquement auprès du `fhir-service` |

---

#### Exemple de Réponse (200 OK)

```json
{
  "success": true,
  "inferenceId": "inf-8f7b2c1a-4d3e-9b8a-7c6f-5e4d3c2b1a0f",
  "timestamp": "2026-09-10T06:45:00.000000+00:00",
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
    "occurrenceDateTime": "2026-09-10T06:45:00.000000+00:00",
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
        }
      }
    ]
  }
}
```

---

### 2.4 Ré-entraîner les Modèles ML

Ré-entraîne automatiquement l'ensemble des 5 modèles à partir des générateurs de données cliniques et recharge le moteur d'inférence en mémoire sans interruption de service.

- **Méthode** : `POST`
- **URL** : `/api/diagnosis/train` (ou `/train`)

#### Exemple de Réponse (200 OK)
```json
{
  "success": true,
  "message": "Tous les modèles de diagnostic ont été ré-entraînés et sauvegardés.",
  "trained_models": {
    "sepsis-risk-v1": { "accuracy": 0.945, "f1_score": 0.945 },
    "malaria-risk-v1": { "accuracy": 0.962, "f1_score": 0.961 }
  }
}
```

---

## 📊 3. Catalogue des 5 Modèles d'IA

| Nom du Modèle (`nomModele`) | Titre Médical | Clés de Caractéristiques Attendues (`features`) |
| :--- | :--- | :--- |
| `sepsis-risk-v1` | **Risque de Sepsis / Choc Septique** | `temperature`, `frequenceCardiaque`, `pressionSystolique`, `pressionDiastolique`, `frequenceRespiratoire`, `saturationO2`, `leucocytes`, `lactate`, `scoreGlasgow`, `plaquettes`, `crp`, `age`, `sexe` |
| `malaria-risk-v1` | **Probabilité de Paludisme** | `temperature`, `frequenceCardiaque`, `age`, `tdrMalaria` (0/1), `plaquettes`, `hemoglobine`, `sexe`, `dureeSymptomesJours` |
| `readmission-risk-v1` | **Risque de Réhospitalisation (30j)** | `age`, `nbHospitalisationsRecentes`, `dureeSejourJours`, `comorbiditesCount`, `scoreGlasgow`, `bmi`, `autonomie` |
| `cardiovascular-risk-v1` | **Risque Cardiovasculaire** | `pressionSystolique`, `pressionDiastolique`, `frequenceCardiaque`, `age`, `bmi`, `diabete` (0/1), `tabagisme` (0/1), `cholesterol` |
| `lab-anomaly-detection-v1` | **Anomalies Biologiques Multi-organes** | `creatinine`, `leucocytes`, `plaquettes`, `bilirubine`, `crp`, `hemoglobine`, `potassium`, `natremie` |

---

## 🧬 4. Intégration Automatique FHIR (Codes LOINC)

En fournissant `observationIds`, l'IA résout automatiquement les ressources `Observation` auprès du service FHIR grâce aux codes LOINC suivants :

| Code LOINC FHIR | Variable IA (`feature`) | Unité Habituelle |
| :--- | :--- | :--- |
| `8310-5` | `temperature` | °C |
| `8867-4` | `frequenceCardiaque` | bpm |
| `8480-6` | `pressionSystolique` | mmHg |
| `8462-4` | `pressionDiastolique` | mmHg |
| `9279-1` | `frequenceRespiratoire` | cycles/min |
| `2708-6` | `saturationO2` | % |
| `6690-2` | `leucocytes` | /mm³ |
| `777-3` | `plaquettes` | /mm³ |
| `2160-0` | `creatinine` | µmol/L |
| `1975-2` | `bilirubine` | µmol/L |
| `1988-5` | `crp` | mg/L |

---

## 💻 5. Exemples d'Intégration (Code)

### Exemple cURL
```bash
curl -X POST http://localhost:5030/api/diagnosis/predict \
  -H "Content-Type: application/json" \
  -d '{
    "nomModele": "malaria-risk-v1",
    "patientId": "pat-12345",
    "features": {
      "temperature": 39.4,
      "tdrMalaria": 1.0,
      "plaquettes": 110000,
      "hemoglobine": 10.2
    }
  }'
```

### Exemple TypeScript / Axios (Client React / Electron)
```typescript
import axios from 'axios';

interface PredictionPayload {
  nomModele: string;
  patientId: string;
  encounterId?: string;
  features?: Record<string, number>;
  observationIds?: string[];
}

export async function evaluerRisqueSepsis(patientId: string, constantes: Record<string, number>) {
  const response = await axios.post('http://localhost:5030/api/diagnosis/predict', {
    nomModele: 'sepsis-risk-v1',
    patientId: patientId,
    features: constantes
  });

  return response.data;
}
```

### Exemple Python (`requests`)
```python
import requests

url = "http://localhost:3007/predict"
payload = {
    "nomModele": "cardiovascular-risk-v1",
    "patientId": "pat-9988",
    "features": {
        "pressionSystolique": 165,
        "pressionDiastolique": 102,
        "bmi": 31.5,
        "tabagisme": 1
    }
}

response = requests.post(url, json=payload)
print(response.json())
```
