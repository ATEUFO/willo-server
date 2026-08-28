/**
 * facturation-service — Modèles
 * FHIR : Claim, ClaimResponse, Coverage (proxied via fhir-service)
 * Custom : Invoice, InvoiceLine, Payment, TarifActe
 */
export interface FhirReference {
    reference: string;
    display?: string;
}
export interface FhirCodeableConcept {
    coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
    }>;
    text?: string;
}
/** Résumé d'un Claim (demande de remboursement assurance) */
export interface FacturationClaim {
    id: string;
    fhirId: string;
    patientId: string;
    coverageId?: string;
    status: string;
    created: string;
    total?: number;
    currency?: string;
}
/** Résumé d'un ClaimResponse (réponse assurance) */
export interface FacturationClaimResponse {
    id: string;
    fhirId: string;
    claimId?: string;
    patientId: string;
    outcome: 'queued' | 'complete' | 'error' | 'partial';
    disposition?: string;
    paymentAmount?: number;
    paymentDate?: string;
}
/** Résumé d'un Coverage (couverture assurance du patient) */
export interface FacturationCoverage {
    id: string;
    fhirId: string;
    patientId: string;
    status: string;
    type?: string;
    subscriberId?: string;
    network?: string;
    periodStart?: string;
    periodEnd?: string;
}
export interface TarifActe {
    id: string;
    codeActe: string;
    libellé: string;
    service: string;
    prix: number;
    devise: string;
    tvaApplicable: boolean;
    tauxTva?: number;
    actif: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateTarifActeDto {
    codeActe: string;
    libellé: string;
    service: string;
    prix: number;
    devise?: string;
    tvaApplicable?: boolean;
    tauxTva?: number;
}
export interface InvoiceLine {
    id: string;
    invoiceId: string;
    tarifActeId?: string;
    description: string;
    quantité: number;
    prixUnitaire: number;
    remise?: number;
    montantHT: number;
    montantTTC: number;
    service?: string;
}
export type StatutFacture = 'brouillon' | 'émise' | 'partielle' | 'payée' | 'annulée' | 'impayée';
export type DeviseFacture = 'XOF' | 'XAF' | 'EUR' | 'USD';
export interface Invoice {
    id: string;
    numéro: string;
    patientId: string;
    encounterId?: string;
    claimId?: string;
    lignes: InvoiceLine[];
    montantHT: number;
    montantTVA: number;
    montantTotal: number;
    devise: DeviseFacture;
    statut: StatutFacture;
    partAssurance: number;
    partPatient: number;
    dateÉmission: Date;
    dateÉchéance?: Date;
    dateAnnulation?: Date;
    notes?: string;
    créeParId: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateInvoiceDto {
    patientId: string;
    encounterId?: string;
    claimId?: string;
    lignes: Array<{
        tarifActeId?: string;
        description: string;
        quantité: number;
        prixUnitaire: number;
        remise?: number;
        service?: string;
    }>;
    devise?: DeviseFacture;
    partAssurance?: number;
    dateÉchéance?: Date;
    notes?: string;
    créeParId: string;
}
export type ModePaiement = 'espèces' | 'mobile_money' | 'assurance' | 'virement' | 'carte' | 'chèque';
export interface Payment {
    id: string;
    invoiceId: string;
    montant: number;
    devise: DeviseFacture;
    mode: ModePaiement;
    référenceExterne?: string;
    date: Date;
    userId: string;
    notes?: string;
    createdAt: Date;
}
export interface CreatePaymentDto {
    invoiceId: string;
    montant: number;
    devise?: DeviseFacture;
    mode: ModePaiement;
    référenceExterne?: string;
    date?: Date;
    userId: string;
    notes?: string;
}
//# sourceMappingURL=types.d.ts.map