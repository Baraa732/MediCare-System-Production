import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { EmrSyncStatus, PatientEmrLink } from '../entities/patient-emr-link.entity';
import { ClinicalNoteRecord, emptyPatientChart, PatientEmrChart } from '../types/patient-emr.types';
import { OpenEmrChartService } from './openemr-chart.service';
import { PatientSyncService } from './patient-sync.service';
import { EmrTenantGuardService } from './emr-tenant-guard.service';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { HttpTenantAccessChecker } from '../../tenant-shared/tenant-access-checker';
import { PhiAuditPublisherService } from '../../phi-audit-shared/phi-audit.publisher';
import { PhiAuditAction, PhiAuditResourceType } from '../../phi-audit-shared/types';
import { UserKafkaCorroborator } from './user-kafka-corroborator.service';
import { OpenEmrDbReader } from './openemr-db.reader';
import { OpenEmrClient } from './openemr.client';
import {
  UpdateMyEmrDto,
  UpdateMyEmrEmergencyContactDto,
} from '../dto/update-my-emr.dto';

export interface PatientSyncStatusResponse {
  medicareUserId: string;
  synced: boolean;
  openemrPatientId: string | null;
  syncStatus: EmrSyncStatus;
  lastError: string | null;
  updatedAt: string;
  tenantId?: string | null;
}

export interface PatientEmrLinkSummary {
  tenantId: string | null;
  clinicId: string | null;
  synced: boolean;
  syncStatus: EmrSyncStatus;
  openemrPatientId: string | null;
  lastError: string | null;
  updatedAt: string;
}

interface AuthUser {
  userId: string;
  role: string;
}

@Injectable()
export class EmrRecordService {
  private readonly logger = new Logger(EmrRecordService.name);

  constructor(
    private patientSyncService: PatientSyncService,
    private chartService: OpenEmrChartService,
    private readonly tenantGuard: EmrTenantGuardService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantAccess: HttpTenantAccessChecker,
    private readonly phiAudit: PhiAuditPublisherService,
    private readonly userCorroborator: UserKafkaCorroborator,
    private readonly dbReader: OpenEmrDbReader,
    private readonly openEmrClient: OpenEmrClient,
  ) {}

  private requireTenantId(): string {
    return this.tenantGuard.requireTenantId(this.tenantContext.getTenantId());
  }

  private async assertActorAccess(actor: AuthUser, tenantId: string, patientUserId: string): Promise<void> {
    if (actor.role === 'SYSTEM_MANAGER') return;
    if (actor.role === 'PATIENT') {
      if (actor.userId !== patientUserId) {
        throw new NotFoundException('EMR record not found');
      }
      await this.tenantAccess.assertPatientAccess(tenantId, actor.userId);
      return;
    }
    if (actor.role === 'CLINIC_ADMIN') {
      await this.tenantAccess.assertStaffAccess(tenantId, actor.userId, actor.role);
      await this.tenantAccess.assertPatientAccess(tenantId, patientUserId);
      return;
    }
    if (actor.role === 'DOCTOR') {
      await this.tenantAccess.assertStaffAccess(tenantId, actor.userId, actor.role);
      await this.tenantAccess.assertDoctorPatientAccess(tenantId, actor.userId, patientUserId);
    }
  }

  private toSyncStatus(link: PatientEmrLink | null, userId: string): PatientSyncStatusResponse {
    if (!link) {
      return {
        medicareUserId: userId,
        synced: false,
        openemrPatientId: null,
        syncStatus: EmrSyncStatus.PENDING,
        lastError: null,
        updatedAt: new Date().toISOString(),
        tenantId: null,
      };
    }

    return {
      medicareUserId: link.userId,
      synced: link.syncStatus === EmrSyncStatus.SYNCED && !!link.openemrPatientId,
      openemrPatientId: link.openemrPatientId,
      syncStatus: link.syncStatus,
      lastError: link.lastError,
      updatedAt: link.updatedAt.toISOString(),
      tenantId: link.tenantId,
    };
  }

