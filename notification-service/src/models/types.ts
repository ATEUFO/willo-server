/**
 * notification-service — Modèles Custom
 * Notifications multi-canal : WebSocket, SMS, Email, USSD.
 */

// ─── Canal de notification ────────────────────────────────────────────────

export type CanalNotification = 'websocket' | 'sms' | 'email' | 'ussd' | 'push';

export type PrioritéNotification = 'basse' | 'normale' | 'haute' | 'urgente';

export type StatutNotification =
  | 'en_attente'
  | 'envoyée'
  | 'délivrée'
  | 'lue'
  | 'échec'
  | 'expirée';

// ─── NotificationTemplate ─────────────────────────────────────────────────

export interface NotificationTemplate {
  id: string;                  // UUID
  code: string;                // identifiant unique, ex: "RDVCONFIRME", "ALERTESTOCK"
  canal: CanalNotification;
  sujet?: string;              // pour email
  contenu: string;             // template avec variables {{nom}}, {{date}}...
  variables: string[];         // liste des variables attendues ex: ["nom", "date", "service"]
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationTemplateDto {
  code: string;
  canal: CanalNotification;
  sujet?: string;
  contenu: string;
  variables?: string[];
}

// ─── Notification ─────────────────────────────────────────────────────────

export interface Notification {
  id: string;                  // UUID
  destinataireId: string;      // userId auth-service (ou patientId pour portail patient)
  typeDestinataire: 'user' | 'patient';
  canal: CanalNotification;
  templateId?: string;         // FK → NotificationTemplate (si templated)
  sujet?: string;
  message: string;             // message final après interpolation du template
  priorité: PrioritéNotification;
  statut: StatutNotification;
  tentatives: number;          // nombre de tentatives d'envoi
  tentativeMax: number;        // max avant abandon
  dateEnvoi?: Date;            // date d'envoi effectif
  dateExpiration?: Date;       // date après laquelle la notif est expirée
  métadonnées?: Record<string, unknown>; // ex: { appointmentId, patientId }
  erreurMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationDto {
  destinataireId: string;
  typeDestinataire?: 'user' | 'patient';
  canal: CanalNotification;
  templateId?: string;
  templateVariables?: Record<string, string>;
  sujet?: string;
  message?: string;            // requis si pas de templateId
  priorité?: PrioritéNotification;
  dateExpiration?: Date;
  métadonnées?: Record<string, unknown>;
}

// ─── SmsMessage ───────────────────────────────────────────────────────────

export type StatutSms = 'en_attente' | 'envoyé' | 'délivré' | 'échec' | 'inconnu';
export type OpérateurSms = 'orange' | 'mtn' | 'moov' | 'free' | 'autre';

export interface SmsMessage {
  id: string;                  // UUID
  notificationId?: string;     // FK → Notification (si déclenché par une notification)
  numéro: string;              // numéro E.164 ex: "+22670000000"
  contenu: string;
  statutEnvoi: StatutSms;
  opérateur?: OpérateurSms;
  référenceOpérateur?: string; // ID de message retourné par l'opérateur/agrégateur SMS
  dateEnvoi?: Date;
  dateDélivrance?: Date;
  erreurMessage?: string;
  coût?: number;               // coût unitaire en unité opérateur
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSmsMessageDto {
  notificationId?: string;
  numéro: string;
  contenu: string;
  opérateur?: OpérateurSms;
}

// ─── Préférence de notification d'un utilisateur ─────────────────────────

export interface NotificationPreference {
  id: string;                  // UUID
  userId: string;              // FK auth-service
  canal: CanalNotification;
  activé: boolean;
  heuresActives?: { début: string; fin: string }; // ex: { début: "07:00", fin: "20:00" }
  createdAt: Date;
  updatedAt: Date;
}
