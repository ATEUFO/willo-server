/**
 * audit-service — Modèles
 * FHIR : AuditEvent (journal standardisé HL7 FHIR R4)
 * Custom : AccessLog (détails techniques complémentaires)
 */

// ─── Types FHIR AuditEvent (dénormalisé pour requêtes rapides) ───────────

export type ActionAudit = 'C' | 'R' | 'U' | 'D' | 'E'; // Create, Read, Update, Delete, Execute
export type OutcomeAudit = '0' | '4' | '8' | '12';      // Success, Minor, Serious, Major failure

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
  id: string;                  // UUID interne
  fhirId?: string;             // id FHIR si synchronisé vers fhir-service
  // Champs dénormalisés pour filtres rapides
  action?: ActionAudit;
  recorded: Date;
  outcome: OutcomeAudit;
  outcomeDesc?: string;
  // Agent principal
  agentUserId?: string;        // userId auth-service
  agentNom?: string;           // nom dénormalisé
  agentIp?: string;
  agentRequestor: boolean;
  // Entité concernée
  entityReference?: string;    // ex: "Patient/uuid", "Encounter/uuid"
  entityType?: string;         // resourceType FHIR
  entityNom?: string;
  // Type d'événement
  typeCode: string;            // code DICOM / FHIR AuditEvent type
  typeDisplay?: string;
  subtypeCode?: string;
  subtypeDisplay?: string;
  // Source
  sourceObserver?: string;     // service émetteur ex: "fhir-service"
  // Payload complet FHIR (pour conformité)
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

// ─── AccessLog (Custom — détails techniques) ──────────────────────────────

export type MéthodeHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface AccessLog {
  id: string;                  // UUID
  userId?: string;             // FK auth-service (null si non authentifié)
  sessionId?: string;          // FK Session
  ip: string;
  posteId?: string;            // FK Poste auth-service
  userAgent?: string;
  méthode: MéthodeHttp;
  endpoint: string;            // ex: "/api/patients/uuid"
  service: string;             // service cible ex: "fhir-service"
  statusCode: number;          // code de réponse HTTP
  duréeMs?: number;            // temps de traitement en ms
  bodySize?: number;           // taille de la requête en bytes
  responseSize?: number;       // taille de la réponse en bytes
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

// ─── Requêtes d'audit ─────────────────────────────────────────────────────

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
