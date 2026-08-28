/**
 * facturation-service — Modèles
 * FHIR : Claim, ClaimResponse, Coverage (proxied via fhir-service)
 * Custom : Invoice, InvoiceLine, Payment, TarifActe
 */

// ─── Références FHIR légères ───────────────────────────────────────────────

export interface FhirReference {
  reference: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: Array<{ system?: string; code?: string; display?: string }>;
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

// ─── TarifActe (Custom — référentiel tarifaire) ───────────────────────────

export interface TarifActe {
  id: string;                  // UUID
  codeActe: string;            // code CIM-10, CCAM, ou local
  libellé: string;
  service: string;             // ex: "consultation", "labo", "imagerie", "pharmacie"
  prix: number;
  devise: string;              // ex: "XOF", "EUR"
  tvaApplicable: boolean;
  tauxTva?: number;            // en %
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

// ─── InvoiceLine (Custom) ─────────────────────────────────────────────────

export interface InvoiceLine {
  id: string;                  // UUID
  invoiceId: string;           // FK → Invoice
  tarifActeId?: string;        // FK → TarifActe (si acte codifié)
  description: string;
  quantité: number;
  prixUnitaire: number;
  remise?: number;             // en %
  montantHT: number;
  montantTTC: number;
  service?: string;            // service producteur de la ligne
}

// ─── Invoice (Custom) ─────────────────────────────────────────────────────

export type StatutFacture = 'brouillon' | 'émise' | 'partielle' | 'payée' | 'annulée' | 'impayée';
export type DeviseFacture = 'XOF' | 'XAF' | 'EUR' | 'USD';

export interface Invoice {
  id: string;                  // UUID
  numéro: string;              // numéro de facture lisible (ex: FAC-2024-00042)
  patientId: string;           // référence auth-service/fhir-service
  encounterId?: string;        // fhirId de l'Encounter
  claimId?: string;            // fhirId du Claim associé
  lignes: InvoiceLine[];
  montantHT: number;
  montantTVA: number;
  montantTotal: number;
  devise: DeviseFacture;
  statut: StatutFacture;
  partAssurance: number;       // montant pris en charge par assurance
  partPatient: number;         // reste à charge patient
  dateÉmission: Date;
  dateÉchéance?: Date;
  dateAnnulation?: Date;
  notes?: string;
  créeParId: string;           // userId auth-service
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

// ─── Payment (Custom) ─────────────────────────────────────────────────────

export type ModePaiement = 'espèces' | 'mobile_money' | 'assurance' | 'virement' | 'carte' | 'chèque';

export interface Payment {
  id: string;                  // UUID
  invoiceId: string;           // FK → Invoice
  montant: number;
  devise: DeviseFacture;
  mode: ModePaiement;
  référenceExterne?: string;   // ex: numéro de transaction mobile money
  date: Date;
  userId: string;              // caissier — userId auth-service
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
