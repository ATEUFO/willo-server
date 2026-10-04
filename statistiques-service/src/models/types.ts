/**
 * statistiques-service — Modèles Custom
 * Indicateurs de tableau de bord, agrégation inter-services.
 */

// ─── Indicator ────────────────────────────────────────────────────────────

export type Périodicité = 'journalière' | 'hebdomadaire' | 'mensuelle' | 'trimestrielle' | 'annuelle' | 'ponctuelle';

export type TypeIndicateur =
  | 'count'        // comptage (ex: nombre de consultations)
  | 'sum'          // somme (ex: montant total facturé)
  | 'average'      // moyenne (ex: durée moyenne de séjour)
  | 'ratio'        // ratio/proportion (ex: taux de guérison)
  | 'rate'         // taux pour 1000 (ex: incidence)
  | 'custom';      // requête SQL personnalisée

export interface IndicatorSource {
  service: string;             // ex: "fhir-service", "pharmacie-service"
  ressource: string;           // ex: "Encounter", "StockMovement"
  filtre?: string;             // condition SQL/FHIR additionnelle
}

export interface Indicator {
  id: string;                  // UUID
  nom: string;
  description?: string;
  type: TypeIndicateur;
  formule?: string;            // expression ou requête SQL/FHIR paramétrable
  sources: IndicatorSource[];
  unité?: string;              // ex: "%", "patients", "FCFA"
  périodicité: Périodicité;
  catégorie?: string;          // ex: "activité", "financier", "épidémio", "qualité"
  siteScope?: string[];        // IDs de sites — vide = tous les sites
  actif: boolean;
  ordreAffichage?: number;     // pour tri dans le tableau de bord
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIndicatorDto {
  nom: string;
  description?: string;
  type: TypeIndicateur;
  formule?: string;
  sources: IndicatorSource[];
  unité?: string;
  périodicité: Périodicité;
  catégorie?: string;
  siteScope?: string[];
  ordreAffichage?: number;
}

// ─── ReportSnapshot ───────────────────────────────────────────────────────

export type StatutSnapshot = 'en_cours' | 'prêt' | 'erreur';

export interface ReportSnapshot {
  id: string;                  // UUID
  indicatorId: string;         // FK → Indicator
  période: string;             // ex: "2024-01", "2024-W03", "2024-Q1", "2024"
  dateDebut: Date;
  dateFin: Date;
  valeur: number | null;       // null si erreur de calcul
  valeurDétail?: Record<string, unknown>; // ventilation par site, service, etc.
  statut: StatutSnapshot;
  erreur?: string;             // message d'erreur si statut = 'erreur'
  généréParId?: string;        // userId ou "system" (calcul automatique)
  date: Date;                  // date de génération du snapshot
  createdAt: Date;
}

export interface CreateReportSnapshotDto {
  indicatorId: string;
  période: string;
  dateDebut: Date;
  dateFin: Date;
  valeur?: number;
  valeurDétail?: Record<string, unknown>;
  généréParId?: string;
}

// ─── Vue agrégée pour tableau de bord ────────────────────────────────────

export interface DashboardWidget {
  indicator: Indicator;
  latestSnapshot?: ReportSnapshot;
  tendance?: 'hausse' | 'baisse' | 'stable' | 'inconnu';
  variationPct?: number;       // variation % vs période précédente
}

export interface DashboardResponse {
  siteId?: string;
  période: string;
  widgets: DashboardWidget[];
  généréLe: Date;
}