  async listMyLinks(actor: AuthUser): Promise<{ links: PatientEmrLinkSummary[] }> {
    if (actor.role !== 'PATIENT') {
      throw new ForbiddenException('Only patients can list their EMR links');
    }
    const links = await this.patientSyncService.getLinksByUserId(actor.userId);
    return {
      links: links.map((link) => ({
        tenantId: link.tenantId,
        clinicId: link.tenantId,
        synced: link.syncStatus === EmrSyncStatus.SYNCED && !!link.openemrPatientId,
        syncStatus: link.syncStatus,
        openemrPatientId: link.openemrPatientId,
        lastError: link.lastError,
        updatedAt: link.updatedAt.toISOString(),
      })),
    };
  }

  async getMySyncStatus(
    actor: AuthUser,
    preferredTenantId?: string | null,
  ): Promise<PatientSyncStatusResponse> {
    if (actor.role !== 'PATIENT') {
      throw new ForbiddenException('Only patients can use /me/sync-status');
    }
    const link = await this.patientSyncService.resolvePatientLink(
      actor.userId,
      preferredTenantId,
    );
    if (link?.tenantId) {
      await this.assertActorAccess(actor, link.tenantId, actor.userId);
    }
    return this.toSyncStatus(link, actor.userId);
  }

  async getMyEmr(
    actor: AuthUser,
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    if (actor.role !== 'PATIENT') {
      throw new ForbiddenException('Only patients can use /me');
    }

    let link = await this.patientSyncService.resolvePatientLink(
      actor.userId,
      preferredTenantId,
    );

    if (link?.tenantId && (link.syncStatus !== EmrSyncStatus.SYNCED || !link.openemrPatientId)) {
      link = await this.tryHealPatientSync(actor.userId, link.tenantId);
    }

    if (link?.tenantId && link.syncStatus === EmrSyncStatus.SYNCED && link.openemrPatientId) {
      try {
        const chart = await this.getPatientEmr(actor.userId, actor, link.tenantId);
        return this.stripBillingForPatient(chart);
      } catch (error: any) {
        this.logger.warn(`Patient chart read fell back to empty OpenEMR template: ${error?.message}`);
      }
    }

    return this.stripBillingForPatient(await this.emptyChartForUser(actor.userId, link));
  }

  async getSyncStatus(
    userId: string,
    actor: AuthUser,
    preferredTenantId?: string | null,
  ): Promise<PatientSyncStatusResponse> {
    if (actor.role === 'PATIENT') {
      if (actor.userId !== userId) {
        throw new ForbiddenException('You can only access your own EMR sync status');
      }
      return this.getMySyncStatus(actor, preferredTenantId);
    }

    const tenantId = preferredTenantId || this.requireTenantId();
    await this.assertActorAccess(actor, tenantId, userId);
    const link = await this.patientSyncService.getLinkByUserId(userId, tenantId);
    return this.toSyncStatus(link, userId);
  }

  async getPatientEmr(
    userId: string,
    actor: AuthUser,
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    const tenantId =
      preferredTenantId ||
      this.tenantContext.getTenantId() ||
      (actor.role === 'PATIENT'
        ? (await this.patientSyncService.resolvePatientLink(userId))?.tenantId
        : null);

    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    try {
      await this.assertActorAccess(actor, tenantId, userId);
      const link = await this.patientSyncService.getLinkByUserId(userId, tenantId);
      if (!link || link.syncStatus !== EmrSyncStatus.SYNCED || !link.openemrPatientId) {
        if (actor.role === 'PATIENT' && actor.userId === userId) {
          return this.stripBillingForPatient(await this.emptyChartForUser(userId, link));
        }
        throw new NotFoundException({
          message: 'EMR record is not available yet',
          medicareUserId: userId,
          syncStatus: link?.syncStatus ?? EmrSyncStatus.PENDING,
          lastError: link?.lastError,
        });
      }

      await this.tenantGuard.assertLinkBelongsToTenant(link, tenantId);

      const chart = await this.tenantContext.run(
        {
          tenantId,
          userId: actor.userId,
          service: process.env.SERVICE_NAME || 'emr-service',
        },
        async () =>
          this.chartService.getPatientChart({
            tenantId,
            openemrPatientId: link.openemrPatientId!,
            medicareUserId: link.userId,
            syncStatus: link.syncStatus,
            lastSyncAt: link.updatedAt.toISOString(),
          }),
      );

      this.phiAudit.emit({
        action: PhiAuditAction.EMR_CHART_READ,
        actorId: actor.userId,
        actorRole: actor.role,
        tenantId,
        resourceType: PhiAuditResourceType.EMR_CHART,
        resourceId: userId,
        success: true,
        classification: 'phi',
      });

      return chart;
    } catch (error) {
      this.phiAudit.emit({
        action: PhiAuditAction.EMR_CHART_READ,
        actorId: actor.userId,
        actorRole: actor.role,
        tenantId,
        resourceType: PhiAuditResourceType.EMR_CHART,
        resourceId: userId,
        success: false,
        classification: 'phi',
      });
      throw error;
    }
  }

