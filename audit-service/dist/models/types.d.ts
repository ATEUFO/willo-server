/**
 * audit-service — Modèles
 * FHIR : AuditEvent (journal standardisé HL7 FHIR R4)
 * Custom : AccessLog (détails techniques complémentaires)
 */
export type ActionAudit = 'C' | 'R' | 'U' | 'D' | 'E';
export type OutcomeAudit = '0' | '4' | '8' | '12';
export interface FhirCoding {
    system?: string;
    code?: string;
    display?: string;
}
export interface FhirReference {
    reference?: string;
    display?: string;
}
/** Enregistrement AuditEvent stocké en base (dénormalisé + JSONB complet) */
export interface AuditEvent {
    id: string;
    fhirId?: string;
    action?: ActionAudit;
    recorded: Date;
    outcome: OutcomeAudit;
    outcomeDesc?: string;
    agentUserId?: string;
    agentNom?: string;
    agentIp?: string;
    agentRequestor: boolean;
    entityReference?: string;
    entityType?: string;
    entityNom?: string;
    typeCode: string;
    typeDisplay?: string;
    subtypeCode?: string;
    subtypeDisplay?: string;
    sourceObserver?: string;
    fhirContent?: Record<string, unknown>;
    createdAt: Date;
}
export interface CreateAuditEventDto {
    action?: ActionAudit;
    outcome?: OutcomeAudit;
    outcomeDesc?: string;
    agentUserId?: string;
    agentNom?: string;
    agentIp?: string;
    agentRequestor?: boolean;
    entityReference?: string;
    entityType?: string;
    entityNom?: string;
    typeCode: string;
    typeDisplay?: string;
    subtypeCode?: string;
    subtypeDisplay?: string;
    sourceObserver?: string;
    fhirContent?: Record<string, unknown>;
}
export type MéthodeHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export interface AccessLog {
    id: string;
    userId?: string;
    sessionId?: string;
    ip: string;
    posteId?: string;
    userAgent?: string;
    méthode: MéthodeHttp;
    endpoint: string;
    service: string;
    statusCode: number;
    duréeMs?: number;
    bodySize?: number;
    responseSize?: number;
    date: Date;
    createdAt: Date;
}
export interface CreateAccessLogDto {
    userId?: string;
    sessionId?: string;
    ip: string;
    posteId?: string;
    userAgent?: string;
    méthode: MéthodeHttp;
    endpoint: string;
    service: string;
    statusCode: number;
    duréeMs?: number;
    bodySize?: number;
    responseSize?: number;
}
export interface AuditQueryFilters {
    userId?: string;
    entityReference?: string;
    entityType?: string;
    action?: ActionAudit;
    outcome?: OutcomeAudit;
    service?: string;
    dateDebut?: Date;
    dateFin?: Date;
    page?: number;
    limit?: number;
}
export interface AuditQueryResult {
    data: AuditEvent[];
    total: number;
    page: number;
    limit: number;
}
//# sourceMappingURL=types.d.ts.map