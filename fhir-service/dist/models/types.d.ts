/**
 * fhir-service — Types FHIR R4
 * Wrappers TypeScript sur les ressources HL7 FHIR R4.
 * Stockage : table `fhir_resources` avec colonne `content JSONB`.
 */
export interface FhirCoding {
    system?: string;
    version?: string;
    code?: string;
    display?: string;
}
export interface FhirCodeableConcept {
    coding?: FhirCoding[];
    text?: string;
}
export interface FhirReference {
    reference?: string;
    type?: string;
    display?: string;
}
export interface FhirIdentifier {
    use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
    type?: FhirCodeableConcept;
    system?: string;
    value?: string;
}
export interface FhirHumanName {
    use?: string;
    text?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
}
export interface FhirContactPoint {
    system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
    value?: string;
    use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
}
export interface FhirAddress {
    use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
    type?: 'postal' | 'physical' | 'both';
    text?: string;
    line?: string[];
    city?: string;
    district?: string;
    state?: string;
    postalCode?: string;
    country?: string;
}
export interface FhirPeriod {
    start?: string;
    end?: string;
}
export interface FhirQuantity {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
}
export interface FhirRange {
    low?: FhirQuantity;
    high?: FhirQuantity;
}
export interface FhirAnnotation {
    authorReference?: FhirReference;
    authorString?: string;
    time?: string;
    text: string;
}
export interface FhirAttachment {
    contentType?: string;
    language?: string;
    url?: string;
    title?: string;
    creation?: string;
    size?: number;
    hash?: string;
}
export interface FhirMeta {
    versionId?: string;
    lastUpdated?: string;
    source?: string;
    profile?: string[];
    tag?: FhirCoding[];
}
/** Enregistrement tel qu'il est stocké dans la table fhir_resources */
export interface FhirResourceRecord {
    id: string;
    resourceType: string;
    fhirId: string;
    content: Record<string, unknown>;
    subjectId?: string;
    encounterId?: string;
    lastUpdated: Date;
    createdAt: Date;
}
export interface FhirPatient {
    resourceType: 'Patient';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    active?: boolean;
    name?: FhirHumanName[];
    telecom?: FhirContactPoint[];
    gender?: 'male' | 'female' | 'other' | 'unknown';
    birthDate?: string;
    deceasedBoolean?: boolean;
    deceasedDateTime?: string;
    address?: FhirAddress[];
    maritalStatus?: FhirCodeableConcept;
    contact?: Array<{
        relationship?: FhirCodeableConcept[];
        name?: FhirHumanName;
        telecom?: FhirContactPoint[];
    }>;
    communication?: Array<{
        language: FhirCodeableConcept;
        preferred?: boolean;
    }>;
    generalPractitioner?: FhirReference[];
    managingOrganization?: FhirReference;
}
export interface FhirPractitioner {
    resourceType: 'Practitioner';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    active?: boolean;
    name?: FhirHumanName[];
    telecom?: FhirContactPoint[];
    address?: FhirAddress[];
    gender?: 'male' | 'female' | 'other' | 'unknown';
    birthDate?: string;
    qualification?: Array<{
        identifier?: FhirIdentifier[];
        code: FhirCodeableConcept;
        period?: FhirPeriod;
        issuer?: FhirReference;
    }>;
}
export interface FhirPractitionerRole {
    resourceType: 'PractitionerRole';
    id?: string;
    meta?: FhirMeta;
    active?: boolean;
    period?: FhirPeriod;
    practitioner?: FhirReference;
    organization?: FhirReference;
    code?: FhirCodeableConcept[];
    specialty?: FhirCodeableConcept[];
    location?: FhirReference[];
    telecom?: FhirContactPoint[];
}
export interface FhirOrganization {
    resourceType: 'Organization';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    active?: boolean;
    type?: FhirCodeableConcept[];
    name?: string;
    telecom?: FhirContactPoint[];
    address?: FhirAddress[];
    partOf?: FhirReference;
}
export interface FhirLocation {
    resourceType: 'Location';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status?: 'active' | 'suspended' | 'inactive';
    name?: string;
    description?: string;
    mode?: 'instance' | 'kind';
    type?: FhirCodeableConcept[];
    telecom?: FhirContactPoint[];
    address?: FhirAddress;
    physicalType?: FhirCodeableConcept;
    managingOrganization?: FhirReference;
    partOf?: FhirReference;
}
export interface FhirEncounter {
    resourceType: 'Encounter';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
    class: FhirCoding;
    type?: FhirCodeableConcept[];
    serviceType?: FhirCodeableConcept;
    priority?: FhirCodeableConcept;
    subject?: FhirReference;
    participant?: Array<{
        type?: FhirCodeableConcept[];
        individual?: FhirReference;
    }>;
    period?: FhirPeriod;
    reasonCode?: FhirCodeableConcept[];
    diagnosis?: Array<{
        condition: FhirReference;
        use?: FhirCodeableConcept;
        rank?: number;
    }>;
    location?: Array<{
        location: FhirReference;
        status?: string;
    }>;
    serviceProvider?: FhirReference;
}
export interface FhirObservation {
    resourceType: 'Observation';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error';
    category?: FhirCodeableConcept[];
    code: FhirCodeableConcept;
    subject?: FhirReference;
    encounter?: FhirReference;
    effectiveDateTime?: string;
    issued?: string;
    performer?: FhirReference[];
    valueQuantity?: FhirQuantity;
    valueCodeableConcept?: FhirCodeableConcept;
    valueString?: string;
    valueBoolean?: boolean;
    dataAbsentReason?: FhirCodeableConcept;
    interpretation?: FhirCodeableConcept[];
    note?: FhirAnnotation[];
    referenceRange?: Array<{
        low?: FhirQuantity;
        high?: FhirQuantity;
        type?: FhirCodeableConcept;
        text?: string;
    }>;
    component?: Array<{
        code: FhirCodeableConcept;
        valueQuantity?: FhirQuantity;
        valueString?: string;
    }>;
}
export interface FhirCondition {
    resourceType: 'Condition';
    id?: string;
    meta?: FhirMeta;
    clinicalStatus?: FhirCodeableConcept;
    verificationStatus?: FhirCodeableConcept;
    category?: FhirCodeableConcept[];
    severity?: FhirCodeableConcept;
    code?: FhirCodeableConcept;
    subject: FhirReference;
    encounter?: FhirReference;
    onsetDateTime?: string;
    abatementDateTime?: string;
    recordedDate?: string;
    recorder?: FhirReference;
    note?: FhirAnnotation[];
}
export interface FhirAllergyIntolerance {
    resourceType: 'AllergyIntolerance';
    id?: string;
    meta?: FhirMeta;
    clinicalStatus?: FhirCodeableConcept;
    verificationStatus?: FhirCodeableConcept;
    type?: 'allergy' | 'intolerance';
    category?: Array<'food' | 'medication' | 'environment' | 'biologic'>;
    criticality?: 'low' | 'high' | 'unable-to-assess';
    code?: FhirCodeableConcept;
    patient: FhirReference;
    recordedDate?: string;
    recorder?: FhirReference;
    reaction?: Array<{
        substance?: FhirCodeableConcept;
        manifestation: FhirCodeableConcept[];
        severity?: 'mild' | 'moderate' | 'severe';
    }>;
}
export interface FhirMedication {
    resourceType: 'Medication';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    code?: FhirCodeableConcept;
    status?: 'active' | 'inactive' | 'entered-in-error';
    manufacturer?: FhirReference;
    form?: FhirCodeableConcept;
    amount?: {
        numerator?: FhirQuantity;
        denominator?: FhirQuantity;
    };
    ingredient?: Array<{
        itemCodeableConcept?: FhirCodeableConcept;
        isActive?: boolean;
        strength?: {
            numerator?: FhirQuantity;
            denominator?: FhirQuantity;
        };
    }>;
    batch?: {
        lotNumber?: string;
        expirationDate?: string;
    };
}
export interface FhirMedicationRequest {
    resourceType: 'MedicationRequest';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft';
    intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
    medicationCodeableConcept?: FhirCodeableConcept;
    medicationReference?: FhirReference;
    subject: FhirReference;
    encounter?: FhirReference;
    authoredOn?: string;
    requester?: FhirReference;
    dosageInstruction?: Array<{
        text?: string;
        timing?: {
            repeat?: {
                frequency?: number;
                period?: number;
                periodUnit?: string;
            };
        };
        route?: FhirCodeableConcept;
        doseAndRate?: Array<{
            doseQuantity?: FhirQuantity;
        }>;
    }>;
    dispenseRequest?: {
        quantity?: FhirQuantity;
        expectedSupplyDuration?: FhirQuantity;
    };
    note?: FhirAnnotation[];
}
export interface FhirMedicationDispense {
    resourceType: 'MedicationDispense';
    id?: string;
    meta?: FhirMeta;
    status: 'preparation' | 'in-progress' | 'cancelled' | 'on-hold' | 'completed' | 'entered-in-error' | 'stopped' | 'declined' | 'unknown';
    medicationCodeableConcept?: FhirCodeableConcept;
    medicationReference?: FhirReference;
    subject?: FhirReference;
    authorizingPrescription?: FhirReference[];
    quantity?: FhirQuantity;
    daysSupply?: FhirQuantity;
    whenPrepared?: string;
    whenHandedOver?: string;
    performer?: Array<{
        actor: FhirReference;
    }>;
    note?: FhirAnnotation[];
    dosageInstruction?: Array<{
        text?: string;
    }>;
}
export interface FhirServiceRequest {
    resourceType: 'ServiceRequest';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
    intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
    category?: FhirCodeableConcept[];
    priority?: 'routine' | 'urgent' | 'asap' | 'stat';
    code?: FhirCodeableConcept;
    subject: FhirReference;
    encounter?: FhirReference;
    authoredOn?: string;
    requester?: FhirReference;
    performer?: FhirReference[];
    reasonCode?: FhirCodeableConcept[];
    note?: FhirAnnotation[];
    specimen?: FhirReference[];
}
export interface FhirSpecimen {
    resourceType: 'Specimen';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status?: 'available' | 'unavailable' | 'unsatisfactory' | 'entered-in-error';
    type?: FhirCodeableConcept;
    subject?: FhirReference;
    request?: FhirReference[];
    collection?: {
        collector?: FhirReference;
        collectedDateTime?: string;
        method?: FhirCodeableConcept;
        bodySite?: FhirCodeableConcept;
    };
    processing?: Array<{
        description?: string;
        procedure?: FhirCodeableConcept;
        additive?: FhirReference[];
    }>;
    receivedTime?: string;
    note?: FhirAnnotation[];
}
export interface FhirDiagnosticReport {
    resourceType: 'DiagnosticReport';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    basedOn?: FhirReference[];
    status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error';
    category?: FhirCodeableConcept[];
    code: FhirCodeableConcept;
    subject?: FhirReference;
    encounter?: FhirReference;
    effectiveDateTime?: string;
    issued?: string;
    performer?: FhirReference[];
    specimen?: FhirReference[];
    result?: FhirReference[];
    conclusion?: string;
    conclusionCode?: FhirCodeableConcept[];
    presentedForm?: FhirAttachment[];
}
export interface FhirImagingStudy {
    resourceType: 'ImagingStudy';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'registered' | 'available' | 'cancelled' | 'entered-in-error' | 'unknown';
    modality?: FhirCoding[];
    subject: FhirReference;
    encounter?: FhirReference;
    started?: string;
    numberOfSeries?: number;
    numberOfInstances?: number;
    description?: string;
    series?: Array<{
        uid: string;
        modality: FhirCoding;
        description?: string;
        numberOfInstances?: number;
        instance?: Array<{
            uid: string;
            sopClass: FhirCoding;
            title?: string;
        }>;
    }>;
}
export interface FhirDocumentReference {
    resourceType: 'DocumentReference';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'current' | 'superseded' | 'entered-in-error';
    docStatus?: 'preliminary' | 'final' | 'amended' | 'entered-in-error';
    type?: FhirCodeableConcept;
    category?: FhirCodeableConcept[];
    subject?: FhirReference;
    date?: string;
    author?: FhirReference[];
    description?: string;
    content: Array<{
        attachment: FhirAttachment;
        format?: FhirCoding;
    }>;
    context?: {
        encounter?: FhirReference[];
        period?: FhirPeriod;
    };
}
export interface FhirImmunization {
    resourceType: 'Immunization';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'completed' | 'entered-in-error' | 'not-done';
    statusReason?: FhirCodeableConcept;
    vaccineCode: FhirCodeableConcept;
    patient: FhirReference;
    encounter?: FhirReference;
    occurrenceDateTime?: string;
    lotNumber?: string;
    expirationDate?: string;
    site?: FhirCodeableConcept;
    route?: FhirCodeableConcept;
    doseQuantity?: FhirQuantity;
    performer?: Array<{
        actor: FhirReference;
    }>;
    note?: FhirAnnotation[];
    protocolApplied?: Array<{
        series?: string;
        doseNumberPositiveInt?: number;
    }>;
}
export interface FhirCarePlan {
    resourceType: 'CarePlan';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
    intent: 'proposal' | 'plan' | 'order' | 'option';
    category?: FhirCodeableConcept[];
    title?: string;
    description?: string;
    subject: FhirReference;
    period?: FhirPeriod;
    author?: FhirReference;
    careTeam?: FhirReference[];
    goal?: FhirReference[];
    activity?: Array<{
        detail?: {
            code?: FhirCodeableConcept;
            status: string;
            description?: string;
        };
    }>;
    note?: FhirAnnotation[];
}
export interface FhirRiskAssessment {
    resourceType: 'RiskAssessment';
    id?: string;
    meta?: FhirMeta;
    status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
    subject: FhirReference;
    encounter?: FhirReference;
    occurrenceDateTime?: string;
    condition?: FhirReference;
    performer?: FhirReference;
    reasonCode?: FhirCodeableConcept[];
    basis?: FhirReference[];
    prediction?: Array<{
        outcome?: FhirCodeableConcept;
        probabilityDecimal?: number;
        qualitativeRisk?: FhirCodeableConcept;
        relativeRisk?: number;
        whenPeriod?: FhirPeriod;
        rationale?: string;
    }>;
    mitigation?: string;
    note?: FhirAnnotation[];
}
export interface FhirConsent {
    resourceType: 'Consent';
    id?: string;
    meta?: FhirMeta;
    status: 'draft' | 'proposed' | 'active' | 'rejected' | 'inactive' | 'entered-in-error';
    scope: FhirCodeableConcept;
    category: FhirCodeableConcept[];
    patient?: FhirReference;
    dateTime?: string;
    performer?: FhirReference[];
    organization?: FhirReference[];
    sourceAttachment?: FhirAttachment;
    policy?: Array<{
        authority?: string;
        uri?: string;
    }>;
    policyRule?: FhirCodeableConcept;
}
export interface FhirCoverage {
    resourceType: 'Coverage';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
    type?: FhirCodeableConcept;
    subscriber?: FhirReference;
    subscriberId?: string;
    beneficiary: FhirReference;
    relationship?: FhirCodeableConcept;
    period?: FhirPeriod;
    payor: FhirReference[];
    class?: Array<{
        type: FhirCodeableConcept;
        value: string;
        name?: string;
    }>;
    network?: string;
}
export interface FhirAppointment {
    resourceType: 'Appointment';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error' | 'checked-in' | 'waitlist';
    serviceType?: FhirCodeableConcept[];
    specialty?: FhirCodeableConcept[];
    appointmentType?: FhirCodeableConcept;
    reasonCode?: FhirCodeableConcept[];
    priority?: number;
    description?: string;
    start?: string;
    end?: string;
    minutesDuration?: number;
    slot?: FhirReference[];
    comment?: string;
    participant: Array<{
        type?: FhirCodeableConcept[];
        actor?: FhirReference;
        required?: 'required' | 'optional' | 'information-only';
        status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
    }>;
}
export interface FhirSchedule {
    resourceType: 'Schedule';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    active?: boolean;
    serviceType?: FhirCodeableConcept[];
    specialty?: FhirCodeableConcept[];
    actor: FhirReference[];
    planningHorizon?: FhirPeriod;
    comment?: string;
}
export interface FhirSlot {
    resourceType: 'Slot';
    id?: string;
    meta?: FhirMeta;
    serviceType?: FhirCodeableConcept[];
    specialty?: FhirCodeableConcept[];
    appointmentType?: FhirCodeableConcept;
    schedule: FhirReference;
    status: 'busy' | 'free' | 'busy-unavailable' | 'busy-tentative' | 'entered-in-error';
    start: string;
    end: string;
    comment?: string;
}
export interface FhirSupplyRequest {
    resourceType: 'SupplyRequest';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status?: 'draft' | 'active' | 'suspended' | 'cancelled' | 'completed' | 'entered-in-error' | 'unknown';
    category?: FhirCodeableConcept;
    priority?: 'routine' | 'urgent' | 'asap' | 'stat';
    itemCodeableConcept?: FhirCodeableConcept;
    itemReference?: FhirReference;
    quantity: FhirQuantity;
    occurrenceDateTime?: string;
    authoredOn?: string;
    requester?: FhirReference;
    supplier?: FhirReference[];
    deliverTo?: FhirReference;
}
export interface FhirSupplyDelivery {
    resourceType: 'SupplyDelivery';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status?: 'in-progress' | 'completed' | 'abandoned' | 'entered-in-error';
    basedOn?: FhirReference[];
    type?: FhirCodeableConcept;
    suppliedItem?: {
        quantity?: FhirQuantity;
        itemCodeableConcept?: FhirCodeableConcept;
        itemReference?: FhirReference;
    };
    occurrenceDateTime?: string;
    supplier?: FhirReference;
    destination?: FhirReference;
    receiver?: FhirReference[];
}
export interface FhirDevice {
    resourceType: 'Device';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    definition?: FhirReference;
    status?: 'active' | 'inactive' | 'entered-in-error' | 'unknown';
    type?: FhirCodeableConcept;
    serialNumber?: string;
    manufacturer?: string;
    manufactureDate?: string;
    expirationDate?: string;
    modelNumber?: string;
    partNumber?: string;
    owner?: FhirReference;
    location?: FhirReference;
    note?: FhirAnnotation[];
}
export interface FhirAuditEvent {
    resourceType: 'AuditEvent';
    id?: string;
    meta?: FhirMeta;
    type: FhirCoding;
    subtype?: FhirCoding[];
    action?: 'C' | 'R' | 'U' | 'D' | 'E';
    period?: FhirPeriod;
    recorded: string;
    outcome?: '0' | '4' | '8' | '12';
    outcomeDesc?: string;
    agent: Array<{
        type?: FhirCodeableConcept;
        who?: FhirReference;
        name?: string;
        requestor: boolean;
        location?: FhirReference;
        network?: {
            address?: string;
            type?: string;
        };
    }>;
    source: {
        observer: FhirReference;
        type?: FhirCoding[];
    };
    entity?: Array<{
        what?: FhirReference;
        type?: FhirCoding;
        role?: FhirCoding;
        lifecycle?: FhirCoding;
        name?: string;
        description?: string;
    }>;
}
export interface FhirClaim {
    resourceType: 'Claim';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
    type: FhirCodeableConcept;
    use: 'claim' | 'preauthorization' | 'predetermination';
    patient: FhirReference;
    billablePeriod?: FhirPeriod;
    created: string;
    provider: FhirReference;
    priority: FhirCodeableConcept;
    insurance: Array<{
        sequence: number;
        focal: boolean;
        coverage: FhirReference;
    }>;
    item?: Array<{
        sequence: number;
        productOrService: FhirCodeableConcept;
        unitPrice?: FhirQuantity;
        quantity?: FhirQuantity;
        net?: FhirQuantity;
    }>;
    total?: FhirQuantity;
}
export interface FhirClaimResponse {
    resourceType: 'ClaimResponse';
    id?: string;
    meta?: FhirMeta;
    identifier?: FhirIdentifier[];
    status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
    type: FhirCodeableConcept;
    use: 'claim' | 'preauthorization' | 'predetermination';
    patient: FhirReference;
    created: string;
    insurer: FhirReference;
    request?: FhirReference;
    outcome: 'queued' | 'complete' | 'error' | 'partial';
    disposition?: string;
    payment?: {
        type: FhirCodeableConcept;
        amount: FhirQuantity;
        date?: string;
    };
    total?: Array<{
        category: FhirCodeableConcept;
        amount: FhirQuantity;
    }>;
}
export type FhirResourceType = 'Patient' | 'Practitioner' | 'PractitionerRole' | 'Organization' | 'Location' | 'Encounter' | 'Observation' | 'Condition' | 'AllergyIntolerance' | 'Medication' | 'MedicationRequest' | 'MedicationDispense' | 'ServiceRequest' | 'Specimen' | 'DiagnosticReport' | 'ImagingStudy' | 'DocumentReference' | 'Immunization' | 'CarePlan' | 'RiskAssessment' | 'Consent' | 'Coverage' | 'Appointment' | 'Schedule' | 'Slot' | 'SupplyRequest' | 'SupplyDelivery' | 'Device' | 'AuditEvent' | 'Claim' | 'ClaimResponse';
export type AnyFhirResource = FhirPatient | FhirPractitioner | FhirPractitionerRole | FhirOrganization | FhirLocation | FhirEncounter | FhirObservation | FhirCondition | FhirAllergyIntolerance | FhirMedication | FhirMedicationRequest | FhirMedicationDispense | FhirServiceRequest | FhirSpecimen | FhirDiagnosticReport | FhirImagingStudy | FhirDocumentReference | FhirImmunization | FhirCarePlan | FhirRiskAssessment | FhirConsent | FhirCoverage | FhirAppointment | FhirSchedule | FhirSlot | FhirSupplyRequest | FhirSupplyDelivery | FhirDevice | FhirAuditEvent | FhirClaim | FhirClaimResponse;
/** Bundle FHIR pour les réponses paginées */
export interface FhirBundle<T extends AnyFhirResource = AnyFhirResource> {
    resourceType: 'Bundle';
    type: 'searchset' | 'collection' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history';
    total?: number;
    link?: Array<{
        relation: string;
        url: string;
    }>;
    entry?: Array<{
        fullUrl?: string;
        resource?: T;
        search?: {
            mode: 'match' | 'include' | 'outcome';
            score?: number;
        };
    }>;
}
//# sourceMappingURL=types.d.ts.map