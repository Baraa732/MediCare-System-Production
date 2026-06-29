import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AllergyRecord,
  AuditTrailEntry,
  CarePlanRecord,
  ClinicalNoteRecord,
  ConditionRecord,
  ContactInformation,
  DocumentRecord,
  EmergencyContact,
  EncounterRecord,
  Guarantor,
  ImmunizationRecord,
  InsuranceRecord,
  LabResultRecord,
  MedicationRecord,
  PatientDemographics,
  PreferredPharmacy,
  ProblemRecord,
  VitalSignRecord,
} from '../types/patient-emr.types';
import { formatUuidFromHex } from '../fhir/fhir-bundle.util';

interface PatientRow {
  pid: number;
  fname: string;
  mname: string;
  lname: string;
  DOB: Date | string | null;
  sex: string;
  ss: string;
  street: string;
  street_line_2: string | null;
  postal_code: string;
  city: string;
  state: string;
  country_code: string;
  phone_cell: string;
  phone_home: string;
  phone_contact: string;
  contact_relationship: string;
  email: string;
  race: string;
  ethnicity: string;
  language: string;
  status: string;
  pharmacy_id: number;
  date: Date | string | null;
  guardiansname: string | null;
  guardianrelationship: string | null;
  guardianphone: string | null;
  guardianemail: string | null;
  guardianaddress: string | null;
  guardiancity: string | null;
  guardianstate: string | null;
  guardianpostalcode: string | null;
  uuid: Buffer | null;
}

@Injectable()
export class OpenEmrDbReader {
  private readonly logger = new Logger(OpenEmrDbReader.name);

  constructor(private configService: ConfigService) {}

  private async withConnection<T>(fn: (connection: any) => Promise<T>): Promise<T> {
    const host = this.configService.get<string>('OPENEMR_MYSQL_HOST') || 'mariadb-openemr';
    const user = this.configService.get<string>('OPENEMR_MYSQL_USER') || 'openemr';
    const password = this.configService.get<string>('OPENEMR_MYSQL_PASSWORD');
    const database = this.configService.get<string>('OPENEMR_MYSQL_DATABASE') || 'openemr';

    if (!password) {
      throw new Error('OPENEMR_MYSQL_PASSWORD not set');
    }

    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({ host, user, password, database });
    try {
      return await fn(connection);
    } finally {
      await connection.end();
    }
  }

