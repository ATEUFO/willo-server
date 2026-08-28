/**
 * file-service — Modèles
 * FHIR : DocumentReference, ImagingStudy, Binary (métadonnées)
 * Stockage binaire réel : MinIO
 */
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
export type TypeFichier = 'document' | 'image' | 'dicom' | 'audio' | 'video' | 'autre';
export interface FileMetadata {
    id: string;
    fhirDocumentReferenceId?: string;
    fhirImagingStudyId?: string;
    patientId?: string;
    encounterId?: string;
    minioKey: string;
    minioBucket: string;
    fileName: string;
    contentType: string;
    typeFichier: TypeFichier;
    size: number;
    hash?: string;
    uploadéParId?: string;
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
export interface FhirDocumentReference {
    resourceType: 'DocumentReference';
    id?: string;
    status: 'current' | 'superseded' | 'entered-in-error';
    type?: FhirCodeableConcept;
    category?: FhirCodeableConcept[];
    subject?: FhirReference;
    date?: string;
    author?: FhirReference[];
    description?: string;
    content: Array<{
        attachment: {
            contentType?: string;
            url?: string;
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
export interface FhirImagingStudy {
    resourceType: 'ImagingStudy';
    id?: string;
    status: 'registered' | 'available' | 'cancelled' | 'entered-in-error' | 'unknown';
    subject: FhirReference;
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
export interface FhirBinary {
    resourceType: 'Binary';
    id?: string;
    contentType: string;
    securityContext?: FhirReference;
    fileMetadataId: string;
}
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
    presignedUrl?: string;
}
export interface PresignedDownloadUrl {
    url: string;
    expiresAt: Date;
    fileName: string;
    contentType: string;
}
//# sourceMappingURL=types.d.ts.map