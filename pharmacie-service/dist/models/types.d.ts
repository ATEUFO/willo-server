/**
 * pharmacie-service — Modèles
 * FHIR : MedicationRequest, MedicationDispense, Medication, SupplyRequest (proxied)
 * Custom : StockItem, StockMovement
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
    code?: FhirCodeableConcept;
    nom: string;
    forme?: string;
    status?: 'active' | 'inactive' | 'entered-in-error';
}
/** Résumé d'un MedicationRequest (ordonnance) */
export interface PharmacieMedicationRequest {
    id: string;
    fhirId: string;
    patientId: string;
    practitionerId?: string;
    encounterId?: string;
    medicationId: string;
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
export type EmplacementStock = string;
export interface StockItem {
    id: string;
    médicamentId: string;
    nomMédicament: string;
    lot: string;
    quantité: number;
    unité: string;
    datePéremption: Date;
    emplacement: EmplacementStock;
    prixUnitaire?: number;
    alerteSeuilBas?: number;
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
export type TypeMouvement = 'entrée' | 'sortie' | 'ajustement' | 'périmé' | 'transfert' | 'retour';
export interface StockMovement {
    id: string;
    stockItemId: string;
    type: TypeMouvement;
    quantité: number;
    quantitéAvant: number;
    quantitéAprès: number;
    motif?: string;
    référenceDocument?: string;
    userId: string;
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
//# sourceMappingURL=types.d.ts.map