  private formatDate(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  private formatDateTime(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private nonEmpty(value: unknown): string | null {
    if (value == null) return null;
    const str = String(value).trim();
    return str.length > 0 ? str : null;
  }

  private toNumber(value: unknown): number | null {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  private capitalizeStatus(status: string | null): string | null {
    if (!status) return null;
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  private async resolveUserName(connection: any, userRef: number | string | null): Promise<string | null> {
    if (!userRef) return null;
    const ref = String(userRef).trim();
    if (!ref) return null;

    const query = /^\d+$/.test(ref)
      ? ['SELECT fname, lname, title FROM users WHERE id = ? LIMIT 1', [ref]]
      : ['SELECT fname, lname, title FROM users WHERE username = ? LIMIT 1', [ref]];

    const [rows] = await connection.execute(query[0] as string, query[1] as any[]);
    const row = (rows as any[])[0];
    if (!row) return ref;
    const parts = [this.nonEmpty(row.title), this.nonEmpty(row.fname), this.nonEmpty(row.lname)].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : ref;
  }

  private async resolveFacilityName(connection: any, facilityId: number | string | null): Promise<string | null> {
    if (!facilityId) return null;
    const [rows] = await connection.execute(
      'SELECT name FROM facility WHERE id = ? LIMIT 1',
      [facilityId],
    ).catch(() => [[]]);
    return this.nonEmpty((rows as any[])[0]?.name);
  }

  async getPatientRow(pid: string): Promise<PatientRow | null> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT pid, fname, mname, lname, DOB, sex, ss, street, street_line_2, postal_code, city, state, country_code,
                phone_cell, phone_home, phone_contact, contact_relationship, email, race, ethnicity,
                language, status, pharmacy_id, date, guardiansname, guardianrelationship, guardianphone,
                guardianemail, guardianaddress, guardiancity, guardianstate, guardianpostalcode, uuid
         FROM patient_data WHERE pid = ? LIMIT 1`,
        [pid],
      );
      return (rows as PatientRow[])[0] ?? null;
    });
  }

  getPatientUuid(row: PatientRow | null): string | null {
    if (!row?.uuid) return null;
    const hex = Buffer.isBuffer(row.uuid) ? row.uuid.toString('hex').toUpperCase() : String(row.uuid);
    return formatUuidFromHex(hex);
  }

  mapDemographics(row: PatientRow): PatientDemographics {
    return {
      firstName: this.nonEmpty(row.fname),
      middleName: this.nonEmpty(row.mname),
      lastName: this.nonEmpty(row.lname),
      birthDate: this.formatDate(row.DOB),
      gender: this.nonEmpty(row.sex),
      maritalStatus: this.nonEmpty(row.status),
      race: this.nonEmpty(row.race),
      ethnicity: this.nonEmpty(row.ethnicity),
      language: this.nonEmpty(row.language),
      nationalId: this.nonEmpty(row.ss),
    };
  }

  mapContact(row: PatientRow): ContactInformation {
    return {
      phone: this.nonEmpty(row.phone_cell) ?? this.nonEmpty(row.phone_home),
      email: this.nonEmpty(row.email),
      addressLine1: this.nonEmpty(row.street),
      addressLine2: this.nonEmpty(row.street_line_2),
      city: this.nonEmpty(row.city),
      state: this.nonEmpty(row.state),
      postalCode: this.nonEmpty(row.postal_code),
      country: this.nonEmpty(row.country_code),
    };
  }

  mapEmergencyContacts(row: PatientRow): EmergencyContact[] {
    const phone = this.nonEmpty(row.phone_contact);
    const relationship = this.nonEmpty(row.contact_relationship);
    if (!phone && !relationship) return [];

    return [{
      name: this.nonEmpty(row.guardiansname),
      relationship,
      phone,
      email: this.nonEmpty(row.guardianemail),
      address: [
        this.nonEmpty(row.guardianaddress),
        this.nonEmpty(row.guardiancity),
        this.nonEmpty(row.guardianstate),
      ].filter(Boolean).join(', ') || null,
    }];
  }

  mapGuarantor(row: PatientRow): Guarantor | null {
    const name = this.nonEmpty(row.guardiansname);
    const phone = this.nonEmpty(row.guardianphone);
    const relationship = this.nonEmpty(row.guardianrelationship);
    const addressParts = [
      this.nonEmpty(row.guardianaddress),
      this.nonEmpty(row.guardiancity),
      this.nonEmpty(row.guardianstate),
      this.nonEmpty(row.guardianpostalcode),
    ].filter(Boolean);

    if (!name && !phone && !relationship && addressParts.length === 0) return null;

    return { name, relationship, phone, address: addressParts.join(', ') || null };
  }

  async getInsurance(pid: string): Promise<InsuranceRecord[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT type, provider, plan_name, policy_number, group_number, subscriber_ss,
                policy_type, date, date_end
         FROM insurance_data WHERE pid = ? ORDER BY type`,
        [pid],
      );

      return (rows as any[]).map((row) => ({
        provider: this.nonEmpty(row.provider),
        policyNumber: this.nonEmpty(row.policy_number),
        groupNumber: this.nonEmpty(row.group_number),
        memberId: this.nonEmpty(row.subscriber_ss),
        coverageType: this.nonEmpty(row.plan_name) ?? this.nonEmpty(row.policy_type) ?? this.nonEmpty(row.type),
        effectiveDate: this.formatDate(row.date),
        expirationDate: this.formatDate(row.date_end),
        status: row.date_end ? 'inactive' : 'active',
      }));
    });
  }

