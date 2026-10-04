-- ============================================================
-- audit-service : Migration initiale
-- Tables : audit_events (dénormalisé + JSONB FHIR),
--          access_logs (détails techniques)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── AuditEvents (journal standardisé FHIR AuditEvent) ───────────────────
CREATE TABLE IF NOT EXISTS audit_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fhir_id           VARCHAR(36) UNIQUE,            -- id FHIR si sync fhir-service

    -- Champs dénormalisés pour filtres rapides
    action            CHAR(1) CHECK (action IN ('C','R','U','D','E')),
    recorded          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome           CHAR(2) NOT NULL DEFAULT '0'
                      CHECK (outcome IN ('0','4','8','12')),
    outcome_desc      TEXT,

    -- Agent
    agent_user_id     VARCHAR(36),                   -- userId auth-service
    agent_nom         VARCHAR(200),                  -- dénormalisé
    agent_ip          INET,
    agent_requestor   BOOLEAN NOT NULL DEFAULT TRUE,

    -- Entité concernée
    entity_reference  VARCHAR(100),                  -- ex: 'Patient/uuid'
    entity_type       VARCHAR(64),                   -- resourceType FHIR
    entity_nom        VARCHAR(255),

    -- Type d'événement
    type_code         VARCHAR(50) NOT NULL,
    type_display      VARCHAR(150),
    subtype_code      VARCHAR(50),
    subtype_display   VARCHAR(150),

    -- Source
    source_observer   VARCHAR(100),                  -- service émetteur

    -- Payload FHIR complet (pour conformité complète)
    fhir_content      JSONB,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index temporel (requête la plus fréquente)
CREATE INDEX IF NOT EXISTS idx_audit_recorded     ON audit_events(recorded DESC);
-- Index par utilisateur (recherche qui a fait quoi)
CREATE INDEX IF NOT EXISTS idx_audit_agent_user   ON audit_events(agent_user_id) WHERE agent_user_id IS NOT NULL;
-- Index par entité (recherche sur quel patient / ressource)
CREATE INDEX IF NOT EXISTS idx_audit_entity_ref   ON audit_events(entity_reference) WHERE entity_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_entity_type  ON audit_events(entity_type) WHERE entity_type IS NOT NULL;
-- Index par type d'action
CREATE INDEX IF NOT EXISTS idx_audit_action       ON audit_events(action) WHERE action IS NOT NULL;
-- Index par outcome (filtrer les erreurs)
CREATE INDEX IF NOT EXISTS idx_audit_outcome      ON audit_events(outcome);
-- Index GIN pour recherches JSONB
CREATE INDEX IF NOT EXISTS idx_audit_fhir_gin     ON audit_events USING GIN (fhir_content)
    WHERE fhir_content IS NOT NULL;

-- ─── AccessLogs (journaux techniques détaillés) ──────────────────────────
CREATE TABLE IF NOT EXISTS access_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(36),                     -- nullable (non authentifié)
    session_id      VARCHAR(36),
    ip              INET NOT NULL,
    poste_id        VARCHAR(36),
    user_agent      TEXT,
    methode         VARCHAR(10) NOT NULL
                    CHECK (methode IN ('GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD')),
    endpoint        VARCHAR(500) NOT NULL,
    service         VARCHAR(100) NOT NULL,
    status_code     SMALLINT NOT NULL,
    duree_ms        INTEGER,
    body_size       INTEGER,
    response_size   INTEGER,
    date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partitionnement par mois recommandé en production — ici on crée juste les index
CREATE INDEX IF NOT EXISTS idx_access_date        ON access_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_access_user        ON access_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_ip          ON access_logs(ip);
CREATE INDEX IF NOT EXISTS idx_access_service     ON access_logs(service);
CREATE INDEX IF NOT EXISTS idx_access_status      ON access_logs(status_code);
-- Index pour détecter les erreurs 5xx
CREATE INDEX IF NOT EXISTS idx_access_errors      ON access_logs(service, date DESC)
    WHERE status_code >= 500;

-- ─── Vue : résumé des accès par utilisateur (dernières 24h) ──────────────
CREATE OR REPLACE VIEW v_user_activity_24h AS
    SELECT
        user_id,
        COUNT(*) AS nb_requetes,
        COUNT(DISTINCT endpoint) AS nb_endpoints,
        MIN(date) AS premiere_requete,
        MAX(date) AS derniere_requete,
        array_agg(DISTINCT service ORDER BY service) AS services_accedes
    FROM access_logs
    WHERE date >= NOW() - INTERVAL '24 hours'
      AND user_id IS NOT NULL
    GROUP BY user_id;
