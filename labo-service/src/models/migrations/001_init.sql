-- ============================================================
-- labo-service : Migration initiale
-- Table custom : test_catalog
-- Note : ServiceRequest, Specimen, DiagnosticReport, Observation
--        sont gérés dans fhir-service.
--        Le labo conserve une table locale légère pour le suivi
--        des demandes en cours (cache de statut).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TestCatalog (référentiel local des examens du labo) ──────────────────
CREATE TABLE IF NOT EXISTS test_catalog (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom_examen        VARCHAR(255) NOT NULL,
    code              VARCHAR(50)  NOT NULL,
    systeme           VARCHAR(150),               -- ex: 'http://loinc.org', 'local'
    categorie         VARCHAR(100),               -- ex: 'hématologie', 'biochimie'
    delai_estime      INTEGER,                    -- délai en heures
    prix              NUMERIC(12, 2),
    valeurs_reference JSONB NOT NULL DEFAULT '[]',
                                                  -- tableau ValeurReference
    actif             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_test_catalog_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_test_catalog_code      ON test_catalog(code);
CREATE INDEX IF NOT EXISTS idx_test_catalog_categorie ON test_catalog(categorie)
    WHERE categorie IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_catalog_actif     ON test_catalog(actif);

-- ─── Table de suivi local des demandes (cache de statut FHIR) ────────────
-- Évite d'interroger fhir-service à chaque affichage de la liste d'attente.
CREATE TABLE IF NOT EXISTS labo_request_status (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fhir_service_request_id VARCHAR(36) NOT NULL UNIQUE,
    fhir_specimen_id     VARCHAR(36),
    fhir_report_id       VARCHAR(36),
    patient_id           VARCHAR(36) NOT NULL,
    test_catalog_id      UUID REFERENCES test_catalog(id) ON DELETE SET NULL,
    statut               VARCHAR(30) NOT NULL DEFAULT 'reçue',
                         -- reçue | prélevée | en_cours | validée | livrée | annulée
    priorite             VARCHAR(10) DEFAULT 'routine',
    received_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validated_at         TIMESTAMPTZ,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labo_status_patient  ON labo_request_status(patient_id);
CREATE INDEX IF NOT EXISTS idx_labo_status_statut   ON labo_request_status(statut);
CREATE INDEX IF NOT EXISTS idx_labo_status_received ON labo_request_status(received_at DESC);

-- ─── Trigger updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['test_catalog', 'labo_request_status'] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', t);
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
