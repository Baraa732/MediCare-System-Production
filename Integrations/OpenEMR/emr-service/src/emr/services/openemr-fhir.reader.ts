import { Injectable, Logger } from '@nestjs/common';
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
import { extractBundleEntries } from '../fhir/fhir-bundle.util';
import {
  mapFhirAllergy,
  mapFhirCarePlan,
  mapFhirClinicalNote,
  mapFhirCondition,
  mapFhirContactInformation,
  mapFhirDiagnosticReport,
  mapFhirDocumentReference,
  mapFhirEncounter,
  mapFhirImmunization,
  mapFhirMedicationRequest,
  mapFhirObservationToLab,
  mapFhirObservationToVital,
  mapFhirPatientDemographics,
  mapFhirProblem,
} from '../fhir/fhir-mappers';
import { OpenEmrClient } from './openemr.client';

export interface FhirClinicalData {
  demographics: PatientDemographics | null;
  contactInformation: ContactInformation | null;
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
  available: boolean;
}

@Injectable()
export class OpenEmrFhirReader {
  private readonly logger = new Logger(OpenEmrFhirReader.name);

  constructor(private openEmrClient: OpenEmrClient) {}

  private async safeSearch(resourceType: string, params: Record<string, string>): Promise<unknown> {
    try {
      return await this.openEmrClient.fhirSearch(resourceType, params);
    } catch (error: any) {
      this.logger.debug(`FHIR ${resourceType} search skipped: ${error.message}`);
      return { resourceType: 'Bundle', type: 'searchset', entry: [] };
    }
  }

  private groupVitalsByDate(vitals: VitalSignRecord[]): VitalSignRecord[] {
    const grouped = new Map<string, VitalSignRecord>();

    for (const vital of vitals) {
      const key = vital.date ? vital.date.slice(0, 16) : 'unknown';
      const existing = grouped.get(key) ?? {
        date: vital.date,
        heightCm: null,
        weightKg: null,
        bmi: null,
        bloodPressure: null,
        heartRate: null,
        respiratoryRate: null,
        temperatureCelsius: null,
        oxygenSaturation: null,
        recordedBy: vital.recordedBy,
      };

      grouped.set(key, {
        date: existing.date ?? vital.date,
        heightCm: vital.heightCm ?? existing.heightCm,
        weightKg: vital.weightKg ?? existing.weightKg,
        bmi: vital.bmi ?? existing.bmi,
        bloodPressure: vital.bloodPressure ?? existing.bloodPressure,
        heartRate: vital.heartRate ?? existing.heartRate,
        respiratoryRate: vital.respiratoryRate ?? existing.respiratoryRate,
        temperatureCelsius: vital.temperatureCelsius ?? existing.temperatureCelsius,
        oxygenSaturation: vital.oxygenSaturation ?? existing.oxygenSaturation,
        recordedBy: vital.recordedBy ?? existing.recordedBy,
      });
    }

    return Array.from(grouped.values());
  }

  async loadClinicalData(openemrPatientId: string, patientUuid: string | null): Promise<FhirClinicalData> {
    const patientRef = patientUuid ?? openemrPatientId;
    const empty: FhirClinicalData = {
      demographics: null,
      contactInformation: null,
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
      available: false,
    };

    try {
      const [
        patient,
        allergies,
        conditions,
        medications,
        encounters,
        observations,
        diagnosticReports,
        immunizations,
        carePlans,
        documents,
      ] = await Promise.all([
        this.openEmrClient.fhirRead<any>(`/fhir/Patient/${openemrPatientId}`).catch(() => null),
        this.safeSearch('AllergyIntolerance', { patient: patientRef }),
        this.safeSearch('Condition', { patient: patientRef }),
        this.safeSearch('MedicationRequest', { patient: patientRef }),
        this.safeSearch('Encounter', { patient: patientRef }),
        this.safeSearch('Observation', { patient: patientRef }),
        this.safeSearch('DiagnosticReport', { patient: patientRef }),
        this.safeSearch('Immunization', { patient: patientRef }),
        this.safeSearch('CarePlan', { patient: patientRef }),
        this.safeSearch('DocumentReference', { patient: patientRef }),
      ]);

      const vitalObservations: VitalSignRecord[] = [];
      const labResults: LabResultRecord[] = [];

      for (const observation of extractBundleEntries<any>(observations)) {
        const vital = mapFhirObservationToVital(observation);
        if (vital) {
          vitalObservations.push(vital);
          continue;
        }
        const lab = mapFhirObservationToLab(observation);
        if (lab) labResults.push(lab);
      }

      for (const report of extractBundleEntries<any>(diagnosticReports)) {
        labResults.push(mapFhirDiagnosticReport(report));
      }

      const conditionResources = extractBundleEntries<any>(conditions).map(mapFhirCondition);

      return {
        demographics: patient ? mapFhirPatientDemographics(patient) : null,
        contactInformation: patient ? mapFhirContactInformation(patient) : null,
        allergies: extractBundleEntries<any>(allergies).map(mapFhirAllergy),
        problems: conditionResources,
        conditions: conditionResources,
        medications: extractBundleEntries<any>(medications).map(mapFhirMedicationRequest),
        encounters: extractBundleEntries<any>(encounters).map(mapFhirEncounter),
        vitalSigns: this.groupVitalsByDate(vitalObservations),
        labResults,
        immunizations: extractBundleEntries<any>(immunizations).map(mapFhirImmunization),
        carePlans: extractBundleEntries<any>(carePlans).map(mapFhirCarePlan),
        clinicalNotes: extractBundleEntries<any>(diagnosticReports)
          .filter((r) => r.conclusion)
          .map(mapFhirClinicalNote),
        documents: extractBundleEntries<any>(documents).map(mapFhirDocumentReference),
        available: true,
      };
    } catch (error: any) {
      this.logger.warn(`FHIR clinical read failed for patient ${openemrPatientId}: ${error.message}`);
      return empty;
    }
  }
}
