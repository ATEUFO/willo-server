/**
 * labo-service — Modèles
 * FHIR : ServiceRequest, Specimen, DiagnosticReport, Observation (proxied via fhir-service)
 * Custom : TestCatalog (référentiel local du laboratoire)
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
/** Résumé d'un ServiceRequest (demande d'examen) reçu par le labo */
export interface LaboServiceRequest {
    id: string;
    fhirId: string;
    patientId: string;
    encounterId?: string;
    practitionerId?: string;
    code?: FhirCodeableConcept;
    priority?: 'routine' | 'urgent' | 'asap' | 'stat';
    status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
    authoredOn?: string;
    note?: string;
}
/** Résumé d'un Specimen (échantillon) */
export interface LaboSpecimen {
    id: string;
    fhirId: string;
    patientId: string;
    serviceRequestId?: string;
    type?: FhirCodeableConcept;
    collectedDateTime?: string;
    receivedTime?: string;
    status?: 'available' | 'unavailable' | 'unsatisfactory' | 'entered-in-error';
}
/** Résumé d'un Observation (résultat de mesure) */
export interface LaboObservation {
    id: string;
    fhirId: string;
    patientId: string;
    encounterId?: string;
    code: FhirCodeableConcept;
    status: string;
    effectiveDateTime?: string;
    valueQuantity?: {
        value?: number;
        unit?: string;
    };
    valueString?: string;
    referenceRange?: Array<{
        low?: number;
        high?: number;
        unit?: string;
        text?: string;
    }>;
    interpretation?: string;
}
/** Résumé d'un DiagnosticReport (compte rendu d'examen) */
export interface LaboDiagnosticReport {
    id: string;
    fhirId: string;
    patientId: string;
    serviceRequestId?: string;
    status: string;
    code: FhirCodeableConcept;
    effectiveDateTime?: string;
    issued?: string;
    conclusion?: string;
    observationIds: string[];
}
export interface ValeurReference {
    sexe?: 'M' | 'F' | 'tous';
    âgeMin?: number;
    âgeMax?: number;
    min?: number;
    max?: number;
    unité: string;
    commentaire?: string;
}
export interface TestCatalog {
    id: string;
    nomExamen: string;
    code: string;
    système?: string;
    catégorie?: string;
    délaiEstimé?: number;
    prix?: number;
    valeursRéférence: ValeurReference[];
    actif: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateTestCatalogDto {
    nomExamen: string;
    code: string;
    système?: string;
    catégorie?: string;
    délaiEstimé?: number;
    prix?: number;
    valeursRéférence?: ValeurReference[];
}
export interface UpdateTestCatalogDto {
    nomExamen?: string;
    code?: string;
    système?: string;
    catégorie?: string;
    délaiEstimé?: number;
    prix?: number;
    valeursRéférence?: ValeurReference[];
    actif?: boolean;
}
//# sourceMappingURL=types.d.ts.map