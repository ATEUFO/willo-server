/**
 * file-service — Modèles
 * FHIR : DocumentReference, ImagingStudy, Binary (métadonnées)
 * Stockage binaire réel : MinIO
 */

// ─── Types FHIR légers ─────────────────────────────────────────────────────

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

// ─── FileMetadata (Custom — index des fichiers stockés dans MinIO) ────────

export type TypeFichier =
  | 'document'      // PDF, DOCX, rapport
  | 'image'         // JPEG, PNG — photo clinique
  | 'dicom'         // DICOM — imagerie médicale
  | 'audio'         // enregistrement audio
  | 'video'         // vidéo téléconsultation
  | 'autre';

export interface FileMetadata {
  id: string;                  // UUID interne
  fhirDocumentReferenceId?: string; // fhirId du DocumentReference associé
  fhirImagingStudyId?: string;      // fhirId de l'ImagingStudy associé (si DICOM)
  patientId?: string;          // fhirId du Patient propriétaire
  encounterId?: string;        // fhirId de l'Encounter de contexte
  minioKey: string;            // chemin dans MinIO ex: "patients/uuid/docs/uuid.pdf"
  minioBucket: string;         // nom du bucket MinIO
  fileName: string;            // nom de fichier original
  contentType: string;         // MIME type ex: "application/pdf", "image/jpeg"
  typeFichier: TypeFichier;
  size: number;                // taille en bytes
  hash?: string;               // SHA-256 du fichier (intégrité)
  uploadéParId?: string;       // userId auth-service
  tags?: string[];
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFileMetadataDto {
  patientId?: string;
  encounterId?: string;
  minioKey: string;
  minioBucket: string;
  fileName: string;
  contentType: string;
  typeFichier?: TypeFichier;
  size: number;
  hash?: string;
  uploadéParId?: string;
  tags?: string[];
}

// ─── DocumentReference FHIR (résumé) ─────────────────────────────────────

export interface FhirDocumentReference {
  resourceType: 'DocumentReference';
  id?: string;
  status: 'current' | 'superseded' | 'entered-in-error';
  type?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  subject?: FhirReference;     // → Patient
  date?: string;
  author?: FhirReference[];
  description?: string;
  content: Array<{
    attachment: {
      contentType?: string;
      url?: string;            // URL signée MinIO ou endpoint file-service
      title?: string;
      size?: number;
      hash?: string;
      creation?: string;
    };
    format?: FhirCoding;
  }>;
  context?: {
    encounter?: FhirReference[];
    period?: FhirPeriod;
  };
}

// ─── ImagingStudy FHIR (résumé) ───────────────────────────────────────────

export interface FhirImagingStudy {
  resourceType: 'ImagingStudy';
  id?: string;
  status: 'registered' | 'available' | 'cancelled' | 'entered-in-error' | 'unknown';
  subject: FhirReference;      // → Patient
  encounter?: FhirReference;
  started?: string;
  numberOfSeries?: number;
  numberOfInstances?: number;
  modality?: FhirCoding[];
  description?: string;
  series?: Array<{
    uid: string;
    modality: FhirCoding;
    description?: string;
    numberOfInstances?: number;
    endpoint?: FhirReference[];
  }>;
}

// ─── Binary FHIR (pointeur vers MinIO) ───────────────────────────────────

export interface FhirBinary {
  resourceType: 'Binary';
  id?: string;
  contentType: string;
  securityContext?: FhirReference;
  // Note : le contenu n'est PAS stocké en base
  // — il est résolu via `fileMetadataId` → MinIO
  fileMetadataId: string;      // FK → FileMetadata
}

// ─── Upload request / réponse ─────────────────────────────────────────────

export interface UploadRequest {
  patientId?: string;
  encounterId?: string;
  typeFichier?: TypeFichier;
  description?: string;
  tags?: string[];
}

export interface UploadResponse {
  fileMetadata: FileMetadata;
  documentReferenceId?: string;
  presignedUrl?: string;       // URL pré-signée pour upload direct vers MinIO
}

export interface PresignedDownloadUrl {
  url: string;
  expiresAt: Date;
  fileName: string;
  contentType: string;
}
