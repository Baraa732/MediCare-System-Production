import {
  AllergyRecord,
  CarePlanRecord,
  ClinicalNoteRecord,
  ConditionRecord,
  ContactInformation,
  DocumentRecord,
  EncounterRecord,
  ImmunizationRecord,
  LabResultRecord,
  MedicationRecord,
  PatientDemographics,
  ProblemRecord,
  VitalSignRecord,
} from '../types/patient-emr.types';
import { fhirCodeableText } from './fhir-bundle.util';

function officialName(fhirPatient: any): { first: string | null; middle: string | null; last: string | null } {
  const name = fhirPatient?.name?.find((n: any) => n.use === 'official') || fhirPatient?.name?.[0];
  return {
    first: name?.given?.[0] ?? null,
    middle: name?.given?.[1] ?? null,
    last: name?.family ?? null,
  };
}

function telecom(fhirPatient: any, system: string): string | null {
  return fhirPatient?.telecom?.find((t: any) => t.system === system)?.value ?? null;
}

function homeAddress(fhirPatient: any): ContactInformation {
  const address = fhirPatient?.address?.find((a: any) => a.use === 'home') || fhirPatient?.address?.[0];
  return {
    phone: telecom(fhirPatient, 'phone'),
    email: telecom(fhirPatient, 'email'),
    addressLine1: address?.line?.[0] ?? null,
    addressLine2: address?.line?.[1] ?? null,
    city: address?.city ?? null,
    state: address?.state ?? null,
    postalCode: address?.postalCode ?? null,
    country: address?.country ?? null,
  };
}

function extensionValue(fhirPatient: any, urlPart: string): string | null {
  const ext = fhirPatient?.extension?.find((e: any) => String(e.url || '').includes(urlPart));
  if (!ext) return null;
  return ext.valueString || ext.valueCode || fhirCodeableText(ext.valueCodeableConcept) || null;
}

function mapDiagnosisResource(resource: any): ProblemRecord | ConditionRecord {
  const icd10 = resource.code?.coding?.find((c: any) => String(c.system || '').includes('icd'))?.code ?? null;
  return {
    id: String(resource.id ?? ''),
    name: fhirCodeableText(resource.code),
    icd10Code: icd10,
    status: resource.clinicalStatus?.coding?.[0]?.code ?? resource.clinicalStatus?.text ?? null,
    diagnosedDate: resource.onsetDateTime ?? resource.onsetPeriod?.start ?? resource.recordedDate ?? null,
    recordedBy: resource.recorder?.display ?? resource.asserter?.display ?? null,
  };
}

function toNumber(value: string | null): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function mapFhirPatientDemographics(fhirPatient: any): PatientDemographics {
  const name = officialName(fhirPatient);
  const nationalId =
    fhirPatient?.identifier?.find((id: any) =>
      String(id.system || '').includes('ssn') || String(id.type?.text || '').toLowerCase().includes('ssn'),
    )?.value ?? null;

  return {
    firstName: name.first,
    middleName: name.middle,
    lastName: name.last,
    birthDate: fhirPatient?.birthDate ?? null,
    gender: fhirPatient?.gender ?? null,
    maritalStatus: fhirPatient?.maritalStatus?.text ?? fhirCodeableText(fhirPatient?.maritalStatus) ?? null,
    race: extensionValue(fhirPatient, 'race'),
    ethnicity: extensionValue(fhirPatient, 'ethnicity'),
    language: fhirPatient?.communication?.[0]?.language?.text
      ?? fhirCodeableText(fhirPatient?.communication?.[0]?.language)
      ?? null,
    nationalId,
  };
}

export function mapFhirContactInformation(fhirPatient: any): ContactInformation {
  return homeAddress(fhirPatient);
}

export function mapFhirAllergy(resource: any): AllergyRecord {
  return {
    id: String(resource.id ?? ''),
    allergen: fhirCodeableText(resource.code),
    severity: resource.criticality ?? resource.reaction?.[0]?.severity ?? null,
    reaction: fhirCodeableText(resource.reaction?.[0]?.manifestation?.[0]),
    recordedBy: resource.recorder?.display ?? null,
    recordedDate: resource.recordedDate ?? resource.meta?.lastUpdated ?? null,
  };
}

export function mapFhirProblem(resource: any): ProblemRecord {
  return mapDiagnosisResource(resource) as ProblemRecord;
}

export function mapFhirCondition(resource: any): ConditionRecord {
  return mapDiagnosisResource(resource) as ConditionRecord;
}

export function mapFhirMedicationRequest(resource: any): MedicationRecord {
  const dosage = resource.dosageInstruction?.[0];
  return {
    id: String(resource.id ?? ''),
    name: fhirCodeableText(resource.medicationCodeableConcept) ?? resource.medicationReference?.display ?? null,
    dosage: dosage?.doseAndRate?.[0]?.doseQuantity?.value != null
      ? `${dosage.doseAndRate[0].doseQuantity.value}${dosage.doseAndRate[0].doseQuantity.unit ? ` ${dosage.doseAndRate[0].doseQuantity.unit}` : ''}`
      : dosage?.text ?? null,
    frequency: dosage?.timing?.code?.text ?? dosage?.text ?? null,
    route: fhirCodeableText(dosage?.route),
    startDate: resource.authoredOn ?? null,
    status: resource.status ?? null,
    prescribedBy: resource.requester?.display ?? null,
  };
}

