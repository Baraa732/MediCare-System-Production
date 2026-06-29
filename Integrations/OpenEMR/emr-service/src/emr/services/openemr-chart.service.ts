import { Injectable } from '@nestjs/common';
import {
  DEFAULT_DATA_OWNERSHIP,
  EmrDataSource,
  PatientDemographics,
  PatientEmrChart,
  SyncMetadata,
  VitalSignRecord,
} from '../types/patient-emr.types';
import { OpenEmrDbReader } from './openemr-db.reader';
import { OpenEmrFhirReader } from './openemr-fhir.reader';
import { EmrTenantGuardService } from './emr-tenant-guard.service';

function mergeScalar<T>(fhirValue: T | null | undefined, dbValue: T | null | undefined): T | null {
  if (fhirValue != null && String(fhirValue).trim() !== '') return fhirValue;
  if (dbValue != null && String(dbValue).trim() !== '') return dbValue;
  return null;
}

function mergeDemographics(fhir: PatientDemographics | null, db: PatientDemographics): PatientDemographics {
  return {
    firstName: mergeScalar(fhir?.firstName, db.firstName),
    middleName: mergeScalar(fhir?.middleName, db.middleName),
    lastName: mergeScalar(fhir?.lastName, db.lastName),
    birthDate: mergeScalar(fhir?.birthDate, db.birthDate),
    gender: mergeScalar(fhir?.gender, db.gender),
    maritalStatus: mergeScalar(fhir?.maritalStatus, db.maritalStatus),
    race: mergeScalar(fhir?.race, db.race),
    ethnicity: mergeScalar(fhir?.ethnicity, db.ethnicity),
    language: mergeScalar(fhir?.language, db.language),
    nationalId: mergeScalar(fhir?.nationalId, db.nationalId),
  };
}

function preferNonEmptyArray<T extends { id: string }>(
  fhirItems: T[],
  dbItems: T[],
): { items: T[]; source: EmrDataSource } {
  if (fhirItems.length > 0 && dbItems.length > 0) {
    const seen = new Set(fhirItems.map((item) => item.id));
    return { items: [...fhirItems, ...dbItems.filter((item) => !seen.has(item.id))], source: 'mixed' };
  }
  if (fhirItems.length > 0) return { items: fhirItems, source: 'openemr' };
  if (dbItems.length > 0) return { items: dbItems, source: 'openemr' };
  return { items: [], source: 'openemr' };
}

function toSourceKey(source: EmrDataSource): EmrDataSource {
  return source === 'mixed' ? 'mixed' : 'openemr';
}

function mergeVitalSigns(fhirItems: VitalSignRecord[], dbItems: VitalSignRecord[]): { items: VitalSignRecord[]; source: EmrDataSource } {
  if (fhirItems.length > 0 && dbItems.length > 0) {
    const seen = new Set(fhirItems.map((item) => item.date ?? ''));
    return {
      items: [...fhirItems, ...dbItems.filter((item) => !seen.has(item.date ?? ''))],
      source: 'mixed',
    };
  }
  if (fhirItems.length > 0) return { items: fhirItems, source: 'openemr' };
  if (dbItems.length > 0) return { items: dbItems, source: 'openemr' };
  return { items: [], source: 'openemr' };
}

@Injectable()
export class OpenEmrChartService {
  constructor(
    private dbReader: OpenEmrDbReader,
    private fhirReader: OpenEmrFhirReader,
    private tenantGuard: EmrTenantGuardService,
  ) {}