  /**
   * Ensure the patient has a SYNCED OpenEMR chart for this clinic.
   * Doctors call this when opening a patient whose EMR is not linked yet.
   */
  async ensurePatientEmr(
    userId: string,
    actor: AuthUser,
    preferredTenantId?: string | null,
    profileHint?: {
      phoneNumber?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      gender?: string;
      birthDate?: string;
    },
  ): Promise<PatientSyncStatusResponse> {
    if (!['DOCTOR', 'CLINIC_ADMIN', 'SYSTEM_MANAGER'].includes(actor.role)) {
      throw new ForbiddenException('Only clinic staff can ensure EMR charts');
    }

    const tenantId = preferredTenantId || this.requireTenantId();
    await this.assertActorAccess(actor, tenantId, userId);

    const existing = await this.patientSyncService.getLinkByUserId(userId, tenantId);
    if (existing?.syncStatus === EmrSyncStatus.SYNCED && existing.openemrPatientId) {
      return this.toSyncStatus(existing, userId);
    }

    const profile =
      (await this.userCorroborator.fetchUserProfile(userId)) ?? profileHint ?? null;
    if (!profile?.phoneNumber) {
      throw new NotFoundException({
        message: 'Cannot link EMR — patient phone/profile is missing',
        medicareUserId: userId,
        syncStatus: EmrSyncStatus.FAILED,
      });
    }

    const link = await this.patientSyncService.syncPatientFromUserCreated({
      userId,
      phoneNumber: profile.phoneNumber,
      firstName: profile.firstName ?? profileHint?.firstName,
      lastName: profile.lastName ?? profileHint?.lastName,
      email: profile.email ?? profileHint?.email,
      gender: profile.gender ?? profileHint?.gender,
      birthDate: profile.birthDate ?? profileHint?.birthDate,
      role: 'PATIENT',
      tenantId,
      clinicId: tenantId,
    });

    this.phiAudit.emit({
      action: PhiAuditAction.EMR_CHART_WRITE,
      actorId: actor.userId,
      actorRole: actor.role,
      tenantId,
      resourceType: PhiAuditResourceType.EMR_CHART,
      resourceId: userId,
      success: link.syncStatus === EmrSyncStatus.SYNCED,
      classification: 'phi',
    });

    return this.toSyncStatus(link, userId);
  }

  async addClinicalNote(
    userId: string,
    actor: AuthUser,
    body: { content: string; type?: string },
    preferredTenantId?: string | null,
  ): Promise<ClinicalNoteRecord> {
    if (!['DOCTOR', 'CLINIC_ADMIN', 'SYSTEM_MANAGER'].includes(actor.role)) {
      throw new ForbiddenException('Only clinic staff can write clinical notes');
    }

    const content = body.content?.trim();
    if (!content) {
      throw new BadRequestException('Clinical note content is required');
    }

    const tenantId = preferredTenantId || this.requireTenantId();
    await this.assertActorAccess(actor, tenantId, userId);

    let link = await this.patientSyncService.getLinkByUserId(userId, tenantId);
    if (!link || link.syncStatus !== EmrSyncStatus.SYNCED || !link.openemrPatientId) {
      await this.ensurePatientEmr(userId, actor, tenantId);
      link = await this.patientSyncService.getLinkByUserId(userId, tenantId);
    }

    if (!link?.openemrPatientId) {
      throw new NotFoundException({
        message: 'EMR chart is not available yet',
        medicareUserId: userId,
        syncStatus: link?.syncStatus ?? EmrSyncStatus.FAILED,
        lastError: link?.lastError,
      });
    }

    const note = await this.dbReader.insertClinicalNote({
      pid: link.openemrPatientId,
      content,
      type: body.type?.trim() || 'Visit note',
      author: actor.userId,
    });

    this.phiAudit.emit({
      action: PhiAuditAction.EMR_CHART_WRITE,
      actorId: actor.userId,
      actorRole: actor.role,
      tenantId,
      resourceType: PhiAuditResourceType.EMR_CHART,
      resourceId: userId,
      success: true,
      classification: 'phi',
    });

    return note;
  }

