from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    nomModele: str = Field(..., json_schema_extra={"example": "sepsis-risk-v1"}, description="Nom du modèle IA à interroger")
    patientId: str = Field(..., json_schema_extra={"example": "pat-uuid-99"}, description="UUID ou ID du patient")
    encounterId: Optional[str] = Field(None, json_schema_extra={"example": "enc-uuid-12"}, description="UUID de la consultation / hospitalisation")
    features: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Vecteur de caractéristiques (constantes, labo, etc.)")
    observationIds: Optional[List[str]] = Field(default_factory=list, description="Liste d'identifiants de ressources FHIR Observation")


class FacteurContributif(BaseModel):
    feature: str
    valeur: Any
    impact: str = Field(..., json_schema_extra={"example": "HIGH"})
    explication: str


class PredictionResult(BaseModel):
    scoreProbabilite: float = Field(..., json_schema_extra={"example": 0.84})
    niveauRisque: str = Field(..., json_schema_extra={"example": "HIGH"})
    intituleDiagnostic: str = Field(..., json_schema_extra={"example": "Risque Élevé de Sepsis / Choc Septique"})
    facteursContributifs: List[FacteurContributif] = Field(default_factory=list)
    recommandations: List[str] = Field(default_factory=list)


class PredictionResponse(BaseModel):
    success: bool = True
    inferenceId: str
    timestamp: str
    nomModele: str
    modelVersion: str
    patientId: str
    prediction: PredictionResult
    fhirResource: Dict[str, Any]
