-- ============================================================
-- notification-service : Migration initiale
-- Tables custom : notification_templates, notifications,
--                 sms_messages, notification_preferences
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── NotificationTemplates ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50) NOT NULL UNIQUE,
    canal       VARCHAR(20) NOT NULL
                CHECK (canal IN ('websocket','sms','email','ussd','push')),
    sujet       VARCHAR(255),                        -- pour canal email
    contenu     TEXT NOT NULL,
    variables   TEXT[] NOT NULL DEFAULT '{}',
    actif       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_code  ON notification_templates(code);
CREATE INDEX IF NOT EXISTS idx_templates_canal ON notification_templates(canal);

-- Seed de templates de base
INSERT INTO notification_templates (code, canal, sujet, contenu, variables) VALUES
  ('RDVCONFIRME',   'sms',       NULL,
   'Bonjour {{prenom}}, votre RDV du {{date}} à {{heure}} au {{service}} est confirmé.',
   ARRAY['prenom','date','heure','service']),
  ('RDVRAPPEL',     'sms',       NULL,
   'Rappel : votre RDV est demain {{date}} à {{heure}}. Centre : {{centre}}.',
   ARRAY['date','heure','centre']),
  ('ALERTESTOCK',   'websocket', NULL,
   '⚠️ Stock bas : {{medicament}} ({{quantite}} {{unite}} restants).',
   ARRAY['medicament','quantite','unite']),
  ('RESULTATLABO',  'websocket', NULL,
   'Les résultats du patient {{patientNom}} ({{examens}}) sont disponibles.',
   ARRAY['patientNom','examens']),
  ('NEWUSER',       'email',     'Bienvenue sur Willo',
   'Bonjour {{prenom}} {{nom}},\n\nVotre compte a été créé. Identifiant : {{email}}.',
   ARRAY['prenom','nom','email'])
ON CONFLICT (code) DO NOTHING;

-- ─── Notifications ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destinataire_id     VARCHAR(36) NOT NULL,        -- userId ou patientId
    type_destinataire   VARCHAR(10) NOT NULL DEFAULT 'user'
                        CHECK (type_destinataire IN ('user','patient')),
    canal               VARCHAR(20) NOT NULL
                        CHECK (canal IN ('websocket','sms','email','ussd','push')),
    template_id         UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    sujet               VARCHAR(255),
    message             TEXT NOT NULL,
    priorite            VARCHAR(10) NOT NULL DEFAULT 'normale'
                        CHECK (priorite IN ('basse','normale','haute','urgente')),
    statut              VARCHAR(15) NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente','envoyée','délivrée','lue','échec','expirée')),
    tentatives          INTEGER NOT NULL DEFAULT 0,
    tentative_max       INTEGER NOT NULL DEFAULT 3,
    date_envoi          TIMESTAMPTZ,
    date_expiration     TIMESTAMPTZ,
    metadonnees         JSONB DEFAULT '{}',
    erreur_message      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_destinataire ON notifications(destinataire_id);
CREATE INDEX IF NOT EXISTS idx_notifications_canal        ON notifications(canal);
CREATE INDEX IF NOT EXISTS idx_notifications_statut       ON notifications(statut);
CREATE INDEX IF NOT EXISTS idx_notifications_priorite     ON notifications(priorite);
CREATE INDEX IF NOT EXISTS idx_notifications_created      ON notifications(created_at DESC);
-- Index pour la file d'envoi : notifications en attente d'envoi
CREATE INDEX IF NOT EXISTS idx_notifications_queue
    ON notifications(priorite DESC, created_at)
    WHERE statut = 'en_attente';

-- ─── SmsMessages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_messages (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id      UUID REFERENCES notifications(id) ON DELETE SET NULL,
    numero               VARCHAR(20) NOT NULL,       -- E.164
    contenu              TEXT NOT NULL,
    statut_envoi         VARCHAR(15) NOT NULL DEFAULT 'en_attente'
                         CHECK (statut_envoi IN ('en_attente','envoyé','délivré','échec','inconnu')),
    operateur            VARCHAR(20)
                         CHECK (operateur IN ('orange','mtn','moov','free','autre')),
    reference_operateur  VARCHAR(100),
    date_envoi           TIMESTAMPTZ,
    date_delivrance      TIMESTAMPTZ,
    erreur_message       TEXT,
    cout                 NUMERIC(8, 4),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_notification ON sms_messages(notification_id) WHERE notification_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_numero       ON sms_messages(numero);
CREATE INDEX IF NOT EXISTS idx_sms_statut       ON sms_messages(statut_envoi);
CREATE INDEX IF NOT EXISTS idx_sms_date         ON sms_messages(date_envoi DESC);

-- ─── NotificationPreferences ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        VARCHAR(36) NOT NULL,
    canal          VARCHAR(20) NOT NULL
                   CHECK (canal IN ('websocket','sms','email','ussd','push')),
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    heures_actives JSONB,                            -- { debut: "07:00", fin: "20:00" }
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pref_user_canal UNIQUE (user_id, canal)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id);

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
  FOREACH t IN ARRAY ARRAY['notification_templates','notifications','sms_messages','notification_preferences'] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', t);
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
