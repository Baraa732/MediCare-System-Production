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
      // OpenEMR itself disables strict SQL mode. Railway MariaDB defaults keep
      // STRICT_TRANS_TABLES, which rejects inserts that omit NOT NULL columns
      // whose DEFAULT is NULL (txDate, usage_category_title, …).
      await connection
        .query(
          `SET SESSION sql_mode = REPLACE(REPLACE(REPLACE(REPLACE(@@sql_mode,
            'STRICT_TRANS_TABLES', ''),
            'STRICT_ALL_TABLES', ''),
            'NO_ZERO_DATE', ''),
            'NO_ZERO_IN_DATE', '')`,
        )
        .catch(() => undefined);
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

  private readonly patientSelect = `SELECT pid, fname, mname, lname, DOB, sex, ss, street, street_line_2, postal_code, city, state, country_code,
                phone_cell, phone_home, phone_contact, contact_relationship, email, race, ethnicity,
                language, status, pharmacy_id, date, guardiansname, guardianrelationship, guardianphone,
                guardianemail, guardianaddress, guardiancity, guardianstate, guardianpostalcode, uuid
         FROM patient_data`;

  async getPatientRow(pidOrUuid: string): Promise<PatientRow | null> {
    return this.withConnection(async (connection) => {
      if (/^\d+$/.test(pidOrUuid)) {
        const [rows] = await connection.execute(
          `${this.patientSelect} WHERE pid = ? LIMIT 1`,
          [pidOrUuid],
        );
        if ((rows as PatientRow[])[0]) return (rows as PatientRow[])[0];
      }

      const hex = pidOrUuid.replace(/-/g, '');
      if (/^[0-9a-fA-F]{32}$/.test(hex)) {
        const [rows] = await connection.execute(
          `${this.patientSelect} WHERE uuid = UNHEX(?) LIMIT 1`,
          [hex],
        );
        return (rows as PatientRow[])[0] ?? null;
      }

      return null;
    });
  }

  /**
   * Finds an existing OpenEMR patient by phone, or inserts into patient_data.
   * Used when FHIR/standard API auth is unavailable (common 401 on Railway).
   */
  async createOrFindPatient(input: {
    userId: string;
    phoneNumber: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    gender?: string;
    birthDate?: string;
  }): Promise<string> {
    return this.withConnection(async (connection) => {
      const phone = (input.phoneNumber || '').trim();
      if (phone) {
        const [existing] = await connection.execute(
          `SELECT pid FROM patient_data
           WHERE phone_cell = ? OR phone_home = ? OR phone_contact = ?
           ORDER BY pid DESC LIMIT 1`,
          [phone, phone, phone],
        );
        const found = (existing as any[])[0]?.pid;
        if (found != null) {
          this.logger.log(`Reusing OpenEMR patient pid=${found} for phone ${phone}`);
          return String(found);
        }
      }

      const sex =
        !input.gender
          ? 'Unknown'
          : /^(m|male)$/i.test(input.gender)
            ? 'Male'
            : /^(f|female)$/i.test(input.gender)
              ? 'Female'
              : 'Unknown';
      const dob = input.birthDate?.slice(0, 10) || '1990-01-01';
      const fname = (input.firstName || 'MediCare').slice(0, 255);
      const lname = (input.lastName || 'Patient').slice(0, 255);
      const email = (input.email || '').slice(0, 255);
      const pubpid = `MC-${input.userId.replace(/-/g, '').slice(0, 12)}`;

      let insertId: number;
      try {
        const [result] = await connection.execute(
          `INSERT INTO patient_data
            (date, fname, lname, DOB, sex, phone_cell, email, pubpid, pid, regdate)
           VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
          [fname, lname, dob, sex, phone, email, pubpid],
        );
        insertId = Number((result as any)?.insertId);
      } catch (primaryError: any) {
        this.logger.warn(
          `Minimal patient_data insert failed, retrying bare columns: ${primaryError?.message}`,
        );
        const [result] = await connection.execute(
          `INSERT INTO patient_data (fname, lname, DOB, sex, phone_cell, pid)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [fname, lname, dob, sex, phone],
        );
        insertId = Number((result as any)?.insertId);
      }

      if (!Number.isFinite(insertId) || insertId <= 0) {
        throw new Error('Could not create OpenEMR patient_data row');
      }

      // OpenEMR convention: pid mirrors the auto-increment id.
      await connection
        .execute(`UPDATE patient_data SET pid = ? WHERE id = ?`, [insertId, insertId])
        .catch(() => undefined);

      this.logger.log(
        `Created OpenEMR patient pid=${insertId} via MySQL for MediCare user ${input.userId}`,
      );
      return String(insertId);
    });
  }

  /**
   * Writes the OpenEMR Standard API patient columns (`patient_data`).
   * Used when FHIR/standard HTTP update is unavailable.
   */
  async updatePatientPortalFields(
    pid: string | number,
    fields: Record<string, string | null>,
  ): Promise<void> {
    const allowed = new Set([
      'fname',
      'mname',
      'lname',
      'DOB',
      'sex',
      'status',
      'language',
      'street',
      'street_line_2',
      'city',
      'state',
      'postal_code',
      'country_code',
      'phone_cell',
      'phone_home',
      'email',
      'contact_relationship',
      'phone_contact',
      'guardiansname',
      'guardianemail',
      'guardianphone',
      'guardianrelationship',
      'guardianaddress',
    ]);

    const sets: string[] = [];
    const values: Array<string | number> = [];
    for (const [key, value] of Object.entries(fields)) {
      if (!allowed.has(key) || value === undefined) continue;
      sets.push(`\`${key}\` = ?`);
      values.push(value ?? '');
    }
    if (sets.length === 0) return;

    await this.withConnection(async (connection) => {
      await connection.execute(
        `UPDATE patient_data SET ${sets.join(', ')} WHERE pid = ?`,
        [...values, pid],
      );
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
    const name = this.nonEmpty(row.guardiansname);
    const phone =
      this.nonEmpty(row.phone_contact) ?? this.nonEmpty(row.guardianphone);
    const relationship =
      this.nonEmpty(row.contact_relationship) ??
      this.nonEmpty(row.guardianrelationship);
    const email = this.nonEmpty(row.guardianemail);
    if (!name && !phone && !relationship && !email) return [];

    return [{
      name,
      relationship,
      phone,
      email,
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
    return this.getListRecords(pid, 'allergy', (row) => {
      const attr = this.parseAttribution(row.comments);
      return {
        id: String(row.id),
        allergen: this.nonEmpty(row.title) ?? this.nonEmpty(row.diagnosis),
        reaction: attr.remainder || null,
        severity: null,
        recordedBy: this.displayAuthor(attr.doctorName, null, row.user),
        recordedDate: this.formatDate(row.begdate ?? row.date),
        clinicName: attr.clinicName,
      };
    });
  }

  async getProblems(pid: string): Promise<ProblemRecord[]> {
    return this.getListRecords(pid, 'medical_problem', (row) => {
      const attr = this.parseAttribution(row.comments);
      return {
        id: String(row.id),
        name: this.nonEmpty(row.title) ?? this.nonEmpty(row.diagnosis),
        icd10Code: this.nonEmpty(row.diagnosis),
        status:
          attr.remainder ||
          this.capitalizeStatus(row.activity === 1 ? 'active' : 'inactive'),
        diagnosedDate: this.formatDate(row.begdate),
        recordedBy: this.displayAuthor(attr.doctorName, null, row.user),
        clinicName: attr.clinicName,
      };
    });
  }

  async getConditions(pid: string): Promise<ConditionRecord[]> {
    return this.getProblems(pid);
  }

  async getMedications(pid: string): Promise<MedicationRecord[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id, drug, dosage, route, start_date, date_modified, provider_id, \`interval\`,
                active, note, \`user\`
         FROM prescriptions WHERE patient_id = ? ORDER BY date_modified DESC`,
        [pid],
      );

      const medications: MedicationRecord[] = [];
      for (const row of rows as any[]) {
        const attr = this.parseAttribution(row.note);
        const frequencyFromNote = attr.remainder
          .split(/\r?\n/)
          .find((l) => /^Frequency:/i.test(l))
          ?.replace(/^Frequency:\s*/i, '')
          .trim();
        const dosageFromNote = attr.remainder
          .split(/\r?\n/)
          .find((l) => /^Dosage:/i.test(l))
          ?.replace(/^Dosage:\s*/i, '')
          .trim();
        const routeFromNote = attr.remainder
          .split(/\r?\n/)
          .find((l) => /^Route:/i.test(l))
          ?.replace(/^Route:\s*/i, '')
          .trim();
        medications.push({
          id: String(row.id),
          name: this.nonEmpty(row.drug),
          dosage: this.nonEmpty(row.dosage) ?? dosageFromNote ?? null,
          frequency:
            frequencyFromNote ??
            (row.interval != null ? String(row.interval) : null),
          route: this.nonEmpty(row.route) ?? routeFromNote ?? null,
          startDate: this.formatDate(row.start_date),
          status: row.active === 1 ? 'Active' : 'Inactive',
          prescribedBy: this.displayAuthor(
            attr.doctorName,
            null,
            await this.resolveUserName(connection, row.provider_id ?? row.user),
          ),
          clinicName: attr.clinicName,
        });
      }

      if (medications.length > 0) return medications;

      return this.getListRecords(pid, 'medication', (row) => {
        const attr = this.parseAttribution(row.comments);
        return {
          id: String(row.id),
          name: this.nonEmpty(row.title),
          dosage: null,
          frequency: null,
          route: null,
          startDate: this.formatDate(row.begdate),
          status: this.capitalizeStatus(row.activity === 1 ? 'active' : 'inactive'),
          prescribedBy: this.displayAuthor(attr.doctorName, null, row.user),
          clinicName: attr.clinicName,
        };
      });
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
        `SELECT id, date, bps, bpd, pulse, respiration, temperature, oxygen_saturation,
                height, weight, BMI, user, note
         FROM form_vitals WHERE pid = ? AND activity = 1 ORDER BY date DESC`,
        [pid],
      );

      const vitals: VitalSignRecord[] = [];
      for (const row of rows as any[]) {
        const bp = [this.nonEmpty(row.bps), this.nonEmpty(row.bpd)].filter(Boolean).join('/');
        const attr = this.parseAttribution(row.note);
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
          recordedBy: this.displayAuthor(
            attr.doctorName,
            null,
            await this.resolveUserName(connection, row.user),
          ),
          clinicName: attr.clinicName,
        });
      }
      return vitals;
    });
  }

  async getLabResults(pid: string): Promise<LabResultRecord[]> {
    return this.withConnection(async (connection) => {
      const results: LabResultRecord[] = [];
      try {
        const [rows] = await connection.execute(
          `SELECT pr.procedure_result_id AS id, pr.result_code, pr.result_text, pr.result, pr.units,
                  pr.range, pr.result_status, pr.abnormal, po.provider_id, pr.date, pr.comments
           FROM procedure_result pr
           INNER JOIN procedure_report rep ON rep.procedure_report_id = pr.procedure_report_id
           INNER JOIN procedure_order po ON po.procedure_order_id = rep.procedure_order_id
           WHERE po.patient_id = ?
           ORDER BY pr.date DESC`,
          [pid],
        );

        for (const row of rows as any[]) {
          const attr = this.parseAttribution(row.comments);
          results.push({
            id: String(row.id),
            testName: this.nonEmpty(row.result_text),
            result: this.nonEmpty(row.result),
            unit: this.nonEmpty(row.units),
            referenceRange: this.nonEmpty(row.range),
            status: this.nonEmpty(row.abnormal) ?? this.nonEmpty(row.result_status),
            performedDate: this.formatDate(row.date),
            reviewedBy: this.displayAuthor(
              attr.doctorName,
              null,
              await this.resolveUserName(connection, row.provider_id),
            ),
            clinicName: attr.clinicName,
          });
        }
      } catch (error: any) {
        this.logger.warn(`procedure_result lab read failed: ${error?.message}`);
      }

      const listLabs = await this.getListRecords(pid, 'lab_result', (row) => {
        const attr = this.parseAttribution(row.comments);
        const parts = Object.fromEntries(
          attr.remainder
            .split(' · ')
            .map((p) => p.split(':').map((s) => s.trim()))
            .filter((kv) => kv.length >= 2)
            .map(([k, ...rest]) => [k.toLowerCase(), rest.join(':')]),
        );
        return {
          id: `list-${row.id}`,
          testName: this.nonEmpty(row.title),
          result: parts['result'] ?? null,
          unit: parts['unit'] ?? null,
          referenceRange: parts['ref'] ?? parts['range'] ?? null,
          status: parts['status'] ?? this.capitalizeStatus(row.activity === 1 ? 'final' : 'inactive'),
          performedDate: this.formatDate(row.begdate ?? row.date),
          reviewedBy: this.displayAuthor(attr.doctorName, null, row.user),
          clinicName: attr.clinicName,
        };
      });

      return [...results, ...listLabs];
    });
  }

  async getImmunizations(pid: string): Promise<ImmunizationRecord[]> {
    return this.getListRecords(pid, 'immunization', (row) => {
      const attr = this.parseAttribution(row.comments);
      return {
        id: String(row.id),
        vaccine: this.nonEmpty(row.title) ?? this.nonEmpty(row.diagnosis),
        dateAdministered: this.formatDate(row.begdate ?? row.date),
        lotNumber: this.nonEmpty(row.extrainfo) ?? this.nonEmpty(row.udi),
        administeredBy: this.displayAuthor(attr.doctorName, null, row.user),
        clinicName: attr.clinicName,
      };
    });
  }

  async getCarePlans(pid: string): Promise<CarePlanRecord[]> {
    return this.getListRecords(pid, 'careplan', (row) => {
      const attr = this.parseAttribution(row.comments);
      const goals = attr.remainder
        ? attr.remainder.split(/\r?\n| · /).map((g) => g.trim()).filter(Boolean)
        : [];
      return {
        id: String(row.id),
        title: this.nonEmpty(row.title),
        goals,
        startDate: this.formatDate(row.begdate ?? row.date),
        status: this.capitalizeStatus(row.activity === 1 ? 'active' : 'inactive'),
        assignedBy: this.displayAuthor(attr.doctorName, null, row.user),
        clinicName: attr.clinicName,
      };
    });
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
        const attr = this.parseAttribution(row.description);
        notes.push({
          id: String(row.id),
          date: this.formatDateTime(row.date),
          author: this.displayAuthor(
            attr.doctorName,
            null,
            await this.resolveUserName(connection, row.user),
          ),
          type: this.nonEmpty(row.codetext) ?? this.nonEmpty(row.code),
          content: attr.remainder || this.nonEmpty(row.description),
          clinicName: attr.clinicName,
        });
      }
      return notes;
    });
  }

  async insertListRecord(input: {
    pid: string | number;
    type: 'allergy' | 'medical_problem' | 'medication' | 'lab_result' | 'careplan';
    title: string;
    comments?: string;
    diagnosis?: string;
    /** Free-text severity/reaction notes — lists.outcome is an INT option id, not text. */
    outcome?: string;
    user?: string;
    doctorName?: string;
    clinicName?: string;
  }): Promise<{ id: string }> {
    return this.withConnection(async (connection) => {
      const now = new Date();
      const author = this.openEmrAuthor(input.user);
      const attribution = this.formatAttribution(input.doctorName, input.clinicName);
      const comments = [attribution, input.comments, input.outcome]
        .map((v) => v?.trim())
        .filter(Boolean)
        .join(' · ');
      const [result] = await connection.execute(
        `INSERT INTO lists
          (date, type, title, begdate, pid, user, groupname, comments, diagnosis, outcome, activity)
         VALUES (?, ?, ?, ?, ?, ?, 'Default', ?, ?, 0, 1)`,
        [
          now,
          input.type,
          input.title.slice(0, 255),
          now,
          Number(input.pid),
          author,
          comments,
          (input.diagnosis ?? '').slice(0, 255),
        ],
      );
      return { id: String((result as any)?.insertId ?? Date.now()) };
    });
  }

  async insertLabResult(input: {
    pid: string | number;
    testName: string;
    result?: string;
    unit?: string;
    referenceRange?: string;
    status?: string;
    user?: string;
    doctorName?: string;
    clinicName?: string;
  }): Promise<{ id: string }> {
    const attribution = this.formatAttribution(input.doctorName, input.clinicName);
    const detail = [
      input.result ? `Result: ${input.result}` : null,
      input.unit ? `Unit: ${input.unit}` : null,
      input.referenceRange ? `Ref: ${input.referenceRange}` : null,
      input.status ? `Status: ${input.status}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    // Prefer OpenEMR procedure tables; fall back to lists.type=lab_result.
    try {
      return await this.withConnection(async (connection) => {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const author = this.openEmrAuthor(input.user);
        const pid = Number(input.pid);
        const encounterId = await this.ensureTodayEncounter(connection, pid, today, author);

        const [orderResult] = await connection.execute(
          `INSERT INTO procedure_order
            (provider_id, patient_id, encounter_id, date_ordered, date_collected, order_status,
             patient_instructions, activity)
           VALUES (0, ?, ?, ?, ?, 'complete', ?, 1)`,
          [pid, encounterId, now, now, attribution],
        );
        const orderId = Number((orderResult as any)?.insertId);
        if (!orderId) throw new Error('procedure_order insert returned no id');

        await connection
          .execute(
            `INSERT INTO procedure_order_code
              (procedure_order_id, procedure_order_seq, procedure_code, procedure_name, procedure_order_title)
             VALUES (?, 1, 'MEDICARE-LAB', ?, 'Laboratory Test')`,
            [orderId, input.testName.slice(0, 255)],
          )
          .catch(() => undefined);

        const [reportResult] = await connection.execute(
          `INSERT INTO procedure_report
            (procedure_order_id, procedure_order_seq, date_report, date_collected, report_status, review_status)
           VALUES (?, 1, ?, ?, 'final', 'reviewed')`,
          [orderId, now, now],
        );
        const reportId = Number((reportResult as any)?.insertId);
        if (!reportId) throw new Error('procedure_report insert returned no id');

        const [resultRow] = await connection.execute(
          `INSERT INTO procedure_result
            (procedure_report_id, result_data_type, result_code, result_text, date, units, result,
             \`range\`, result_status, comments)
           VALUES (?, 'S', 'MEDICARE', ?, ?, ?, ?, ?, ?, ?)`,
          [
            reportId,
            input.testName.slice(0, 255),
            now,
            (input.unit ?? '').slice(0, 31),
            (input.result ?? '').slice(0, 255),
            (input.referenceRange ?? '').slice(0, 255),
            (input.status ?? 'final').slice(0, 31),
            [attribution, detail].filter(Boolean).join(' · '),
          ],
        );
        return { id: String((resultRow as any)?.insertId ?? orderId) };
      });
    } catch (error: any) {
      this.logger.warn(`Lab procedure insert failed, using lists fallback: ${error?.message}`);
      return this.insertListRecord({
        pid: input.pid,
        type: 'lab_result',
        title: input.testName,
        comments: detail,
        user: input.user,
        doctorName: input.doctorName,
        clinicName: input.clinicName,
      });
    }
  }

  async insertCarePlan(input: {
    pid: string | number;
    title: string;
    goals?: string;
    status?: string;
    user?: string;
    doctorName?: string;
    clinicName?: string;
  }): Promise<{ id: string }> {
    return this.insertListRecord({
      pid: input.pid,
      type: 'careplan',
      title: input.title,
      comments: [input.goals?.trim(), input.status?.trim()].filter(Boolean).join('\n'),
      user: input.user,
      doctorName: input.doctorName,
      clinicName: input.clinicName,
    });
  }

  async insertPrescription(input: {
    pid: string | number;
    drug: string;
    dosage?: string;
    frequency?: string;
    route?: string;
    user?: string;
    doctorName?: string;
    clinicName?: string;
  }): Promise<{ id: string }> {
    return this.withConnection(async (connection) => {
      const today = new Date().toISOString().slice(0, 10);
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const author = this.openEmrAuthor(input.user);
      const attribution = this.formatAttribution(input.doctorName, input.clinicName);
      const detailLines = [
        attribution,
        input.dosage ? `Dosage: ${input.dosage}` : null,
        input.frequency ? `Frequency: ${input.frequency}` : null,
        input.route ? `Route: ${input.route}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      // Explicit values for OpenEMR columns that are NOT NULL with DEFAULT NULL
      // under MariaDB strict mode (same fields OpenEMR's Prescription.class.php sets).
      const preferred: Record<string, string | number> = {
        patient_id: Number(input.pid),
        date_added: nowStr,
        date_modified: nowStr,
        start_date: today,
        drug: input.drug.slice(0, 150),
        dosage: (input.dosage ?? '').slice(0, 100),
        route: (input.route ?? '').slice(0, 100),
        note: detailLines,
        active: 1,
        txDate: today,
        drug_id: 0,
        user: author,
        usage_category: '',
        usage_category_title: '',
        request_intent: 'order',
        request_intent_title: 'Order',
        erx_source: 0,
        erx_uploaded: 0,
      };

      const existingCols = await this.getTableColumnNames(connection, 'prescriptions');
      const row: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(preferred)) {
        if (existingCols.has(key)) row[key] = value;
      }

      // Fill any other NOT NULL / no-default columns discovered on this OpenEMR build.
      const required = await this.getNotNullColumnsWithoutDefault(connection, 'prescriptions');
      for (const col of required) {
        if (row[col.name] !== undefined) continue;
        if (col.name === 'id' || col.autoIncrement) continue;
        row[col.name] = this.defaultForSqlType(col.dataType, col.columnType, today, nowStr);
      }

      let insertId: number | null = null;
      let lastError: any;
      try {
        const columns = Object.keys(row);
        if (columns.length === 0) throw new Error('No writable prescriptions columns found');
        const placeholders = columns.map((c) => `\`${c}\``).join(', ');
        const values = columns.map(() => '?').join(', ');
        const [result] = await connection.execute(
          `INSERT INTO prescriptions (${placeholders}) VALUES (${values})`,
          columns.map((c) => row[c]),
        );
        insertId = Number((result as any)?.insertId) || null;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `Schema-aware prescriptions insert failed (${error?.message}); falling back to lists.medication`,
        );
      }

      // Always mirror into lists so chart reads + OpenEMR UI stay consistent,
      // and so medication still saves if prescriptions insert is blocked.
      const [listResult] = await connection.execute(
        `INSERT INTO lists
          (date, type, title, begdate, pid, user, groupname, comments, diagnosis, outcome, activity)
         VALUES (?, 'medication', ?, ?, ?, ?, 'Default', ?, '', 0, 1)`,
        [
          nowStr,
          input.drug.slice(0, 255),
          today,
          Number(input.pid),
          author,
          [attribution, input.dosage, input.frequency, input.route]
            .filter(Boolean)
            .join(' · '),
        ],
      );
      const listId = Number((listResult as any)?.insertId) || null;

      if (!insertId && !listId) {
        throw lastError || new Error('Could not insert prescription');
      }

      return { id: String(insertId ?? listId ?? Date.now()) };
    });
  }

  /** Columns that MariaDB will reject if omitted under STRICT_* modes. */
  private async getTableColumnNames(connection: any, table: string): Promise<Set<string>> {
    try {
      const [rows] = await connection.execute(
        `SELECT COLUMN_NAME AS name
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
      );
      return new Set((rows as any[]).map((r) => String(r.name)));
    } catch {
      return new Set<string>();
    }
  }

  private async getNotNullColumnsWithoutDefault(
    connection: any,
    table: string,
  ): Promise<Array<{ name: string; dataType: string; columnType: string; autoIncrement: boolean }>> {
    try {
      const [rows] = await connection.execute(
        `SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType,
                EXTRA AS extra, IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [table],
      );
      return (rows as any[])
        .filter((c) => String(c.isNullable).toUpperCase() === 'NO')
        .filter((c) => c.columnDefault == null)
        .map((c) => ({
          name: String(c.name),
          dataType: String(c.dataType || ''),
          columnType: String(c.columnType || ''),
          autoIncrement: String(c.extra || '').toLowerCase().includes('auto_increment'),
        }));
    } catch (error: any) {
      this.logger.warn(`Could not introspect ${table} columns: ${error?.message}`);
      return [];
    }
  }

  private defaultForSqlType(
    dataType: string,
    columnType: string,
    today: string,
    nowStr: string,
  ): string | number {
    const t = dataType.toLowerCase();
    if (t === 'date') return today;
    if (t.includes('time') || t === 'timestamp') return nowStr;
    if (
      t.includes('int') ||
      t === 'decimal' ||
      t === 'float' ||
      t === 'double' ||
      t === 'bit' ||
      t === 'boolean' ||
      t === 'bool'
    ) {
      return 0;
    }
    if (columnType.toLowerCase().startsWith('enum(')) {
      const first = columnType.match(/enum\('([^']*)'/i);
      return first?.[1] ?? '';
    }
    return '';
  }

  async insertVital(input: {
    pid: string | number;
    user?: string;
    doctorName?: string;
    clinicName?: string;
    bps?: string | null;
    bpd?: string | null;
    pulse?: number | null;
    respiration?: number | null;
    temperature?: number | null;
    oxygenSaturation?: number | null;
    height?: number | null;
    weight?: number | null;
    bmi?: number | null;
  }): Promise<VitalSignRecord> {
    return this.withConnection(async (connection) => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const author = this.openEmrAuthor(input.user);
      const pid = Number(input.pid);
      const encounterId = await this.ensureTodayEncounter(connection, pid, today, author);
      const attribution = this.formatAttribution(input.doctorName, input.clinicName);

      const [result] = await connection.execute(
        `INSERT INTO form_vitals
          (date, pid, user, groupname, authorized, activity, bps, bpd, pulse, respiration,
           temperature, oxygen_saturation, height, weight, BMI, note)
         VALUES (?, ?, ?, 'Default', 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          now,
          pid,
          author,
          input.bps ?? '',
          input.bpd ?? '',
          input.pulse ?? null,
          input.respiration ?? null,
          input.temperature ?? null,
          input.oxygenSaturation ?? null,
          input.height ?? null,
          input.weight ?? null,
          input.bmi ?? null,
          attribution.slice(0, 255),
        ],
      );
      const formId = Number((result as any)?.insertId);
      if (Number.isFinite(formId) && formId > 0) {
        await connection
          .execute(
            `INSERT INTO forms
              (date, encounter, form_name, form_id, pid, user, groupname, authorized, deleted, formdir)
             VALUES (?, ?, 'Vitals', ?, ?, ?, 'Default', 1, 0, 'vitals')`,
            [now, encounterId, formId, pid, author],
          )
          .catch(() => undefined);
      }

      const bp = [input.bps, input.bpd].filter(Boolean).join('/');
      return {
        date: this.formatDateTime(now),
        bloodPressure: bp || null,
        heartRate: input.pulse ?? null,
        respiratoryRate: input.respiration ?? null,
        temperatureCelsius: input.temperature ?? null,
        oxygenSaturation: input.oxygenSaturation ?? null,
        heightCm: input.height ?? null,
        weightKg: input.weight ?? null,
        bmi: input.bmi ?? null,
        recordedBy: this.displayAuthor(input.doctorName, null, author),
        clinicName: input.clinicName?.trim() || null,
      };
    });
  }

  /** OpenEMR form/list user fields are short usernames, not MediCare UUIDs. */
  private openEmrAuthor(raw?: string | null): string {
    const value = (raw || '').trim();
    if (!value) return 'doctor';
    if (value.length <= 50 && !value.includes('-')) return value;
    return 'doctor';
  }

  /** Persist doctor + clinic so the patient app can show who wrote each entry. */
  formatAttribution(doctorName?: string | null, clinicName?: string | null): string {
    const doctor = (doctorName || '').trim() || 'Doctor';
    const clinic = (clinicName || '').trim() || 'Clinic';
    return `MC|${doctor}|${clinic}`;
  }

  parseAttribution(raw?: string | null): {
    doctorName: string | null;
    clinicName: string | null;
    remainder: string;
  } {
    const text = (raw || '').trim();
    if (!text) return { doctorName: null, clinicName: null, remainder: '' };
    const lineMatch = text.match(/^MC\|([^|]*)\|([^|]*)\|?\s*(?:·\s*)?(.*)$/s);
    if (lineMatch) {
      return {
        doctorName: lineMatch[1]?.trim() || null,
        clinicName: lineMatch[2]?.trim() || null,
        remainder: (lineMatch[3] || '').trim(),
      };
    }
    const firstLine = text.split(/\r?\n/, 1)[0];
    const firstMatch = firstLine.match(/^MC\|([^|]*)\|([^|]*)/);
    if (firstMatch) {
      return {
        doctorName: firstMatch[1]?.trim() || null,
        clinicName: firstMatch[2]?.trim() || null,
        remainder: text.slice(firstLine.length).replace(/^\r?\n/, '').trim(),
      };
    }
    return { doctorName: null, clinicName: null, remainder: text };
  }

  private displayAuthor(
    doctorName?: string | null,
    clinicName?: string | null,
    fallback?: string | null,
  ): string | null {
    const doctor = doctorName?.trim();
    const clinic = clinicName?.trim();
    if (doctor && clinic) return `${doctor} · ${clinic}`;
    if (doctor) return doctor;
    if (clinic) return clinic;
    return this.nonEmpty(fallback);
  }

  /**
   * Writes a clinical note the OpenEMR way:
   * encounter → forms index → form_clinical_notes (requires form_id).
   */
  async insertClinicalNote(input: {
    pid: string | number;
    content: string;
    type?: string;
    author?: string;
    doctorName?: string;
    clinicName?: string;
  }): Promise<ClinicalNoteRecord> {
    return this.withConnection(async (connection) => {
      const pid = Number(input.pid);
      const author = this.openEmrAuthor(input.author);
      const type = input.type?.trim() || 'Visit note';
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const attribution = this.formatAttribution(input.doctorName, input.clinicName);
      const description = `${attribution}\n${input.content}`.trim();

      const encounterId = await this.ensureTodayEncounter(connection, pid, today, author);

      const [maxRows] = await connection.execute(
        `SELECT COALESCE(MAX(form_id), 0) AS largestId FROM form_clinical_notes`,
      );
      const formId = Number((maxRows as any[])[0]?.largestId ?? 0) + 1;

      await connection.execute(
        `INSERT INTO forms
          (date, encounter, form_name, form_id, pid, user, groupname, authorized, deleted, formdir)
         VALUES (?, ?, 'Clinical Notes Form', ?, ?, ?, 'Default', 1, 0, 'clinical_notes')`,
        [now, encounterId, formId, pid, author],
      );

      let insertId: string;
      try {
        const [result] = await connection.execute(
          `INSERT INTO form_clinical_notes
            (form_id, date, pid, encounter, user, groupname, authorized, activity,
             code, codetext, description, clinical_notes_type)
           VALUES (?, ?, ?, ?, ?, 'Default', 1, 1, ?, ?, ?, ?)`,
          [
            formId,
            today,
            pid,
            String(encounterId),
            author,
            'medicare-visit-note',
            type.slice(0, 255),
            description,
            'progress_note',
          ],
        );
        insertId = String((result as any)?.insertId ?? Date.now());
      } catch (primaryError: any) {
        // Older OpenEMR builds may reject clinical_notes_type option ids — retry without it.
        this.logger.warn(
          `Clinical note insert with type failed, retrying minimal columns: ${primaryError?.message}`,
        );
        const [result] = await connection.execute(
          `INSERT INTO form_clinical_notes
            (form_id, date, pid, encounter, user, groupname, authorized, activity,
             code, codetext, description)
           VALUES (?, ?, ?, ?, ?, 'Default', 1, 1, ?, ?, ?)`,
          [
            formId,
            today,
            pid,
            String(encounterId),
            author,
            'medicare-visit-note',
            type.slice(0, 255),
            description,
          ],
        );
        insertId = String((result as any)?.insertId ?? Date.now());
      }

      return {
        id: insertId,
        date: this.formatDateTime(now),
        author: this.displayAuthor(input.doctorName, null, author),
        type,
        content: input.content,
        clinicName: input.clinicName?.trim() || null,
      };
    });
  }

  /** Create or reuse today's encounter so clinical forms can attach. */
  private async ensureTodayEncounter(
    connection: any,
    pid: number,
    today: string,
    author: string,
  ): Promise<number> {
    const [existing] = await connection.execute(
      `SELECT encounter, id FROM form_encounter
       WHERE pid = ? AND DATE(date) = ?
       ORDER BY id DESC LIMIT 1`,
      [pid, today],
    );
    const row = (existing as any[])[0];
    if (row?.encounter != null && Number(row.encounter) > 0) {
      return Number(row.encounter);
    }
    if (row?.id != null) {
      const id = Number(row.id);
      if (row.encounter == null || Number(row.encounter) === 0) {
        await connection.execute(
          `UPDATE form_encounter SET encounter = ? WHERE id = ?`,
          [id, id],
        );
      }
      return id;
    }

    // Explicit defaults avoid NOT NULL failures on facility_id / pc_catid.
    let newId: number;
    try {
      const [insertResult] = await connection.execute(
        `INSERT INTO form_encounter
          (date, reason, facility, facility_id, pid, encounter, pc_catid, provider_id,
           billing_facility, class_code)
         VALUES (?, 'MediCare clinical documentation', 'MediCare Clinic', 3, ?, 0, 5, 0, 3, 'AMB')`,
        [`${today} 12:00:00`, pid],
      );
      newId = Number((insertResult as any)?.insertId);
    } catch (primaryError: any) {
      this.logger.warn(
        `Encounter insert with facility defaults failed, retrying minimal: ${primaryError?.message}`,
      );
      const [insertResult] = await connection.execute(
        `INSERT INTO form_encounter (date, reason, pid, encounter, pc_catid, facility_id)
         VALUES (?, 'MediCare clinical documentation', ?, 0, 5, 3)`,
        [`${today} 12:00:00`, pid],
      );
      newId = Number((insertResult as any)?.insertId);
    }

    if (!Number.isFinite(newId) || newId <= 0) {
      throw new Error('Could not create OpenEMR encounter for clinical note');
    }
    await connection.execute(
      `UPDATE form_encounter SET encounter = ? WHERE id = ?`,
      [newId, newId],
    );
    await connection
      .execute(
        `INSERT INTO forms
          (date, encounter, form_name, form_id, pid, user, groupname, authorized, deleted, formdir)
         VALUES (?, ?, 'New Patient Encounter', ?, ?, ?, 'Default', 1, 0, 'newpatient')`,
        [new Date(), newId, newId, pid, author],
      )
      .catch(() => undefined);
    return newId;
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
