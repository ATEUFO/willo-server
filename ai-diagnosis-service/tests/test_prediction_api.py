import pytest
from fastapi.testclient import TestClient
from src.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert data["service"] == "ai-diagnosis-service"
    assert data["models_loaded"] >= 5


def test_list_models(client):
    response = client.get("/models")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    model_names = [m["nomModele"] for m in data["models"]]
    assert "sepsis-risk-v1" in model_names
    assert "malaria-risk-v1" in model_names
    assert "readmission-risk-v1" in model_names
    assert "cardiovascular-risk-v1" in model_names
    assert "lab-anomaly-detection-v1" in model_names


def test_predict_sepsis_critical(client):
    payload = {
        "nomModele": "sepsis-risk-v1",
        "patientId": "pat-test-001",
        "encounterId": "enc-test-001",
        "features": {
            "temperature": 39.2,
            "frequenceCardiaque": 125,
            "pressionSystolique": 85,
            "pressionDiastolique": 55,
            "frequenceRespiratoire": 28,
            "saturationO2": 90,
            "leucocytes": 18500,
            "lactate": 4.5,
            "age": 62
        }
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["nomModele"] == "sepsis-risk-v1"
    assert data["patientId"] == "pat-test-001"
    
    pred = data["prediction"]
    assert pred["niveauRisque"] in ["HIGH", "CRITICAL"]
    assert 0.0 <= pred["scoreProbabilite"] <= 1.0
    assert len(pred["facteursContributifs"]) > 0
    assert len(pred["recommandations"]) > 0
    
    fhir = data["fhirResource"]
    assert fhir["resourceType"] == "RiskAssessment"
    assert fhir["subject"]["reference"] == "Patient/pat-test-001"
    assert fhir["prediction"][0]["outcome"]["coding"][0]["code"] == "91302008"


def test_predict_malaria_positive(client):
    payload = {
        "nomModele": "malaria-risk-v1",
        "patientId": "pat-test-002",
        "features": {
            "temperature": 39.5,
            "frequenceCardiaque": 110,
            "age": 28,
            "tdrMalaria": 1,
            "plaquettes": 92000
        }
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["prediction"]["niveauRisque"] == "HIGH"
    assert data["fhirResource"]["prediction"][0]["outcome"]["coding"][0]["code"] == "61462000"


def test_predict_invalid_model(client):
    payload = {
        "nomModele": "unknown-model-v99",
        "patientId": "pat-test-003",
        "features": {}
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 400
    assert "Modèle non trouvé" in response.json()["detail"]