  async getPatientChart(params: {
    tenantId: string;
    openemrPatientId: string;
    medicareUserId: string;
    syncStatus: string;
    lastSyncAt: string;
  }): Promise<PatientEmrChart> {
    const { tenantId, openemrPatientId, medicareUserId, syncStatus, lastSyncAt } = params;

    await this.tenantGuard.assertOpenEmrPatientBelongsToTenant(openemrPatientId, tenantId);

    const patientRow = await this.dbReader.getPatientRow(openemrPatientId);

    if (!patientRow) {
      throw new Error(`OpenEMR patient ${openemrPatientId} not found`);
    }

    const patientUuid = this.dbReader.getPatientUuid(patientRow);
    const [
      fhir,
      insurance,
      pharmacy,
      allergiesDb,
      problemsDb,
      conditionsDb,
      medicationsDb,
      encountersDb,
      vitalSignsDb,
      labResultsDb,
      immunizationsDb,
      carePlansDb,
      clinicalNotesDb,
      documentsDb,
      auditTrail,
      lastVisitDate,
    ] = await Promise.all([
      this.fhirReader.loadClinicalData(openemrPatientId, patientUuid),
      this.dbReader.getInsurance(openemrPatientId),
      this.dbReader.getPharmacy(patientRow.pharmacy_id),
      this.dbReader.getAllergies(openemrPatientId),
      this.dbReader.getProblems(openemrPatientId),
      this.dbReader.getConditions(openemrPatientId),
      this.dbReader.getMedications(openemrPatientId),
      this.dbReader.getEncounters(openemrPatientId),
      this.dbReader.getVitalSigns(openemrPatientId),
      this.dbReader.getLabResults(openemrPatientId),
      this.dbReader.getImmunizations(openemrPatientId),
      this.dbReader.getCarePlans(openemrPatientId),
      this.dbReader.getClinicalNotes(openemrPatientId),
      this.dbReader.getDocuments(openemrPatientId),
      this.dbReader.getAuditTrail(openemrPatientId),
      this.dbReader.getLastVisitDate(openemrPatientId),
    ]);

    const dbDemographics = this.dbReader.mapDemographics(patientRow);
    const dbContact = this.dbReader.mapContact(patientRow);

    const allergies = preferNonEmptyArray(fhir.allergies, allergiesDb);
    const problems = preferNonEmptyArray(fhir.problems, problemsDb);
    const conditions = preferNonEmptyArray(fhir.conditions, conditionsDb);
    const medications = preferNonEmptyArray(fhir.medications, medicationsDb);
    const encounters = preferNonEmptyArray(fhir.encounters, encountersDb);
    const vitalSigns = mergeVitalSigns(fhir.vitalSigns, vitalSignsDb);
    const labResults = preferNonEmptyArray(fhir.labResults, labResultsDb);
    const immunizations = preferNonEmptyArray(fhir.immunizations, immunizationsDb);
    const carePlans = preferNonEmptyArray(fhir.carePlans, carePlansDb);
    const clinicalNotes = preferNonEmptyArray(fhir.clinicalNotes, clinicalNotesDb);
    const documents = preferNonEmptyArray(fhir.documents, documentsDb);

    const sources: SyncMetadata['sources'] = {
      patient: 'openemr',
      contactInformation: 'openemr',
      allergies: toSourceKey(allergies.source),
      problems: toSourceKey(problems.source),
      conditions: toSourceKey(conditions.source),
      medications: toSourceKey(medications.source),
      encounters: toSourceKey(encounters.source),
      vitalSigns: toSourceKey(vitalSigns.source),
      labResults: toSourceKey(labResults.source),
      immunizations: toSourceKey(immunizations.source),
      carePlans: toSourceKey(carePlans.source),
      clinicalNotes: toSourceKey(clinicalNotes.source),
      documents: documents.items.length > 0 ? 'openemr' : 'openemr',
      insurance: 'openemr',
      guarantor: 'openemr',
      emergencyContacts: 'openemr',
      preferredPharmacy: 'openemr',
      auditTrail: auditTrail.length > 0 ? 'openemr' : 'medicare',
    };

    return {
      patient: mergeDemographics(fhir.demographics, dbDemographics),
      contactInformation: {
        phone: mergeScalar(fhir.contactInformation?.phone, dbContact.phone),
        email: mergeScalar(fhir.contactInformation?.email, dbContact.email),
        addressLine1: mergeScalar(fhir.contactInformation?.addressLine1, dbContact.addressLine1),
        addressLine2: mergeScalar(fhir.contactInformation?.addressLine2, dbContact.addressLine2),
        city: mergeScalar(fhir.contactInformation?.city, dbContact.city),
        state: mergeScalar(fhir.contactInformation?.state, dbContact.state),
        postalCode: mergeScalar(fhir.contactInformation?.postalCode, dbContact.postalCode),
        country: mergeScalar(fhir.contactInformation?.country, dbContact.country),
      },
      emergencyContacts: this.dbReader.mapEmergencyContacts(patientRow),
      insurance,
      guarantor: this.dbReader.mapGuarantor(patientRow),
      preferredPharmacy: pharmacy,
      allergies: allergies.items,
      problems: problems.items,
      conditions: conditions.items,
      medications: medications.items,
      encounters: encounters.items,
      vitalSigns: vitalSigns.items,
      labResults: labResults.items,
      immunizations: immunizations.items,
      carePlans: carePlans.items,
      clinicalNotes: clinicalNotes.items,
      documents: documents.items,
      auditTrail,
      syncMetadata: {
        medicareUserId,
        openEmrPid: openemrPatientId,
        syncStatus,
        lastSyncAt,
        lastVisitDate,
        sources,
      },
      dataOwnership: DEFAULT_DATA_OWNERSHIP,
    };
  }
}
