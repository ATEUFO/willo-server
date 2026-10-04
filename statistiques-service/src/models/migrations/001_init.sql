-- ============================================================
-- statistiques-service : Migration initiale
-- Tables custom : indicators, report_snapshots
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Indicators (définitions des indicateurs) ─────────────────────────────
CREATE TABLE IF NOT EXISTS indicators (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom              VARCHAR(255) NOT NULL,
    description      TEXT,
    type             VARCHAR(20) NOT NULL
                     CHECK (type IN ('count','sum','average','ratio','rate','custom')),
    formule          TEXT,                           -- requête SQL ou expression
    sources          JSONB NOT NULL DEFAULT '[]',    -- IndicatorSource[]
    unite            VARCHAR(50),
    periodicite      VARCHAR(20) NOT NULL
                     CHECK (periodicite IN ('journalière','hebdomadaire','mensuelle',
                                            'trimestrielle','annuelle','ponctuelle')),
    categorie        VARCHAR(100),
    site_scope       TEXT[] DEFAULT '{}',            -- [] = tous les sites
    actif            BOOLEAN NOT NULL DEFAULT TRUE,
    ordre_affichage  INTEGER DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indicators_categorie ON indicators(categorie) WHERE categorie IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_indicators_actif     ON indicators(actif);
CREATE INDEX IF NOT EXISTS idx_indicators_ordre     ON indicators(ordre_affichage);

-- ─── ReportSnapshots (résultats calculés) ────────────────────────────────
CREATE TABLE IF NOT EXISTS report_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_id    UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
    periode         VARCHAR(20) NOT NULL,            -- ex: '2024-01', '2024-W03', '2024'
    date_debut      DATE NOT NULL,
    date_fin        DATE NOT NULL,
    valeur          NUMERIC(20, 4),                  -- null si erreur
    valeur_detail   JSONB,                           -- ventilation optionnelle
    statut          VARCHAR(15) NOT NULL DEFAULT 'en_cours'
                    CHECK (statut IN ('en_cours','prêt','erreur')),
    erreur          TEXT,
    genere_par_id   VARCHAR(36),                     -- userId ou 'system'
    date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_snapshot_indicator_periode UNIQUE (indicator_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_indicator  ON report_snapshots(indicator_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_periode    ON report_snapshots(periode);
CREATE INDEX IF NOT EXISTS idx_snapshots_date       ON report_snapshots(date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_statut     ON report_snapshots(statut);

-- ─── Vue : derniers snapshots par indicateur ─────────────────────────────
CREATE OR REPLACE VIEW v_latest_snapshots AS
    SELECT DISTINCT ON (indicator_id)
        rs.*,
        i.nom        AS indicator_nom,
        i.categorie  AS indicator_categorie,
        i.unite      AS indicator_unite
    FROM report_snapshots rs
    JOIN indicators i ON i.id = rs.indicator_id
    WHERE rs.statut = 'prêt'
    ORDER BY indicator_id, rs.date DESC;

-- ─── Trigger updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON indicators
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
