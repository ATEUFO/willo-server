-- ============================================================
-- facturation-service : Migration initiale
-- Tables custom : tarif_actes, invoices, invoice_lines, payments
-- Note : Claim, ClaimResponse, Coverage → gérés dans fhir-service
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Séquence pour numéros de factures ───────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- ─── TarifActes (référentiel tarifaire) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS tarif_actes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_acte        VARCHAR(50) NOT NULL,
    libelle          VARCHAR(255) NOT NULL,
    service          VARCHAR(100) NOT NULL,         -- ex: 'consultation', 'labo', 'imagerie'
    prix             NUMERIC(14, 2) NOT NULL,
    devise           VARCHAR(5) NOT NULL DEFAULT 'XOF',
    tva_applicable   BOOLEAN NOT NULL DEFAULT FALSE,
    taux_tva         NUMERIC(5, 2) DEFAULT 0,       -- en %
    actif            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tarif_code_service UNIQUE (code_acte, service)
);

CREATE INDEX IF NOT EXISTS idx_tarif_actes_service ON tarif_actes(service);
CREATE INDEX IF NOT EXISTS idx_tarif_actes_actif   ON tarif_actes(actif);

-- ─── Invoices (factures) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero           VARCHAR(30) NOT NULL UNIQUE
                     DEFAULT ('FAC-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                              LPAD(nextval('invoice_number_seq')::TEXT, 5, '0')),
    patient_id       VARCHAR(36) NOT NULL,           -- fhirId Patient
    encounter_id     VARCHAR(36),                    -- fhirId Encounter
    claim_id         VARCHAR(36),                    -- fhirId Claim
    montant_ht       NUMERIC(14, 2) NOT NULL DEFAULT 0,
    montant_tva      NUMERIC(14, 2) NOT NULL DEFAULT 0,
    montant_total    NUMERIC(14, 2) NOT NULL DEFAULT 0,
    devise           VARCHAR(5) NOT NULL DEFAULT 'XOF',
    statut           VARCHAR(20) NOT NULL DEFAULT 'brouillon'
                     CHECK (statut IN ('brouillon','émise','partielle','payée','annulée','impayée')),
    part_assurance   NUMERIC(14, 2) NOT NULL DEFAULT 0,
    part_patient     NUMERIC(14, 2) NOT NULL DEFAULT 0,
    date_emission    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_echeance    DATE,
    date_annulation  TIMESTAMPTZ,
    notes            TEXT,
    cree_par_id      VARCHAR(36) NOT NULL,           -- userId auth-service
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_patient     ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_encounter   ON invoices(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_statut      ON invoices(statut);
CREATE INDEX IF NOT EXISTS idx_invoices_emission    ON invoices(date_emission DESC);

-- ─── Invoice Lines (lignes de facture) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    tarif_acte_id   UUID REFERENCES tarif_actes(id) ON DELETE SET NULL,
    description     VARCHAR(255) NOT NULL,
    quantite        INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
    prix_unitaire   NUMERIC(14, 2) NOT NULL,
    remise          NUMERIC(5, 2) DEFAULT 0,         -- en %
    montant_ht      NUMERIC(14, 2) NOT NULL,
    montant_ttc     NUMERIC(14, 2) NOT NULL,
    service         VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- ─── Payments (paiements) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    montant             NUMERIC(14, 2) NOT NULL CHECK (montant > 0),
    devise              VARCHAR(5) NOT NULL DEFAULT 'XOF',
    mode                VARCHAR(20) NOT NULL
                        CHECK (mode IN ('espèces','mobile_money','assurance','virement','carte','chèque')),
    reference_externe   VARCHAR(100),               -- numéro de transaction
    date                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id             VARCHAR(36) NOT NULL,        -- caissier, userId auth-service
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice  ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_mode     ON payments(mode);
CREATE INDEX IF NOT EXISTS idx_payments_date     ON payments(date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user     ON payments(user_id);

-- ─── Vue : solde des factures ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_invoice_balance AS
    SELECT
        i.id,
        i.numero,
        i.patient_id,
        i.montant_total,
        i.part_patient,
        i.statut,
        COALESCE(SUM(p.montant), 0) AS montant_paye,
        i.part_patient - COALESCE(SUM(p.montant), 0) AS reste_a_payer
    FROM invoices i
    LEFT JOIN payments p ON p.invoice_id = i.id
    GROUP BY i.id;

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
  FOREACH t IN ARRAY ARRAY['tarif_actes', 'invoices'] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', t);
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
