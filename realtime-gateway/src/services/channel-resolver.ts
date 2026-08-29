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

export function resolveChannelsForUser(user: UserContext): string[] {
  const channels: string[] = [];

  // 1. Canal personnel (notifs privées, résultats pour soi)
  if (user.userId) {
    channels.push(`user:${user.userId}`);
  }

  // 2. Canal par rôle (médecin, infirmier, pharmacien, etc.)
  if (user.role) {
    channels.push(`role:${user.role}`);
  }

  // 3. Canal par site / centre de santé
  if (user.siteId) {
    channels.push(`site:${user.siteId}`);
  } else {
    channels.push('site:global');
  }

  // 4. Canaux de ressources publiques/métier selon le rôle
  channels.push('resource:Patient');
  channels.push('resource:Encounter');

  if (user.role === 'pharmacien' || user.role === 'admin' || user.role === 'médecin') {
    channels.push('resource:StockItem');
    channels.push('resource:MedicationDispense');
  }

  if (user.role === 'laborantin' || user.role === 'admin' || user.role === 'médecin') {
    channels.push('resource:DiagnosticReport');
    channels.push('resource:Specimen');
  }

  return Array.from(new Set(channels));
}
