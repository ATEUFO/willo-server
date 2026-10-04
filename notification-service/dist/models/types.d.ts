/**
 * notification-service — Modèles Custom
 * Notifications multi-canal : WebSocket, SMS, Email, USSD.
 */
export type CanalNotification = 'websocket' | 'sms' | 'email' | 'ussd' | 'push';
export type PrioritéNotification = 'basse' | 'normale' | 'haute' | 'urgente';
export type StatutNotification = 'en_attente' | 'envoyée' | 'délivrée' | 'lue' | 'échec' | 'expirée';
export interface NotificationTemplate {
    id: string;
    code: string;
    canal: CanalNotification;
    sujet?: string;
    contenu: string;
    variables: string[];
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
export interface Notification {
    id: string;
    destinataireId: string;
    typeDestinataire: 'user' | 'patient';
    canal: CanalNotification;
    templateId?: string;
    sujet?: string;
    message: string;
    priorité: PrioritéNotification;
    statut: StatutNotification;
    tentatives: number;
    tentativeMax: number;
    dateEnvoi?: Date;
    dateExpiration?: Date;
    métadonnées?: Record<string, unknown>;
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
    message?: string;
    priorité?: PrioritéNotification;
    dateExpiration?: Date;
    métadonnées?: Record<string, unknown>;
}
export type StatutSms = 'en_attente' | 'envoyé' | 'délivré' | 'échec' | 'inconnu';
export type OpérateurSms = 'orange' | 'mtn' | 'moov' | 'free' | 'autre';
export interface SmsMessage {
    id: string;
    notificationId?: string;
    numéro: string;
    contenu: string;
    statutEnvoi: StatutSms;
    opérateur?: OpérateurSms;
    référenceOpérateur?: string;
    dateEnvoi?: Date;
    dateDélivrance?: Date;
    erreurMessage?: string;
    coût?: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateSmsMessageDto {
    notificationId?: string;
    numéro: string;
    contenu: string;
    opérateur?: OpérateurSms;
}
export interface NotificationPreference {
    id: string;
    userId: string;
    canal: CanalNotification;
    activé: boolean;
    heuresActives?: {
        début: string;
        fin: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=types.d.ts.map