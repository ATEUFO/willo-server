/**
 * Resolution des canaux WebSocket autorises par utilisateur
 * Les canaux ne sont JAMAIS choisis directement par le client.
 * Ils sont déduits cote serveur a partir du profil authentifie (JWT).
 */
export interface UserContext {
    userId: string;
    role: string;
    siteId?: string | undefined;
}
export declare function resolveChannelsForUser(user: UserContext): string[];
//# sourceMappingURL=channel-resolver.d.ts.map