  /** Patient portal CRUD — OpenEMR Standard API `patient` resource only. */
  async updateMyEmr(
    actor: AuthUser,
    dto: UpdateMyEmrDto,
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    return this.writeMyPortalFields(actor, dto, preferredTenantId);
  }

  async upsertMyEmergencyContact(
    actor: AuthUser,
    contact: UpdateMyEmrEmergencyContactDto,
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    if (!contact.name?.trim() && !contact.phone?.trim() && !contact.relationship?.trim()) {
      throw new BadRequestException('Emergency contact needs a name, phone, or relationship');
    }
    return this.writeMyPortalFields(
      actor,
      { emergencyContact: contact },
      preferredTenantId,
    );
  }

  async deleteMyEmergencyContact(
    actor: AuthUser,
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    return this.writeMyPortalFields(
      actor,
      {
        emergencyContact: {
          name: '',
          relationship: '',
          phone: '',
          email: '',
        },
      },
      preferredTenantId,
    );
  }

  private async tryHealPatientSync(
    userId: string,
    tenantId: string,
  ): Promise<PatientEmrLink | null> {
    try {
      const profile = await this.userCorroborator.fetchUserProfile(userId);
      if (!profile?.phoneNumber) {
        return this.patientSyncService.getLinkByUserId(userId, tenantId);
      }
      return await this.patientSyncService.syncPatientFromUserCreated({
        userId,
        phoneNumber: profile.phoneNumber,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        gender: profile.gender,
        birthDate: profile.birthDate,
        role: 'PATIENT',
        tenantId,
        clinicId: tenantId,
      });
    } catch (error: any) {
      this.logger.warn(`OpenEMR patient sync heal skipped: ${error?.message}`);
      return this.patientSyncService.getLinkByUserId(userId, tenantId);
    }
  }

