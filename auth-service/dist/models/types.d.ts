/**
 * auth-service — Modèles Custom
 * Identité, comptes, postes, sessions
 */
export type Permission = 'patient:read' | 'patient:write' | 'patient:delete' | 'encounter:read' | 'encounter:write' | 'prescription:read' | 'prescription:write' | 'dispensation:write' | 'labo:read' | 'labo:write' | 'stock:read' | 'stock:write' | 'invoice:read' | 'invoice:write' | 'payment:write' | 'report:read' | 'user:manage' | 'config:manage' | 'audit:read';
export type RoleName = 'médecin' | 'infirmier' | 'pharmacien' | 'laborantin' | 'accueil' | 'admin' | 'gestionnaire' | 'épidémiologiste';
export interface Role {
    id: string;
    nom: RoleName;
    description?: string;
    permissions: Permission[];
    createdAt: Date;
    updatedAt: Date;
}
export interface Site {
    id: string;
    nom: string;
    région: string;
    district: string;
    adresse: string;
    telephone?: string;
    email?: string;
    actif: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export type RôleRéseau = 'serveur' | 'client';
export interface Poste {
    id: string;
    nom: string;
    rôleRéseau: RôleRéseau;
    adresseIP: string;
    siteId: string;
    certificatEmpreinte?: string;
    actif: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface User {
    id: string;
    email: string;
    passwordHash: string;
    nom: string;
    prénom: string;
    téléphone?: string;
    posteRattachéId?: string;
    siteId?: string;
    fhirPractitionerId?: string;
    actif: boolean;
    dernièreConnexion?: Date;
    createdAt: Date;
    updatedAt: Date;
}
/** Vue dénormalisée User + rôles (usage API) */
export interface UserWithRoles extends User {
    roles: Role[];
}
/** DTO de création (sans les champs auto-générés) */
export interface CreateUserDto {
    email: string;
    password: string;
    nom: string;
    prénom: string;
    téléphone?: string;
    roleIds: string[];
    posteRattachéId?: string;
    siteId?: string;
    fhirPractitionerId?: string;
}
export interface UpdateUserDto {
    nom?: string;
    prénom?: string;
    téléphone?: string;
    posteRattachéId?: string;
    siteId?: string;
    actif?: boolean;
}
export interface UserRole {
    userId: string;
    roleId: string;
    assignedAt: Date;
    assignedBy: string;
}
export interface Session {
    id: string;
    userId: string;
    refreshToken: string;
    expiresAt: Date;
    posteId?: string;
    ip: string;
    userAgent?: string;
    actif: boolean;
    createdAt: Date;
}
export interface PairingCode {
    id: string;
    code: string;
    posteAppairéId?: string;
    siteId: string;
    expiresAt: Date;
    utilisé: boolean;
    createdAt: Date;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface LoginResponse {
    tokens: AuthTokens;
    user: Omit<UserWithRoles, 'passwordHash'>;
}
//# sourceMappingURL=types.d.ts.map