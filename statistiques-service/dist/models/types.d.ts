/**
 * statistiques-service — Modèles Custom
 * Indicateurs de tableau de bord, agrégation inter-services.
 */
export type Périodicité = 'journalière' | 'hebdomadaire' | 'mensuelle' | 'trimestrielle' | 'annuelle' | 'ponctuelle';
export type TypeIndicateur = 'count' | 'sum' | 'average' | 'ratio' | 'rate' | 'custom';
export interface IndicatorSource {
    service: string;
    ressource: string;
    filtre?: string;
}
export interface Indicator {
    id: string;
    nom: string;
    description?: string;
    type: TypeIndicateur;
    formule?: string;
    sources: IndicatorSource[];
    unité?: string;
    périodicité: Périodicité;
    catégorie?: string;
    siteScope?: string[];
    actif: boolean;
    ordreAffichage?: number;
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
export type StatutSnapshot = 'en_cours' | 'prêt' | 'erreur';
export interface ReportSnapshot {
    id: string;
    indicatorId: string;
    période: string;
    dateDebut: Date;
    dateFin: Date;
    valeur: number | null;
    valeurDétail?: Record<string, unknown>;
    statut: StatutSnapshot;
    erreur?: string;
    généréParId?: string;
    date: Date;
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
export interface DashboardWidget {
    indicator: Indicator;
    latestSnapshot?: ReportSnapshot;
    tendance?: 'hausse' | 'baisse' | 'stable' | 'inconnu';
    variationPct?: number;
}
export interface DashboardResponse {
    siteId?: string;
    période: string;
    widgets: DashboardWidget[];
    généréLe: Date;
}
//# sourceMappingURL=types.d.ts.map