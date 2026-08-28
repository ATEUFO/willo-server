-- ============================================================
-- ai-diagnosis-service : Migration initiale
-- Tables custom : model_versions, inference_logs
-- Note : RiskAssessment FHIR est créé dans fhir-service en sortie
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ModelVersions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom_modele          VARCHAR(100) NOT NULL,
    version             VARCHAR(20)  NOT NULL,           -- SemVer ex: '1.2.0'
    description         TEXT,
    statut              VARCHAR(20) NOT NULL DEFAULT 'entraînement'
                        CHECK (statut IN ('entraînement','validé','déployé','déprécié','retiré')),
    date_entrainement   DATE NOT NULL,
    date_deploiement    TIMESTAMPTZ,
    date_depreciation   TIMESTAMPTZ,
    hash_fichier_onnx   VARCHAR(128) NOT NULL,           -- SHA-256 hex
    chemin_fichier      VARCHAR(500) NOT NULL,            -- chemin MinIO / FS
    metadonnees         JSONB DEFAULT '{}',              -- hyperparamètres, dataset info
    metriques           JSONB NOT NULL DEFAULT '{}',     -- ModelMetrics
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_model_version UNIQUE (nom_modele, version)
);

CREATE INDEX IF NOT EXISTS idx_model_versions_nom    ON model_versions(nom_modele);
CREATE INDEX IF NOT EXISTS idx_model_versions_statut ON model_versions(statut);
CREATE INDEX IF NOT EXISTS idx_model_versions_date   ON model_versions(date_entrainement DESC);
-- Index partiel : modèles actuellement déployés (requête la plus courante)
CREATE INDEX IF NOT EXISTS idx_model_versions_deployed
    ON model_versions(nom_modele, date_deploiement DESC)
    WHERE statut = 'déployé';

-- ─── InferenceLogs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inference_logs (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_version_id          UUID NOT NULL REFERENCES model_versions(id) ON DELETE RESTRICT,
    patient_id                VARCHAR(36) NOT NULL,       -- fhirId Patient
    encounter_id              VARCHAR(36),                -- fhirId Encounter
    requested_by_id           VARCHAR(36),                -- userId auth-service
    entrees_utilisees         JSONB NOT NULL DEFAULT '{}',-- InferenceInput
    sortie                    JSONB,                      -- InferenceOutput | null
    statut                    VARCHAR(15) NOT NULL DEFAULT 'succès'
                              CHECK (statut IN ('succès','erreur','timeout','dégradé')),
    erreur_message            TEXT,
    fhir_risk_assessment_id   VARCHAR(36),                -- fhirId RiskAssessment créé
    date_execution            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inference_patient  ON inference_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_inference_model    ON inference_logs(model_version_id);
CREATE INDEX IF NOT EXISTS idx_inference_date     ON inference_logs(date_execution DESC);
CREATE INDEX IF NOT EXISTS idx_inference_statut   ON inference_logs(statut);
CREATE INDEX IF NOT EXISTS idx_inference_encounter ON inference_logs(encounter_id)
    WHERE encounter_id IS NOT NULL;

-- Index GIN pour recherches dans les entrées/sorties
CREATE INDEX IF NOT EXISTS idx_inference_entrees_gin
    ON inference_logs USING GIN (entrees_utilisees);
CREATE INDEX IF NOT EXISTS idx_inference_sortie_gin
    ON inference_logs USING GIN (sortie)
    WHERE sortie IS NOT NULL;

-- ─── Vue : dernière inférence par patient (par modèle) ───────────────────
CREATE OR REPLACE VIEW v_last_inference_per_patient AS
    SELECT DISTINCT ON (patient_id, model_version_id)
        il.*,
        mv.nom_modele,
        mv.version AS model_version
    FROM inference_logs il
    JOIN model_versions mv ON mv.id = il.model_version_id
    WHERE il.statut = 'succès'
    ORDER BY patient_id, model_version_id, date_execution DESC;

-- ─── Trigger updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON model_versions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
