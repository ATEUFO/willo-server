import os
import time
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
import httpx

load_dotenv()

PORT = int(os.getenv("PORT", os.getenv("AI_PORT", "3007")))


from src.schemas.prediction import PredictionRequest, PredictionResponse
from src.ml.inference import InferenceEngine
from src.ml.trainer import train_all_models, SAVED_MODELS_DIR
from src.db.database import init_ai_schema, record_model_version, log_inference

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ai_diagnosis_service")

engine: InferenceEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    logger.info("Starting AI Diagnosis Microservice...")
    
    # Check if models exist, if not, train them automatically
    engine = InferenceEngine(SAVED_MODELS_DIR)
    if len(engine.list_available_models()) == 0:
        logger.info("No pre-trained models found. Triggering automated model training...")
        train_all_models(SAVED_MODELS_DIR)
        engine.reload()
    
    # Initialize DB Schema and register model versions
    try:
        await init_ai_schema()
        for meta in engine.list_available_models():
            await record_model_version(
                nom_modele=meta["nomModele"],
                version=meta.get("version", "1.0.0"),
                fichier_onnx=meta.get("model_file", f"{meta['nomModele']}.joblib")
            )
    except Exception as e:
        logger.warning(f"Database initialization warning: {e}")

    logger.info(f"AI Diagnosis Service ready on port {PORT}. Loaded {len(engine.list_available_models())} ML models.")
    yield
    logger.info("Shutting down AI Diagnosis Microservice...")


app = FastAPI(
    title="Willo AI Diagnosis Service",
    description="Microservice d'inférence médicale et de prédiction clinique basé sur scikit-learn & FHIR",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def fetch_fhir_observations(observation_ids: list[str]) -> Dict[str, float]:
    extracted_features = {}
    if not observation_ids:
        return extracted_features

    configured_fhir_url = os.getenv("FHIR_SERVICE_URL")
    candidate_urls = [configured_fhir_url] if configured_fhir_url else ["http://fhir-service:3002", "http://localhost:3002"]

    async with httpx.AsyncClient(timeout=3.0) as client:
        for obs_id in observation_ids:
            for base_url in candidate_urls:
                try:
                    resp = await client.get(f"{base_url.rstrip('/')}/Observation/{obs_id}")
                    if resp.status_code == 200:
                        data = resp.json()
                        # Parse FHIR Observation code & valueQuantity
                        code = data.get("code", {}).get("coding", [{}])[0].get("code", "")
                        val = data.get("valueQuantity", {}).get("value")
                        if code and val is not None:
                            # Map common FHIR LOINC codes to feature keys
                            code_mapping = {
                                "8310-5": "temperature",
                                "8867-4": "frequenceCardiaque",
                                "2708-6": "saturationO2",
                                "9279-1": "frequenceRespiratoire",
                                "8480-6": "pressionSystolique",
                                "8462-4": "pressionDiastolique",
                                "6690-2": "leucocytes",
                                "777-3": "plaquettes",
                                "2571-8": "triglycerides",
                                "2160-0": "creatinine",
                                "1975-2": "bilirubine",
                                "1988-5": "crp"
                            }
                            feat_name = code_mapping.get(code)
                            if feat_name:
                                extracted_features[feat_name] = float(val)
                        break
                except Exception as e:
                    logger.debug(f"Could not fetch observation {obs_id} from {base_url}: {e}")
    return extracted_features


@app.get("/health", summary="Healthcheck endpoint")
@app.get("/api/diagnosis/health", summary="Healthcheck endpoint (Proxy)")
async def health_check():
    loaded = len(engine.list_available_models()) if engine else 0
    return {
        "status": "OK",
        "service": "ai-diagnosis-service",
        "port": PORT,
        "models_loaded": loaded
    }


@app.get("/models", summary="Liste des modèles d'inférence")
@app.get("/api/diagnosis/models", summary="Liste des modèles d'inférence (Proxy)")
async def list_models():
    if not engine:
        raise HTTPException(status_code=500, detail="Moteur d'inférence non initialisé")
    return {
        "success": True,
        "models": engine.list_available_models()
    }


@app.post("/predict", response_model=PredictionResponse, summary="Exécuter une prédiction médicale")
@app.post("/api/diagnosis/predict", response_model=PredictionResponse, summary="Exécuter une prédiction médicale (Proxy)")
async def predict(req: PredictionRequest):
    start_time = time.time()
    
    if not engine:
        raise HTTPException(status_code=500, detail="Moteur d'inférence non initialisé")

    # Combine direct features and FHIR observations if provided
    combined_features = dict(req.features or {})
    if req.observationIds:
        fhir_feats = await fetch_fhir_observations(req.observationIds)
        # FHIR observations fill missing keys
        for k, v in fhir_feats.items():
            if k not in combined_features:
                combined_features[k] = v

    try:
        response_data, full_feature_record = engine.predict(
            nom_modele=req.nomModele,
            patient_id=req.patientId,
            encounter_id=req.encounterId,
            input_features=combined_features
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.exception("Prediction failed unexpectedly")
        raise HTTPException(status_code=500, detail=f"Erreur d'inférence : {str(e)}")

    exec_time_ms = int((time.time() - start_time) * 1000)

    # Async audit DB log
    try:
        await log_inference(
            nom_modele=response_data["nomModele"],
            version=response_data["modelVersion"],
            patient_id=req.patientId,
            encounter_id=req.encounterId,
            input_features=full_feature_record,
            prediction_output=response_data["prediction"],
            score_probabilite=response_data["prediction"]["scoreProbabilite"],
            niveau_risque=response_data["prediction"]["niveauRisque"],
            execution_time_ms=exec_time_ms
        )
    except Exception as e:
        logger.warning(f"Could not log inference: {e}")

    return response_data


@app.post("/train", summary="Ré-entraîner tous les modèles de machine learning")
@app.post("/api/diagnosis/train", summary="Ré-entraîner tous les modèles (Proxy)")
async def retrain_models():
    try:
        results = train_all_models(SAVED_MODELS_DIR)
        engine.reload()
        
        for meta in engine.list_available_models():
            await record_model_version(
                nom_modele=meta["nomModele"],
                version=meta.get("version", "1.0.0"),
                fichier_onnx=meta.get("model_file", f"{meta['nomModele']}.joblib")
            )
            
        return {
            "success": True,
            "message": "Tous les modèles de diagnostic ont été ré-entraînés et sauvegardés.",
            "trained_models": results
        }
    except Exception as e:
        logger.exception("Retraining failed")
        raise HTTPException(status_code=500, detail=f"Erreur d'entraînement : {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=PORT, reload=True)

