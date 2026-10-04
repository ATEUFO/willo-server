-- ============================================================
-- file-service : Migration initiale
-- Table : file_metadata (index des fichiers stockés dans MinIO)
-- Note : DocumentReference, ImagingStudy, Binary sont des
--        ressources FHIR créées dans fhir-service après upload.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── FileMetadata ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_metadata (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fhir_document_reference_id   VARCHAR(36),        -- fhirId DocumentReference (fhir-service)
    fhir_imaging_study_id        VARCHAR(36),        -- fhirId ImagingStudy (si DICOM)
    patient_id                   VARCHAR(36),        -- fhirId Patient
    encounter_id                 VARCHAR(36),        -- fhirId Encounter
    minio_key                    VARCHAR(500) NOT NULL UNIQUE,
                                                     -- chemin MinIO ex: 'patients/uuid/docs/uuid.pdf'
    minio_bucket                 VARCHAR(100) NOT NULL DEFAULT 'willo-files',
    file_name                    VARCHAR(255) NOT NULL,
    content_type                 VARCHAR(120) NOT NULL,
    type_fichier                 VARCHAR(20) NOT NULL DEFAULT 'document'
                                 CHECK (type_fichier IN ('document','image','dicom','audio','video','autre')),
    size                         BIGINT NOT NULL,    -- taille en bytes
    hash                         VARCHAR(128),       -- SHA-256 hex
    uploade_par_id               VARCHAR(36),        -- userId auth-service
    tags                         TEXT[] DEFAULT '{}',
    actif                        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index patient (tous les fichiers d'un patient)
CREATE INDEX IF NOT EXISTS idx_file_patient   ON file_metadata(patient_id) WHERE patient_id IS NOT NULL;
-- Index encounter
CREATE INDEX IF NOT EXISTS idx_file_encounter ON file_metadata(encounter_id) WHERE encounter_id IS NOT NULL;
-- Index type de fichier
CREATE INDEX IF NOT EXISTS idx_file_type      ON file_metadata(type_fichier);
-- Index FHIR
CREATE INDEX IF NOT EXISTS idx_file_doc_ref   ON file_metadata(fhir_document_reference_id) WHERE fhir_document_reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_imaging   ON file_metadata(fhir_imaging_study_id) WHERE fhir_imaging_study_id IS NOT NULL;
-- Index MinIO key (déjà UNIQUE, mais utile pour confirms rapides)
CREATE INDEX IF NOT EXISTS idx_file_minio_key ON file_metadata(minio_key);
-- Index actif + patient
CREATE INDEX IF NOT EXISTS idx_file_actif_patient ON file_metadata(patient_id, actif, created_at DESC);
-- Index tags GIN
CREATE INDEX IF NOT EXISTS idx_file_tags_gin  ON file_metadata USING GIN (tags);

-- ─── Vue : fichiers actifs par patient ───────────────────────────────────
CREATE OR REPLACE VIEW v_patient_files AS
    SELECT
        fm.*,
        -- Construit l'URL interne du service pour téléchargement
        '/files/' || fm.id || '/download' AS download_endpoint
    FROM file_metadata fm
    WHERE fm.actif = TRUE
    ORDER BY fm.created_at DESC;

-- ─── Trigger updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON file_metadata
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
