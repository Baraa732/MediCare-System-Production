export interface PatientDemographics {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  birthDate: string | null;
  gender: string | null;
  maritalStatus: string | null;
  race: string | null;
  ethnicity: string | null;
  language: string | null;
  nationalId: string | null;
}

export interface ContactInformation {
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface EmergencyContact {
  name: string | null;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface InsuranceRecord {
  provider: string | null;
  policyNumber: string | null;
  groupNumber: string | null;
  memberId: string | null;
  coverageType: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  status: string | null;
}

export interface PreferredPharmacy {
  name: string | null;
  phone: string | null;
  address: string | null;
}

export interface Guarantor {
  name: string | null;
  relationship: string | null;
  phone: string | null;
  address: string | null;
}

export interface AllergyRecord {
  id: string;
  allergen: string | null;
  reaction: string | null;
  severity: string | null;
  recordedDate: string | null;
  recordedBy: string | null;
  clinicName?: string | null;
}

export interface ProblemRecord {
  id: string;
  name: string | null;
  icd10Code: string | null;
  status: string | null;
  diagnosedDate: string | null;
  recordedBy: string | null;
  clinicName?: string | null;
}

export interface ConditionRecord {
  id: string;
  name: string | null;
  icd10Code: string | null;
  status: string | null;
  diagnosedDate: string | null;
  recordedBy: string | null;
  clinicName?: string | null;
}

export interface MedicationRecord {
  id: string;
  name: string | null;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  startDate: string | null;
  status: string | null;
  prescribedBy: string | null;
  clinicName?: string | null;
}

export interface EncounterRecord {
  id: string;
  date: string | null;
  type: string | null;
  clinic: string | null;
  provider: string | null;
  reason: string | null;
  diagnosis: string[];
  notes: string | null;
}

export interface VitalSignRecord {
  date: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  bloodPressure: string | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  temperatureCelsius: number | null;
  oxygenSaturation: number | null;
  recordedBy: string | null;
  clinicName?: string | null;
}

export interface LabResultRecord {
  id: string;
  testName: string | null;
  result: string | null;
  unit: string | null;
  referenceRange: string | null;
  status: string | null;
  performedDate: string | null;
  reviewedBy: string | null;
  clinicName?: string | null;
}

export interface ImmunizationRecord {
  id: string;
  vaccine: string | null;
  dateAdministered: string | null;
  lotNumber: string | null;
  administeredBy: string | null;
  clinicName?: string | null;
}

export interface CarePlanRecord {
  id: string;
  title: string | null;
  goals: string[];
  startDate: string | null;
  status: string | null;
  assignedBy: string | null;
  clinicName?: string | null;
}

export interface ClinicalNoteRecord {
  id: string;
  date: string | null;
  author: string | null;
  type: string | null;
  content: string | null;
  clinicName?: string | null;
}

export interface DocumentRecord {
  id: string;
  type: string | null;
  fileName: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  status: string | null;
}

export interface AuditTrailEntry {
  timestamp: string | null;
  action: string | null;
  performedBy: string | null;
  details: string | null;
}

export type EmrDataSource = 'openemr' | 'medicare' | 'mixed';

export interface SyncMetadata {
  medicareUserId: string;
  openEmrPid: string;
  syncStatus: string;
  lastSyncAt: string;
  lastVisitDate: string | null;
  sources: Record<string, EmrDataSource>;
}

export interface DataOwnership {
  patientEditable: string[];
  doctorManaged: string[];
  nurseManaged: string[];
  systemManaged: string[];
}

export interface PatientEmrChart {
  patient: PatientDemographics;
  contactInformation: ContactInformation;
  emergencyContacts: EmergencyContact[];
  insurance: InsuranceRecord[];
  guarantor: Guarantor | null;
  preferredPharmacy: PreferredPharmacy | null;
  allergies: AllergyRecord[];
  problems: ProblemRecord[];
  conditions: ConditionRecord[];
  medications: MedicationRecord[];
  encounters: EncounterRecord[];
  vitalSigns: VitalSignRecord[];
  labResults: LabResultRecord[];
  immunizations: ImmunizationRecord[];
  carePlans: CarePlanRecord[];
  clinicalNotes: ClinicalNoteRecord[];
  documents: DocumentRecord[];
  auditTrail: AuditTrailEntry[];
  syncMetadata: SyncMetadata;
  dataOwnership: DataOwnership;
}

export const DEFAULT_DATA_OWNERSHIP: DataOwnership = {
  patientEditable: [
    'patient',
    'contactInformation',
    'emergencyContacts',
  ],
  doctorManaged: [
    'allergies',
    'problems',
    'conditions',
    'medications',
    'encounters',
    'labResults',
    'immunizations',
    'carePlans',
    'clinicalNotes',
  ],
  nurseManaged: ['vitalSigns'],
  systemManaged: ['syncMetadata', 'auditTrail', 'guarantor'],
};

export function emptyPatientChart(
  medicareUserId: string,
  extras?: Partial<PatientEmrChart>,
): PatientEmrChart {
  return {
    patient: {
      firstName: null,
      middleName: null,
      lastName: null,
      birthDate: null,
      gender: null,
      maritalStatus: null,
      race: null,
      ethnicity: null,
      language: null,
      nationalId: null,
    },
    contactInformation: {
      phone: null,
      email: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
    },
    emergencyContacts: [],
    insurance: [],
    guarantor: null,
    preferredPharmacy: null,
    allergies: [],
    problems: [],
    conditions: [],
    medications: [],
    encounters: [],
    vitalSigns: [],
    labResults: [],
    immunizations: [],
    carePlans: [],
    clinicalNotes: [],
    documents: [],
    auditTrail: [],
    syncMetadata: {
      medicareUserId,
      openEmrPid: '',
      syncStatus: 'READY',
      lastSyncAt: new Date().toISOString(),
      lastVisitDate: null,
      sources: {
        patient: 'openemr',
        contactInformation: 'openemr',
        allergies: 'openemr',
        problems: 'openemr',
        conditions: 'openemr',
        medications: 'openemr',
        encounters: 'openemr',
        vitalSigns: 'openemr',
        labResults: 'openemr',
        immunizations: 'openemr',
        carePlans: 'openemr',
        clinicalNotes: 'openemr',
        documents: 'openemr',
      },
    },
    dataOwnership: DEFAULT_DATA_OWNERSHIP,
    ...extras,
  };
}
