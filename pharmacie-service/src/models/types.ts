/**
 * pharmacie-service — Modèles
 * FHIR : MedicationRequest, MedicationDispense, Medication, SupplyRequest (proxied)
 * Custom : StockItem, StockMovement
 */

// ─── Références FHIR légères ───────────────────────────────────────────────

export interface FhirReference {
  reference: string;           // ex: "Medication/uuid"
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: Array<{ system?: string; code?: string; display?: string }>;
  text?: string;
}

export interface FhirQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

/** Résumé d'un Medication (médicament du catalogue FHIR) */
export interface PharmacieMedication {
  id: string;
  fhirId: string;
  code?: FhirCodeableConcept;  // DCI, ATC, code local
  nom: string;                  // text du CodeableConcept
  forme?: string;               // comprimé, sirop, injection...
  status?: 'active' | 'inactive' | 'entered-in-error';
}

/** Résumé d'un MedicationRequest (ordonnance) */
export interface PharmacieMedicationRequest {
  id: string;
  fhirId: string;
  patientId: string;
  practitionerId?: string;
  encounterId?: string;
  medicationId: string;        // fhirId du Medication
  status: string;
  authoredOn?: string;
  dosageInstruction?: string;
  quantity?: FhirQuantity;
}

/** Résumé d'un MedicationDispense (dispensation) */
export interface PharmacieMedicationDispense {
  id: string;
  fhirId: string;
  patientId?: string;
  medicationRequestId?: string;
  medicationId: string;
  status: string;
  quantity?: FhirQuantity;
  whenHandedOver?: string;
  pharmacistId?: string;
}

/** Résumé d'un SupplyRequest (réapprovisionnement) */
export interface PharmacieSupplyRequest {
  id: string;
  fhirId: string;
  itemId?: string;
  quantity: FhirQuantity;
  status?: string;
  authoredOn?: string;
  requesterId?: string;
  organizationId?: string;
}

// ─── StockItem (Custom) ───────────────────────────────────────────────────

export type EmplacementStock = string; // ex: "Étagère A-3", "Réfrigérateur 1", "Armoire sécurisée"

export interface StockItem {
  id: string;                  // UUID
  médicamentId: string;        // fhirId du Medication dans fhir-service
  nomMédicament: string;       // dénormalisé pour affichage rapide
  lot: string;                 // numéro de lot
  quantité: number;
  unité: string;               // ex: "comprimé", "flacon", "ml"
  datePéremption: Date;
  emplacement: EmplacementStock;
  prixUnitaire?: number;
  alerteSeuilBas?: number;     // alerte si quantité < seuil
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStockItemDto {
  médicamentId: string;
  nomMédicament: string;
  lot: string;
  quantité: number;
  unité: string;
  datePéremption: Date;
  emplacement: EmplacementStock;
  prixUnitaire?: number;
  alerteSeuilBas?: number;
}

export interface UpdateStockItemDto {
  quantité?: number;
  emplacement?: EmplacementStock;
  alerteSeuilBas?: number;
}

// ─── StockMovement (Custom) ───────────────────────────────────────────────

export type TypeMouvement =
  | 'entrée'            // réception de commande
  | 'sortie'            // dispensation patient
  | 'ajustement'        // correction inventaire
  | 'périmé'            // retrait de périmés
  | 'transfert'         // transfert inter-services
  | 'retour';           // retour fournisseur

export interface StockMovement {
  id: string;                  // UUID
  stockItemId: string;         // FK → StockItem
  type: TypeMouvement;
  quantité: number;            // toujours positif — le type indique le sens
  quantitéAvant: number;       // snapshot avant mouvement
  quantitéAprès: number;       // snapshot après mouvement
  motif?: string;
  référenceDocument?: string;  // ex: fhirId du MedicationDispense ou SupplyRequest
  userId: string;              // utilisateur auth-service qui a effectué l'opération
  date: Date;
  createdAt: Date;
}

export interface CreateStockMovementDto {
  stockItemId: string;
  type: TypeMouvement;
  quantité: number;
  motif?: string;
  référenceDocument?: string;
  userId: string;
}
