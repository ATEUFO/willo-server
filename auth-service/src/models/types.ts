/**
 * auth-service — Modèles Custom
 * Identité, comptes, postes, sessions
 */

// ─── Rôle & Permissions ────────────────────────────────────────────────────

export type Permission =
  | 'patient:read'
  | 'patient:write'
  | 'patient:delete'
  | 'encounter:read'
  | 'encounter:write'
  | 'prescription:read'
  | 'prescription:write'
  | 'dispensation:write'
  | 'labo:read'
  | 'labo:write'
  | 'stock:read'
  | 'stock:write'
  | 'invoice:read'
  | 'invoice:write'
  | 'payment:write'
  | 'report:read'
  | 'user:manage'
  | 'config:manage'
  | 'audit:read';

export type RoleName =
  | 'médecin'
  | 'infirmier'
  | 'pharmacien'
  | 'laborantin'
  | 'accueil'
  | 'admin'
  | 'gestionnaire'
  | 'épidémiologiste';

export interface Role {
  id: string;                  // UUID
  nom: RoleName;
  description?: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Site / Centre de Santé ────────────────────────────────────────────────

export interface Site {
  id: string;                  // UUID
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

// ─── Poste de travail ──────────────────────────────────────────────────────

export type RôleRéseau = 'serveur' | 'client';

export interface Poste {
  id: string;                  // UUID
  nom: string;
  rôleRéseau: RôleRéseau;
  adresseIP: string;
  siteId: string;              // FK → Site
  certificatEmpreinte?: string;
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Utilisateur ──────────────────────────────────────────────────────────

export interface User {
  id: string;                  // UUID
  email: string;
  passwordHash: string;
  nom: string;
  prénom: string;
  téléphone?: string;
  posteRattachéId?: string;    // FK → Poste
  siteId?: string;             // FK → Site
  fhirPractitionerId?: string; // lien vers Practitioner FHIR (fhir-service)
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
  password: string;            // sera hashé avant stockage
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

// ─── Table de liaison User ↔ Role ─────────────────────────────────────────

export interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy: string;          // userId de l'administrateur
}

// ─── Session / Refresh Token ───────────────────────────────────────────────

export interface Session {
  id: string;                  // UUID
  userId: string;              // FK → User
  refreshToken: string;        // JWT refresh token (hash stocké)
  expiresAt: Date;
  posteId?: string;            // FK → Poste (poste utilisé lors de la session)
  ip: string;
  userAgent?: string;
  actif: boolean;
  createdAt: Date;
}

// ─── Pairing Code (appairage réseau) ──────────────────────────────────────

export interface PairingCode {
  id: string;                  // UUID
  code: string;                // code court (6 chiffres ou UUID court)
  posteAppairéId?: string;     // FK → Poste (renseigné après appairage)
  siteId: string;              // FK → Site
  expiresAt: Date;
  utilisé: boolean;
  createdAt: Date;
}

// ─── Réponses API ─────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;           // secondes
}

export interface LoginResponse {
  tokens: AuthTokens;
  user: Omit<UserWithRoles, 'passwordHash'>;
}