  async getPharmacy(pharmacyId: number): Promise<PreferredPharmacy | null> {
    if (!pharmacyId) return null;
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, name, email FROM pharmacies WHERE id = ? LIMIT 1',
        [pharmacyId],
      );
      const row = (rows as any[])[0];
      if (!row) return null;
      return {
        name: this.nonEmpty(row.name),
        phone: this.nonEmpty(row.email),
        address: null,
      };
    });
  }

  async getAllergies(pid: string): Promise<AllergyRecord[]> {
    return this.getListRecords(pid, 'allergy', (row) => ({
      id: String(row.id),
      allergen: this.nonEmpty(row.title) ?? this.nonEmpty(row.diagnosis),
      reaction: this.nonEmpty(row.comments),
      severity: row.outcome != null ? String(row.outcome) : null,
      recordedBy: this.nonEmpty(row.user),
      recordedDate: this.formatDate(row.begdate ?? row.date),
    }));
  }

  async getProblems(pid: string): Promise<ProblemRecord[]> {
    return this.getListRecords(pid, 'medical_problem', (row) => ({
      id: String(row.id),
      name: this.nonEmpty(row.title) ?? this.nonEmpty(row.diagnosis),
      icd10Code: this.nonEmpty(row.diagnosis),
      status: this.capitalizeStatus(row.activity === 1 ? 'active' : 'inactive'),
      diagnosedDate: this.formatDate(row.begdate),
      recordedBy: this.nonEmpty(row.user),
    }));
  }

  async getConditions(_pid: string): Promise<ConditionRecord[]> {
    return [];
  }

  async getMedications(pid: string): Promise<MedicationRecord[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id, drug, dosage, route, start_date, date_modified, provider_id, \`interval\`, active
         FROM prescriptions WHERE patient_id = ? ORDER BY date_modified DESC`,
        [pid],
      );

      const medications: MedicationRecord[] = [];
      for (const row of rows as any[]) {
        medications.push({
          id: String(row.id),
          name: this.nonEmpty(row.drug),
          dosage: this.nonEmpty(row.dosage),
          frequency: row.interval != null ? String(row.interval) : null,
          route: this.nonEmpty(row.route),
          startDate: this.formatDate(row.start_date),
          status: row.active === 1 ? 'Active' : 'Inactive',
          prescribedBy: await this.resolveUserName(connection, row.provider_id),
        });
      }

      if (medications.length > 0) return medications;

      return this.getListRecords(pid, 'medication', (row) => ({
        id: String(row.id),
        name: this.nonEmpty(row.title),
        dosage: null,
        frequency: null,
        route: null,
        startDate: this.formatDate(row.begdate),
        status: this.capitalizeStatus(row.activity === 1 ? 'active' : 'inactive'),
        prescribedBy: this.nonEmpty(row.user),
      }));
    });
  }

  async getEncounters(pid: string): Promise<EncounterRecord[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id, date, reason, encounter, provider_id, facility_id, pc_catid
         FROM form_encounter WHERE pid = ? ORDER BY date DESC`,
        [pid],
      );

      const encounters: EncounterRecord[] = [];
      for (const row of rows as any[]) {
        encounters.push({
          id: String(row.encounter ?? row.id),
          date: this.formatDateTime(row.date),
          type: row.pc_catid ? String(row.pc_catid) : null,
          clinic: await this.resolveFacilityName(connection, row.facility_id),
          provider: await this.resolveUserName(connection, row.provider_id),
          reason: this.nonEmpty(row.reason),
          diagnosis: [],
          notes: null,
        });
      }
      return encounters;
    });
  }

  async getVitalSigns(pid: string): Promise<VitalSignRecord[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id, date, bps, bpd, pulse, respiration, temperature, oxygen_saturation, height, weight, BMI, user
         FROM form_vitals WHERE pid = ? AND activity = 1 ORDER BY date DESC`,
        [pid],
      );

      const vitals: VitalSignRecord[] = [];
      for (const row of rows as any[]) {
        const bp = [this.nonEmpty(row.bps), this.nonEmpty(row.bpd)].filter(Boolean).join('/');
        vitals.push({
          date: this.formatDateTime(row.date),
          bloodPressure: bp || null,
          heartRate: this.toNumber(row.pulse),
          respiratoryRate: this.toNumber(row.respiration),
          temperatureCelsius: this.toNumber(row.temperature),
          oxygenSaturation: this.toNumber(row.oxygen_saturation),
          heightCm: this.toNumber(row.height),
          weightKg: this.toNumber(row.weight),
          bmi: this.toNumber(row.BMI),
          recordedBy: await this.resolveUserName(connection, row.user),
        });
      }
      return vitals;
    });
  }

  async getLabResults(pid: string): Promise<LabResultRecord[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT pr.procedure_result_id AS id, pr.result_code, pr.result_text, pr.result, pr.units,
                pr.range, pr.result_status, pr.abnormal, po.provider_id, pr.date
         FROM procedure_result pr
         INNER JOIN procedure_report rep ON rep.procedure_report_id = pr.procedure_report_id
         INNER JOIN procedure_order po ON po.procedure_order_id = rep.procedure_order_id
         WHERE po.patient_id = ?
         ORDER BY pr.date DESC`,
        [pid],
      );

      const results: LabResultRecord[] = [];
      for (const row of rows as any[]) {
        results.push({
          id: String(row.id),
          testName: this.nonEmpty(row.result_text),
          result: this.nonEmpty(row.result),
          unit: this.nonEmpty(row.units),
          referenceRange: this.nonEmpty(row.range),
          status: this.nonEmpty(row.abnormal) ?? this.nonEmpty(row.result_status),
          performedDate: this.formatDate(row.date),
          reviewedBy: await this.resolveUserName(connection, row.provider_id),
        });
      }
      return results;
    });
  }

  async getImmunizations(pid: string): Promise<ImmunizationRecord[]> {
    return this.getListRecords(pid, 'immunization', (row) => ({
      id: String(row.id),
      vaccine: this.nonEmpty(row.title) ?? this.nonEmpty(row.diagnosis),
      dateAdministered: this.formatDate(row.begdate ?? row.date),
      lotNumber: this.nonEmpty(row.extrainfo) ?? this.nonEmpty(row.udi),
      administeredBy: this.nonEmpty(row.user),
    }));
  }

  async getCarePlans(_pid: string): Promise<CarePlanRecord[]> {
    return [];
  }

  async getClinicalNotes(pid: string): Promise<ClinicalNoteRecord[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id, code, codetext, description, user, date
         FROM form_clinical_notes WHERE pid = ? AND activity = 1 ORDER BY date DESC`,
        [pid],
      );

      const notes: ClinicalNoteRecord[] = [];
      for (const row of rows as any[]) {
        notes.push({
          id: String(row.id),
          date: this.formatDateTime(row.date),
          author: await this.resolveUserName(connection, row.user),
          type: this.nonEmpty(row.codetext) ?? this.nonEmpty(row.code),
          content: this.nonEmpty(row.description),
        });
      }
      return notes;
    });
  }

  async getDocuments(pid: string): Promise<DocumentRecord[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id, name, mimetype, date, owner, type
         FROM documents WHERE foreign_id = ? ORDER BY date DESC`,
        [pid],
      );

      const docs: DocumentRecord[] = [];
      for (const row of rows as any[]) {
        docs.push({
          id: String(row.id),
          type: this.nonEmpty(row.type) ?? this.nonEmpty(row.mimetype),
          fileName: this.nonEmpty(row.name),
          uploadedBy: await this.resolveUserName(connection, row.owner),
          uploadedAt: this.formatDateTime(row.date),
          status: null,
        });
      }
      return docs;
    });
  }

  async getAuditTrail(pid: string): Promise<AuditTrailEntry[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id, type, user_id, comments, created_time
         FROM audit_master WHERE pid = ? ORDER BY created_time DESC LIMIT 25`,
        [pid],
      ).catch(() => [[]]);

      const entries: AuditTrailEntry[] = [];
      for (const row of rows as any[]) {
        entries.push({
          timestamp: this.formatDateTime(row.created_time),
          action: row.type != null ? `AUDIT_TYPE_${row.type}` : null,
          performedBy: await this.resolveUserName(connection, row.user_id),
          details: this.nonEmpty(row.comments),
        });
      }
      return entries;
    });
  }

  async getLastVisitDate(pid: string): Promise<string | null> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT MAX(date) AS last_visit FROM form_encounter WHERE pid = ?',
        [pid],
      );
      return this.formatDateTime((rows as any[])[0]?.last_visit);
    });
  }

  private async getListRecords<T>(
    pid: string,
    type: string,
    mapper: (row: any) => T,
  ): Promise<T[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id, date, title, diagnosis, comments, user, begdate, enddate, activity, extrainfo, udi, outcome
         FROM lists WHERE pid = ? AND type = ? AND (activity IS NULL OR activity = 1)
         ORDER BY date DESC`,
        [pid, type],
      );
      return (rows as any[]).map(mapper);
    });
  }
}
