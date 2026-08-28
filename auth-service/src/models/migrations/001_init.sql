-- ============================================================
-- auth-service : Migration initiale
-- Tables : sites, postes, roles, users, user_roles,
--          sessions, pairing_codes
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Sites / Centres de Santé ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(255) NOT NULL,
    region          VARCHAR(100) NOT NULL,
    district        VARCHAR(100) NOT NULL,
    adresse         TEXT NOT NULL,
    telephone       VARCHAR(30),
    email           VARCHAR(150),
    actif           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Postes de travail ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS postes (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom                   VARCHAR(255) NOT NULL,
    role_reseau           VARCHAR(10) NOT NULL CHECK (role_reseau IN ('serveur', 'client')),
    adresse_ip            INET NOT NULL,
    site_id               UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
    certificat_empreinte  VARCHAR(128),    -- SHA-256 hex du certificat TLS
    actif                 BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_postes_site_id ON postes(site_id);

-- ─── Rôles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom         VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT[] NOT NULL DEFAULT '{}',   -- tableau de chaînes permission
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed des rôles de base
INSERT INTO roles (nom, description, permissions) VALUES
  ('médecin',         'Médecin généraliste ou spécialiste',
   ARRAY['patient:read','patient:write','encounter:read','encounter:write',
         'prescription:read','prescription:write','labo:read','report:read']),
  ('infirmier',       'Infirmier / aide-soignant',
   ARRAY['patient:read','patient:write','encounter:read','encounter:write',
         'observation:write','labo:read']),
  ('pharmacien',      'Pharmacien dispensateur',
   ARRAY['prescription:read','dispensation:write','stock:read','stock:write',
         'patient:read']),
  ('laborantin',      'Technicien de laboratoire',
   ARRAY['labo:read','labo:write','patient:read','specimen:write']),
  ('accueil',         'Agent d''accueil et admissions',
   ARRAY['patient:read','patient:write','appointment:write','invoice:read']),
  ('gestionnaire',    'Gestionnaire administratif',
   ARRAY['invoice:read','invoice:write','payment:write','report:read',
         'stock:read']),
  ('admin',           'Administrateur système',
   ARRAY['patient:read','patient:write','patient:delete','user:manage',
         'config:manage','audit:read','report:read']),
  ('épidémiologiste', 'Épidémiologiste / surveillance sanitaire',
   ARRAY['patient:read','report:read','audit:read'])
ON CONFLICT (nom) DO NOTHING;

-- ─── Utilisateurs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                    VARCHAR(255) NOT NULL UNIQUE,
    password_hash            VARCHAR(255) NOT NULL,
    nom                      VARCHAR(100) NOT NULL,
    prenom                   VARCHAR(100) NOT NULL,
    telephone                VARCHAR(30),
    poste_rattache_id        UUID REFERENCES postes(id) ON DELETE SET NULL,
    site_id                  UUID REFERENCES sites(id) ON DELETE SET NULL,
    fhir_practitioner_id     VARCHAR(36),          -- fhirId Practitioner (fhir-service)
    actif                    BOOLEAN NOT NULL DEFAULT TRUE,
    derniere_connexion        TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_site_id    ON users(site_id);
CREATE INDEX IF NOT EXISTS idx_users_actif      ON users(actif);

-- ─── Table de liaison Users ↔ Roles ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id      UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by  UUID,                             -- userId de l'admin
    PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- ─── Sessions / Refresh Tokens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token  VARCHAR(512) NOT NULL UNIQUE,  -- hash bcrypt du token
    expires_at     TIMESTAMPTZ NOT NULL,
    poste_id       UUID REFERENCES postes(id) ON DELETE SET NULL,
    ip             INET NOT NULL,
    user_agent     TEXT,
    actif          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ─── Pairing Codes (appairage réseau) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS pairing_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(16) NOT NULL UNIQUE,
    poste_appaire_id UUID REFERENCES postes(id) ON DELETE SET NULL,
    site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    expires_at      TIMESTAMPTZ NOT NULL,
    utilise         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pairing_codes_code       ON pairing_codes(code);
CREATE INDEX IF NOT EXISTS idx_pairing_codes_expires_at ON pairing_codes(expires_at);

-- ─── Trigger : updated_at automatique ────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sites', 'postes', 'roles', 'users'] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', t);
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
