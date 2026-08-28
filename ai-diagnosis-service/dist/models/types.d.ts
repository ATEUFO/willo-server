/**
 * ai-diagnosis-service — Modèles
 * FHIR : RiskAssessment (résultat exposé au dossier patient via fhir-service)
 * Custom : ModelVersion, InferenceLog
 */
export interface FhirReference {
    reference: string;
    display?: string;
}
export interface FhirCodeableConcept {
    coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
    }>;
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
        qualitativeRisk?: string;
        rationale?: string;
    }>;
    mitigation?: string;
    modelVersionId: string;
    inferenceLogId: string;
}
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
    id: string;
    nomModèle: string;
    version: string;
    description?: string;
    statut: StatutModèle;
    dateEntraînement: Date;
    dateDeploiement?: Date;
    dateDépréciation?: Date;
    hashFichierONNX: string;
    cheminFichier: string;
    métadonées?: Record<string, unknown>;
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
export type StatutInférence = 'succès' | 'erreur' | 'timeout' | 'dégradé';
export interface InferenceInput {
    observationIds?: string[];
    conditionIds?: string[];
    patientAge?: number;
    patientSexe?: 'M' | 'F';
    featuresRaw?: Record<string, unknown>;
}
export interface InferenceOutput {
    scores: Array<{
        label: string;
        score: number;
        interprétation?: string;
    }>;
    topLabel?: string;
    confidence?: number;
    tempsInférenceMs?: number;
    warnings?: string[];
}
export interface InferenceLog {
    id: string;
    modelVersionId: string;
    patientId: string;
    encounterId?: string;
    requestedById?: string;
    entréesUtilisées: InferenceInput;
    sortie: InferenceOutput | null;
    statut: StatutInférence;
    erreurMessage?: string;
    fhirRiskAssessmentId?: string;
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
//# sourceMappingURL=types.d.ts.map