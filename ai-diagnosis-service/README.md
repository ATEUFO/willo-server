# Willo AI Diagnosis Service 🤖🏥

Microservice d'inférence médicale et de prédiction clinique basé sur **FastAPI**, **Scikit-learn** et intégré au système d'information hospitalier **Willo** (norme FHIR & PostgreSQL).

---

## 📋 Table des matières

1. [Présentation](#-présentation)
2. [Prérequis](#-prérequis)
3. [Installation et Lancement en Local](#-installation-et-lancement-en-local)
   - [1. Se positionner dans le dossier](#1-se-positionner-dans-le-dossier)
   - [2. Créer l'environnement virtuel](#2-créer-lenvironnement-virtuel)
   - [3. Installer les dépendances](#3-installer-les-dépendances)
   - [4. Configurer les variables d'environnement](#4-configurer-les-variables-denvironnement)
   - [5. Lancer les tests unitaires](#5-lancer-les-tests-unitaires)
   - [6. Démarrer le serveur FastAPI en local](#6-démarrer-le-serveur-fastapi-en-local)
4. [Lancement avec Docker](#-lancement-avec-docker)
   - [1. Conteneur isolé (Docker CLI)](#1-conteneur-isolé-docker-cli)
   - [2. Stack complète (Docker Compose)](#2-stack-complète-docker-compose)
5. [Endpoints API & Documentation](#-endpoints-api--documentation)
6. [Structure du Projet](#-structure-du-projet)

---

## 💡 Présentation

Le microservice **AI Diagnosis Service** propose des prédictions médicales basées sur des modèles d'arbre de décision (*DecisionTreeClassifier*) pré-entraînés pour :
- Évaluation du risque de **Sepsis** (`sepsis-risk-v1`)
- Évaluation du risque de **Paludisme / Malaria** (`malaria-risk-v1`)
- Évaluation du risque de **Réadmission à 30 jours** (`readmission-risk-v1`)
- Évaluation du risque **Cardiovasculaire** (`cardiovascular-risk-v1`)
- Détection des **Anomalies de laboratoire** (`lab-anomaly-detection-v1`)

---

## ⚙️ Prérequis

- **Python 3.11+** ou **3.12+**
- **pip** (gestionnaire de paquets Python)
- **Docker** & **Docker Compose** (pour le déploiement conteneurisé)
- *(Optionnel)* Base de données PostgreSQL en cours d'exécution

---

## 🚀 Installation et Lancement en Local

### 1. Se positionner dans le dossier

```bash
cd ai-diagnosis-service
```

### 2. Créer l'environnement virtuel

```bash
python3 -m venv venv
```

Activez l'environnement virtuel :

- **Linux / macOS** :
  ```bash
  source venv/bin/activate
  ```
- **Windows (PowerShell)** :
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```

### 3. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 4. Configurer les variables d'environnement

Copiez le fichier d'exemple `.env.example` vers `.env` :

```bash
cp .env.example .env
```

Vous pouvez modifier `.env` selon vos besoins (par exemple la variable `PORT` ou les identifiants PostgreSQL) :

```env
PORT=3007
AI_PORT=3007

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=sih_admin
POSTGRES_PASSWORD=change_me_in_production
POSTGRES_DB=sih_db
AI_DATABASE_URL=postgresql://sih_admin:change_me_in_production@localhost:5432/sih_db?schema=ai
```

### 5. Lancer les tests unitaires

Vérifiez le bon fonctionnement de l'application et du modèle d'inférence en exécutant les tests :

```bash
python -m pytest
```

---

### 6. Démarrer le serveur FastAPI en local

Deux options s'offrent à vous pour lancer le serveur :

#### Option A : Via Python
```bash
python src/main.py
```

#### Option B : Via Uvicorn (avec auto-reload)
```bash
uvicorn src.main:app --host 0.0.0.0 --port 3007 --reload
```

Le serveur sera accessible sur **http://localhost:3007**.

---

## 🐳 Lancement avec Docker

### 1. Conteneur isolé (Docker CLI)

#### Construction de l'image Docker
```bash
docker build -t ai-diagnosis-service .
```

#### Exécution du conteneur
```bash
docker run -d \
  --name ai-diagnosis-service \
  -p 3007:3007 \
  --env-file .env \
  ai-diagnosis-service
```

Le service sera disponible sur **http://localhost:3007**.

---

### 2. Stack complète (Docker Compose)

Depuis la racine du projet global `willo-server` :

#### Lancer uniquement le microservice AI et ses dépendances :
```bash
docker compose up -d --build ai-diagnosis-service
```

#### Lancer toute la suite de microservices Willo :
```bash
docker compose up -d --build
```

---

## 📖 Endpoints API & Documentation

Lorsque le serveur tourne, la documentation Swagger / OpenAPI interactive est générée automatiquement :

- **Documentation Swagger UI** : [http://localhost:3007/docs](http://localhost:3007/docs)
- **Documentation ReDoc** : [http://localhost:3007/redoc](http://localhost:3007/redoc)

### Endpoints Principaux :

| Méthode | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Healthcheck du service et nombre de modèles chargés |
| `GET` | `/models` | Liste des modèles d'IA disponibles |
| `POST` | `/predict` | Effectuer une prédiction de risque médical |
| `POST` | `/train` | Déclencher le ré-entraînement de tous les modèles ML |

---

## 📁 Structure du Projet

```
ai-diagnosis-service/
├── .env                    # Variables d'environnement locales (non commité)
├── .env.example            # Template de configuration d'environnement
├── Dockerfile              # Fichier de build Docker du microservice
├── pytest.ini              # Configuration de Pytest (pythonpath)
├── requirements.txt        # Dépendances Python du projet
├── README.md               # Documentation du projet
├── src/
│   ├── main.py             # Point d'entrée principal FastAPI
│   ├── db/                 # Connexion et logs en base de données PostgreSQL
│   ├── ml/                 # Inférence ML, générateurs de dataset & entraînements
│   └── schemas/            # Schémas de validation Pydantic (Request/Response)
└── tests/                  # Tests unitaires et d'intégration API
```
