-- ============================================================
-- fhir-service : Migration initiale
-- Table générique fhir_resources pour toutes les ressources FHIR R4
-- Index GIN pour recherches JSONB performantes
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Table générique FHIR Resources ──────────────────────────────────────
-- Stocke l'intégralité du JSON de chaque ressource FHIR dans la colonne `content`.
-- Les colonnes dénormalisées permettent des filtres rapides sans passer par le JSONB.

CREATE TABLE IF NOT EXISTS fhir_resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type   VARCHAR(64) NOT NULL,          -- ex: 'Patient', 'Encounter'
    fhir_id         VARCHAR(36) NOT NULL,           -- id déclaré dans la ressource FHIR
    content         JSONB NOT NULL,                 -- ressource FHIR complète
    subject_id      VARCHAR(36),                    -- fhirId du Patient (dénormalisé)
    encounter_id    VARCHAR(36),                    -- fhirId de l'Encounter (dénormalisé)
    practitioner_id VARCHAR(36),                    -- fhirId du Practitioner principal
    organization_id VARCHAR(36),                    -- fhirId de l'Organization
    status          VARCHAR(32),                    -- status dénormalisé pour filtres
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_fhir_resource_type_id UNIQUE (resource_type, fhir_id)
);

-- ─── Index de recherche ────────────────────────────────────────────────────

-- Index principal : par type de ressource
CREATE INDEX IF NOT EXISTS idx_fhir_resource_type
    ON fhir_resources(resource_type);

-- Index patient (pour récupérer toutes les ressources d'un patient)
CREATE INDEX IF NOT EXISTS idx_fhir_subject_id
    ON fhir_resources(subject_id)
    WHERE subject_id IS NOT NULL;

-- Index encounter
CREATE INDEX IF NOT EXISTS idx_fhir_encounter_id
    ON fhir_resources(encounter_id)
    WHERE encounter_id IS NOT NULL;

-- Index praticien
CREATE INDEX IF NOT EXISTS idx_fhir_practitioner_id
    ON fhir_resources(practitioner_id)
    WHERE practitioner_id IS NOT NULL;

-- Index organisation
CREATE INDEX IF NOT EXISTS idx_fhir_organization_id
    ON fhir_resources(organization_id)
    WHERE organization_id IS NOT NULL;

-- Index statut
CREATE INDEX IF NOT EXISTS idx_fhir_status
    ON fhir_resources(status)
    WHERE status IS NOT NULL;

-- Index combiné (type + patient) — requête la plus fréquente
CREATE INDEX IF NOT EXISTS idx_fhir_type_subject
    ON fhir_resources(resource_type, subject_id);

-- Index temporel
CREATE INDEX IF NOT EXISTS idx_fhir_last_updated
    ON fhir_resources(last_updated DESC);

-- Index GIN sur le contenu JSONB — permet jsonpath, @>, ?, etc.
CREATE INDEX IF NOT EXISTS idx_fhir_content_gin
    ON fhir_resources USING GIN (content);

-- Index GIN sur les paths courants (optimisation supplémentaire)
CREATE INDEX IF NOT EXISTS idx_fhir_content_status
    ON fhir_resources USING GIN ((content->'status'));

-- ─── Vue pratique par type de ressource ─────────────────────────────────

CREATE OR REPLACE VIEW v_patients AS
    SELECT id, fhir_id, content, last_updated
    FROM fhir_resources
    WHERE resource_type = 'Patient';

CREATE OR REPLACE VIEW v_encounters AS
    SELECT id, fhir_id, content, subject_id, last_updated
    FROM fhir_resources
    WHERE resource_type = 'Encounter';

CREATE OR REPLACE VIEW v_observations AS
    SELECT id, fhir_id, content, subject_id, encounter_id, status, last_updated
    FROM fhir_resources
    WHERE resource_type = 'Observation';

CREATE OR REPLACE VIEW v_conditions AS
    SELECT id, fhir_id, content, subject_id, encounter_id, last_updated
    FROM fhir_resources
    WHERE resource_type = 'Condition';

CREATE OR REPLACE VIEW v_medication_requests AS
    SELECT id, fhir_id, content, subject_id, encounter_id, status, last_updated
    FROM fhir_resources
    WHERE resource_type = 'MedicationRequest';

CREATE OR REPLACE VIEW v_diagnostic_reports AS
    SELECT id, fhir_id, content, subject_id, status, last_updated
    FROM fhir_resources
    WHERE resource_type = 'DiagnosticReport';

-- ─── Trigger updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_fhir_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_fhir_last_updated
    BEFORE UPDATE ON fhir_resources
    FOR EACH ROW EXECUTE FUNCTION trigger_set_fhir_updated_at();