export function mapFhirEncounter(resource: any): EncounterRecord {
  return {
    id: String(resource.id ?? ''),
    date: resource.period?.start ?? resource.meta?.lastUpdated ?? null,
    type: fhirCodeableText(resource.type?.[0]),
    clinic: resource.serviceProvider?.display ?? null,
    provider: resource.participant?.[0]?.individual?.display ?? null,
    reason: fhirCodeableText(resource.reasonCode?.[0]),
    diagnosis: (resource.diagnosis ?? [])
      .map((d: any) => fhirCodeableText(d.condition))
      .filter((v: string | null): v is string => !!v),
    notes: null,
  };
}

export function mapFhirObservationToVital(resource: any): VitalSignRecord | null {
  const category = resource.category?.[0]?.coding?.[0]?.code;
  if (category !== 'vital-signs') return null;

  const code = (fhirCodeableText(resource.code) ?? '').toLowerCase();
  const value =
    resource.valueQuantity?.value != null
      ? String(resource.valueQuantity.value)
      : resource.valueString ?? null;

  const vital: VitalSignRecord = {
    date: resource.effectiveDateTime ?? resource.meta?.lastUpdated ?? null,
    heightCm: null,
    weightKg: null,
    bmi: null,
    bloodPressure: null,
    heartRate: null,
    respiratoryRate: null,
    temperatureCelsius: null,
    oxygenSaturation: null,
    recordedBy: null,
  };

  if (code.includes('blood pressure')) vital.bloodPressure = value;
  else if (code.includes('heart rate')) vital.heartRate = toNumber(value);
  else if (code.includes('respiratory')) vital.respiratoryRate = toNumber(value);
  else if (code.includes('temperature')) vital.temperatureCelsius = toNumber(value);
  else if (code.includes('oxygen')) vital.oxygenSaturation = toNumber(value);
  else if (code.includes('height')) vital.heightCm = toNumber(value);
  else if (code.includes('weight')) vital.weightKg = toNumber(value);
  else if (code.includes('bmi')) vital.bmi = toNumber(value);
  else return null;

  return vital;
}

export function mapFhirObservationToLab(resource: any): LabResultRecord | null {
  const category = resource.category?.[0]?.coding?.[0]?.code;
  if (category !== 'laboratory' && category !== 'lab') return null;

  return {
    id: String(resource.id ?? ''),
    testName: fhirCodeableText(resource.code),
    result: resource.valueQuantity?.value != null
      ? String(resource.valueQuantity.value)
      : resource.valueString ?? null,
    unit: resource.valueQuantity?.unit ?? null,
    referenceRange: resource.referenceRange?.[0]?.text ?? null,
    status: resource.status ?? null,
    performedDate: resource.effectiveDateTime ?? null,
    reviewedBy: null,
  };
}

export function mapFhirDiagnosticReport(resource: any): LabResultRecord {
  return {
    id: String(resource.id ?? ''),
    testName: fhirCodeableText(resource.code),
    result: null,
    unit: null,
    referenceRange: null,
    status: resource.status ?? null,
    performedDate: resource.effectiveDateTime ?? resource.issued ?? null,
    reviewedBy: null,
  };
}

export function mapFhirImmunization(resource: any): ImmunizationRecord {
  return {
    id: String(resource.id ?? ''),
    vaccine: fhirCodeableText(resource.vaccineCode),
    dateAdministered: resource.occurrenceDateTime ?? null,
    lotNumber: resource.lotNumber ?? null,
    administeredBy: resource.performer?.[0]?.actor?.display ?? null,
  };
}

export function mapFhirCarePlan(resource: any): CarePlanRecord {
  const goals = (resource.goal ?? [])
    .map((g: any) => g.display ?? fhirCodeableText(g))
    .filter((v: string | null): v is string => !!v);

  return {
    id: String(resource.id ?? ''),
    title: resource.title ?? fhirCodeableText(resource.category?.[0]),
    goals,
    startDate: resource.period?.start ?? null,
    status: resource.status ?? null,
    assignedBy: resource.author?.display ?? null,
  };
}

export function mapFhirDocumentReference(resource: any): DocumentRecord {
  return {
    id: String(resource.id ?? ''),
    type: fhirCodeableText(resource.type),
    fileName: resource.content?.[0]?.attachment?.title ?? null,
    uploadedBy: null,
    uploadedAt: resource.date ?? resource.meta?.lastUpdated ?? null,
    status: resource.status ?? null,
  };
}

export function mapFhirClinicalNote(resource: any): ClinicalNoteRecord {
  return {
    id: String(resource.id ?? ''),
    date: resource.effectiveDateTime ?? resource.meta?.lastUpdated ?? null,
    author: resource.performer?.[0]?.actor?.display ?? null,
    type: fhirCodeableText(resource.code),
    content: resource.conclusion ?? resource.description ?? null,
  };
}
