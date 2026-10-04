-- ============================================================
-- pharmacie-service : Migration initiale
-- Tables custom : stock_items, stock_movements
-- Note : MedicationRequest, MedicationDispense, Medication,
--        SupplyRequest sont gérés dans fhir-service.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── StockItems ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicament_id       VARCHAR(36) NOT NULL,       -- fhirId Medication (fhir-service)
    nom_medicament      VARCHAR(255) NOT NULL,       -- dénormalisé pour affichage rapide
    lot                 VARCHAR(100) NOT NULL,
    quantite            INTEGER NOT NULL DEFAULT 0 CHECK (quantite >= 0),
    unite               VARCHAR(30) NOT NULL DEFAULT 'unité',
    date_peremption     DATE NOT NULL,
    emplacement         VARCHAR(150) NOT NULL,
    prix_unitaire       NUMERIC(12, 2),
    alerte_seuil_bas    INTEGER,                    -- alerte si quantite < seuil
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_items_medicament   ON stock_items(medicament_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_lot          ON stock_items(medicament_id, lot);
CREATE INDEX IF NOT EXISTS idx_stock_items_peremption   ON stock_items(date_peremption);
CREATE INDEX IF NOT EXISTS idx_stock_items_seuil_bas    ON stock_items(quantite, alerte_seuil_bas)
    WHERE alerte_seuil_bas IS NOT NULL;

-- ─── StockMovements ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_item_id       UUID NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
    type                VARCHAR(20) NOT NULL
                        CHECK (type IN ('entrée','sortie','ajustement','périmé','transfert','retour')),
    quantite            INTEGER NOT NULL CHECK (quantite > 0),
    quantite_avant      INTEGER NOT NULL,
    quantite_apres      INTEGER NOT NULL,
    motif               TEXT,
    reference_document  VARCHAR(36),                -- fhirId MedicationDispense / SupplyRequest
    user_id             VARCHAR(36) NOT NULL,        -- userId auth-service
    date                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_mv_item   ON stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_mv_type   ON stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_mv_date   ON stock_movements(date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_mv_user   ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_mv_ref    ON stock_movements(reference_document)
    WHERE reference_document IS NOT NULL;

-- ─── Vue : niveaux de stock courants avec alertes ─────────────────────────
CREATE OR REPLACE VIEW v_stock_alertes AS
    SELECT
        s.id,
        s.medicament_id,
        s.nom_medicament,
        s.lot,
        s.quantite,
        s.alerte_seuil_bas,
        s.date_peremption,
        s.emplacement,
        CASE
            WHEN s.alerte_seuil_bas IS NOT NULL AND s.quantite <= s.alerte_seuil_bas
            THEN TRUE ELSE FALSE
        END AS en_alerte_stock,
        CASE
            WHEN s.date_peremption <= CURRENT_DATE + INTERVAL '30 days'
            THEN TRUE ELSE FALSE
        END AS proche_peremption
    FROM stock_items s
    WHERE s.quantite > 0;

-- ─── Trigger updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON stock_items
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
