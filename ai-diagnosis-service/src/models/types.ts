/**
 * ai-diagnosis-service — Modèles
 * FHIR : RiskAssessment (résultat exposé au dossier patient via fhir-service)
 * Custom : ModelVersion, InferenceLog
 */

// ─── Références FHIR légères ───────────────────────────────────────────────

export interface FhirReference {
  reference: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: Array<{ system?: string; code?: string; display?: string }>;
  text?: string;
}

/** Résumé d'un RiskAssessment FHIR produit par l'IA */
export interface AiRiskAssessment {
  id: string;
  fhirId: string;
  patientId: string;
  encounterId?: string;
  status: string;
  occurrenceDateTime?: string;
  predictions: Array<{
    outcome?: FhirCodeableConcept;
    probabilityDecimal?: number;
    qualitativeRisk?: string;  // 'faible' | 'modéré' | 'élevé' | 'critique'
    rationale?: string;
  }>;
  mitigation?: string;
  modelVersionId: string;      // FK → ModelVersion
  inferenceLogId: string;      // FK → InferenceLog
}

// ─── ModelVersion (Custom) ────────────────────────────────────────────────

export type StatutModèle = 'entraînement' | 'validé' | 'déployé' | 'déprécié' | 'retiré';

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  cohortSize?: number;
  validationDate?: string;
  notes?: string;
}

export interface ModelVersion {
  id: string;                  // UUID
  nomModèle: string;           // ex: "sepsis-risk", "malaria-diagnosis", "maternal-risk"
  version: string;             // SemVer ex: "1.2.0"
  description?: string;
  statut: StatutModèle;
  dateEntraînement: Date;
  dateDeploiement?: Date;
  dateDépréciation?: Date;
  hashFichierONNX: string;     // SHA-256 du fichier modèle ONNX
  cheminFichier: string;       // chemin vers le fichier .onnx (MinIO ou FS local)
  métadonées?: Record<string, unknown>; // hyperparamètres, dataset info...
  métriques: ModelMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateModelVersionDto {
  nomModèle: string;
  version: string;
  description?: string;
  dateEntraînement: Date;
  hashFichierONNX: string;
  cheminFichier: string;
  métadonées?: Record<string, unknown>;
  métriques?: ModelMetrics;
}

// ─── InferenceLog (Custom) ────────────────────────────────────────────────

export type StatutInférence = 'succès' | 'erreur' | 'timeout' | 'dégradé';

export interface InferenceInput {
  observationIds?: string[];   // fhirIds des Observations utilisées
  conditionIds?: string[];     // fhirIds des Conditions
  patientAge?: number;
  patientSexe?: 'M' | 'F';
  featuresRaw?: Record<string, unknown>; // vecteur brut envoyé au modèle
}

export interface InferenceOutput {
  scores: Array<{
    label: string;
    score: number;             // probabilité [0, 1]
    interprétation?: string;
  }>;
  topLabel?: string;
  confidence?: number;
  tempsInférenceMs?: number;
  warnings?: string[];
}

export interface InferenceLog {
  id: string;                  // UUID
  modelVersionId: string;      // FK → ModelVersion
  patientId: string;           // fhirId du Patient
  encounterId?: string;        // fhirId de l'Encounter (contexte)
  requestedById?: string;      // userId du praticien ayant déclenché l'analyse
  entréesUtilisées: InferenceInput;
  sortie: InferenceOutput | null;
  statut: StatutInférence;
  erreurMessage?: string;
  fhirRiskAssessmentId?: string; // fhirId du RiskAssessment créé en sortie
  dateExécution: Date;
  createdAt: Date;
}

export interface CreateInferenceLogDto {
  modelVersionId: string;
  patientId: string;
  encounterId?: string;
  requestedById?: string;
  entréesUtilisées: InferenceInput;
}