  private async emptyChartForUser(
    userId: string,
    link: PatientEmrLink | null,
  ): Promise<PatientEmrChart> {
    const profile = await this.userCorroborator.fetchUserProfile(userId);
    return emptyPatientChart(userId, {
      patient: {
        firstName: profile?.firstName ?? null,
        middleName: null,
        lastName: profile?.lastName ?? null,
        birthDate: profile?.birthDate ?? null,
        gender: profile?.gender ?? null,
        maritalStatus: null,
        race: null,
        ethnicity: null,
        language: null,
        nationalId: null,
      },
      contactInformation: {
        phone: profile?.phoneNumber ?? null,
        email: profile?.email ?? null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
      },
      syncMetadata: {
        medicareUserId: userId,
        openEmrPid: link?.openemrPatientId ?? '',
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
    });
  }

  private stripBillingForPatient(chart: PatientEmrChart): PatientEmrChart {
    return {
      ...chart,
      insurance: [],
      guarantor: null,
      dataOwnership: {
        ...chart.dataOwnership,
        patientEditable: ['patient', 'contactInformation', 'emergencyContacts'],
      },
    };
  }

  private async writeMyPortalFields(
    actor: AuthUser,
    dto: UpdateMyEmrDto,
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    if (actor.role !== 'PATIENT') {
      throw new ForbiddenException('Only patients can update their portal chart');
    }

    let link = await this.patientSyncService.resolvePatientLink(
      actor.userId,
      preferredTenantId,
    );
    if (link?.tenantId && (link.syncStatus !== EmrSyncStatus.SYNCED || !link.openemrPatientId)) {
      link = await this.tryHealPatientSync(actor.userId, link.tenantId);
    }
    if (!link?.tenantId || !link.openemrPatientId || link.syncStatus !== EmrSyncStatus.SYNCED) {
      return this.stripBillingForPatient(await this.emptyChartForUser(actor.userId, link));
    }

    await this.assertActorAccess(actor, link.tenantId, actor.userId);

    const row = await this.dbReader.getPatientRow(link.openemrPatientId);
    if (!row) {
      return this.stripBillingForPatient(await this.emptyChartForUser(actor.userId, link));
    }

    const standardFields = this.toOpenEmrStandardPatient(dto);
    if (Object.keys(standardFields).length === 0) {
      throw new BadRequestException('No patient portal fields to update');
    }

    const puuid = this.dbReader.getPatientUuid(row) ?? link.openemrPatientId;
    try {
      await this.openEmrClient.standardPut(`/api/patient/${puuid}`, standardFields);
    } catch (error: any) {
      this.logger.warn(
        `OpenEMR Standard API patient update failed (${error?.message}); writing patient_data`,
      );
      await this.dbReader.updatePatientPortalFields(row.pid, standardFields);
    }

    this.phiAudit.emit({
      action: PhiAuditAction.EMR_CHART_WRITE,
      actorId: actor.userId,
      actorRole: actor.role,
      tenantId: link.tenantId,
      resourceType: PhiAuditResourceType.EMR_CHART,
      resourceId: actor.userId,
      success: true,
      classification: 'phi',
    });

    return this.getMyEmr(actor, link.tenantId);
  }

  /** Maps MediCare portal DTO → OpenEMR Standard API `/api/patient` fields. */
  private toOpenEmrStandardPatient(dto: UpdateMyEmrDto): Record<string, string | null> {
    const fields: Record<string, string | null> = {};
    const blank = (value?: string) =>
      value === undefined ? undefined : value.trim();

    if (dto.patient) {
      const p = dto.patient;
      if (p.firstName !== undefined) fields.fname = blank(p.firstName) ?? '';
      if (p.middleName !== undefined) fields.mname = blank(p.middleName) ?? '';
      if (p.lastName !== undefined) fields.lname = blank(p.lastName) ?? '';
      if (p.birthDate !== undefined) fields.DOB = blank(p.birthDate) ?? '';
      if (p.gender !== undefined) fields.sex = this.toOpenEmrSex(p.gender);
      if (p.maritalStatus !== undefined) fields.status = blank(p.maritalStatus) ?? '';
      if (p.language !== undefined) fields.language = blank(p.language) ?? '';
    }

    if (dto.contactInformation) {
      const c = dto.contactInformation;
      if (c.phone !== undefined) fields.phone_cell = blank(c.phone) ?? '';
      if (c.email !== undefined) fields.email = blank(c.email) ?? '';
      if (c.addressLine1 !== undefined) fields.street = blank(c.addressLine1) ?? '';
      if (c.addressLine2 !== undefined) fields.street_line_2 = blank(c.addressLine2) ?? '';
      if (c.city !== undefined) fields.city = blank(c.city) ?? '';
      if (c.state !== undefined) fields.state = blank(c.state) ?? '';
      if (c.postalCode !== undefined) fields.postal_code = blank(c.postalCode) ?? '';
      if (c.country !== undefined) fields.country_code = blank(c.country) ?? '';
    }

    if (dto.emergencyContact) {
      const e = dto.emergencyContact;
      if (e.name !== undefined) fields.guardiansname = blank(e.name) ?? '';
      if (e.relationship !== undefined) fields.contact_relationship = blank(e.relationship) ?? '';
      if (e.phone !== undefined) fields.phone_contact = blank(e.phone) ?? '';
      if (e.email !== undefined) fields.guardianemail = blank(e.email) ?? '';
    }

    return fields;
  }

  private toOpenEmrSex(gender: string): string {
    const normalized = gender.trim().toLowerCase();
    if (normalized === 'male' || normalized === 'm') return 'Male';
    if (normalized === 'female' || normalized === 'f') return 'Female';
    return gender.trim() || '';
  }
}
