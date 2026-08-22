import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import axios from 'axios';
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
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';
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
  clinicName: string | null;
  clinicCity: string | null;
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
    const enriched = await Promise.all(
      links.map(async (link) => {
        const clinic =
          link.tenantId != null
            ? await this.fetchClinicSummary(link.tenantId)
            : null;
        return {
          tenantId: link.tenantId,
          clinicId: link.tenantId,
          clinicName: clinic?.name ?? null,
          clinicCity: clinic?.city ?? null,
          synced: link.syncStatus === EmrSyncStatus.SYNCED && !!link.openemrPatientId,
          syncStatus: link.syncStatus,
          openemrPatientId: link.openemrPatientId,
          lastError: link.lastError,
          updatedAt: link.updatedAt.toISOString(),
        };
      }),
    );
    return { links: enriched };
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
      const profile = await this.userCorroborator.fetchUserProfile(actor.userId);
      link = await this.patientSyncService.ensureTenantIsolatedOpenEmrPatient(
        link,
        profile ?? undefined,
      );
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
      let link = await this.patientSyncService.getLinkByUserId(userId, tenantId);
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

      const profile = await this.userCorroborator.fetchUserProfile(userId);
      await this.maybeHealPatientGender(link, profile?.gender);
      link = await this.patientSyncService.ensureTenantIsolatedOpenEmrPatient(
        link,
        profile ?? undefined,
      );

      const clinic = await this.fetchClinicSummary(tenantId);
      const sharedLinks = link.openemrPatientId
        ? await this.patientSyncService.getLinksSharingOpenEmrPatient(
            userId,
            link.openemrPatientId,
          )
        : [link];
      const clinicFilter =
        clinic?.name && sharedLinks.length > 1
          ? {
              clinicName: clinic.name,
              includeUnattributed: this.patientSyncService.isPrimaryLinkForSharedChart(
                link,
                sharedLinks,
              ),
            }
          : undefined;

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
            clinicFilter,
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
    const profile =
      (await this.userCorroborator.fetchUserProfile(userId)) ?? profileHint ?? null;
    if (existing?.syncStatus === EmrSyncStatus.SYNCED && existing.openemrPatientId) {
      await this.maybeHealPatientGender(
        existing,
        profile?.gender ?? profileHint?.gender,
      );
      await this.patientSyncService.ensureTenantIsolatedOpenEmrPatient(
        existing,
        profile ?? profileHint ?? undefined,
      );
      return this.toSyncStatus(existing, userId);
    }
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
      ...(await this.resolveWriterMeta(actor, tenantId)),
    }).catch((error: any) => {
      this.logger.error(`OpenEMR clinical note write failed: ${error?.message}`, error?.stack);
      throw new BadRequestException(
        error?.message?.includes('OPENEMR_MYSQL_PASSWORD')
          ? 'OpenEMR database is not configured on the server'
          : `Could not save clinical note to OpenEMR (${error?.message || 'database error'})`,
      );
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

  async addAllergy(
    userId: string,
    actor: AuthUser,
    body: { allergen: string; reaction?: string; severity?: string },
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    const allergen = body.allergen?.trim();
    if (!allergen) throw new BadRequestException('Allergen is required');
    const ctx = await this.resolveStaffWriteContext(userId, actor, preferredTenantId);
    const meta = await this.resolveWriterMeta(actor, ctx.tenantId);
    try {
      await this.dbReader.insertListRecord({
        pid: ctx.pid,
        type: 'allergy',
        title: allergen,
        comments: body.reaction?.trim(),
        outcome: body.severity?.trim(),
        user: actor.userId,
        ...meta,
      });
    } catch (error: any) {
      this.logger.error(`OpenEMR allergy write failed: ${error?.message}`, error?.stack);
      throw new BadRequestException(
        `Could not save allergy to OpenEMR (${error?.message || 'database error'})`,
      );
    }
    this.emitStaffChartWrite(actor, ctx.tenantId, userId);
    return this.getPatientEmr(userId, actor, ctx.tenantId);
  }

  async addMedication(
    userId: string,
    actor: AuthUser,
    body: { name: string; dosage?: string; frequency?: string; route?: string },
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Medication name is required');
    const ctx = await this.resolveStaffWriteContext(userId, actor, preferredTenantId);
    const meta = await this.resolveWriterMeta(actor, ctx.tenantId);
    try {
      await this.dbReader.insertPrescription({
        pid: ctx.pid,
        drug: name,
        dosage: body.dosage?.trim(),
        frequency: body.frequency?.trim(),
        route: body.route?.trim(),
        user: actor.userId,
        ...meta,
      });
    } catch (error: any) {
      this.logger.error(`OpenEMR medication write failed: ${error?.message}`, error?.stack);
      throw new BadRequestException(
        `Could not save medication to OpenEMR (${error?.message || 'database error'})`,
      );
    }
    this.emitStaffChartWrite(actor, ctx.tenantId, userId);
    return this.getPatientEmr(userId, actor, ctx.tenantId);
  }

  async addCondition(
    userId: string,
    actor: AuthUser,
    body: { name: string; icd10Code?: string; status?: string },
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Condition name is required');
    const ctx = await this.resolveStaffWriteContext(userId, actor, preferredTenantId);
    const meta = await this.resolveWriterMeta(actor, ctx.tenantId);
    try {
      await this.dbReader.insertListRecord({
        pid: ctx.pid,
        type: 'medical_problem',
        title: name,
        diagnosis: body.icd10Code?.trim(),
        comments: body.status?.trim(),
        user: actor.userId,
        ...meta,
      });
    } catch (error: any) {
      this.logger.error(`OpenEMR condition write failed: ${error?.message}`, error?.stack);
      throw new BadRequestException(
        `Could not save condition to OpenEMR (${error?.message || 'database error'})`,
      );
    }
    this.emitStaffChartWrite(actor, ctx.tenantId, userId);
    return this.getPatientEmr(userId, actor, ctx.tenantId);
  }

  async addVital(
    userId: string,
    actor: AuthUser,
    body: {
      bloodPressure?: string;
      heartRate?: number;
      respiratoryRate?: number;
      temperatureCelsius?: number;
      oxygenSaturation?: number;
      heightCm?: number;
      weightKg?: number;
    },
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    const ctx = await this.resolveStaffWriteContext(userId, actor, preferredTenantId);
    const meta = await this.resolveWriterMeta(actor, ctx.tenantId);
    const bp = (body.bloodPressure || '').split('/');
    const bps = bp[0]?.trim() || null;
    const bpd = bp[1]?.trim() || null;
    const hasAny =
      bps ||
      bpd ||
      body.heartRate != null ||
      body.respiratoryRate != null ||
      body.temperatureCelsius != null ||
      body.oxygenSaturation != null ||
      body.heightCm != null ||
      body.weightKg != null;
    if (!hasAny) throw new BadRequestException('Enter at least one vital sign');

    let bmi: number | null = null;
    if (body.heightCm && body.weightKg && body.heightCm > 0) {
      const meters = body.heightCm / 100;
      bmi = Number((body.weightKg / (meters * meters)).toFixed(1));
    }

    try {
      await this.dbReader.insertVital({
        pid: ctx.pid,
        user: actor.userId,
        ...meta,
        bps,
        bpd,
        pulse: body.heartRate ?? null,
        respiration: body.respiratoryRate ?? null,
        temperature: body.temperatureCelsius ?? null,
        oxygenSaturation: body.oxygenSaturation ?? null,
        height: body.heightCm ?? null,
        weight: body.weightKg ?? null,
        bmi,
      });
    } catch (error: any) {
      this.logger.error(`OpenEMR vitals write failed: ${error?.message}`, error?.stack);
      throw new BadRequestException(
        `Could not save vitals to OpenEMR (${error?.message || 'database error'})`,
      );
    }
    this.emitStaffChartWrite(actor, ctx.tenantId, userId);
    return this.getPatientEmr(userId, actor, ctx.tenantId);
  }

  async addLabResult(
    userId: string,
    actor: AuthUser,
    body: {
      testName: string;
      result?: string;
      unit?: string;
      referenceRange?: string;
      status?: string;
    },
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    const testName = body.testName?.trim();
    if (!testName) throw new BadRequestException('Lab test name is required');
    const ctx = await this.resolveStaffWriteContext(userId, actor, preferredTenantId);
    const meta = await this.resolveWriterMeta(actor, ctx.tenantId);
    try {
      await this.dbReader.insertLabResult({
        pid: ctx.pid,
        testName,
        result: body.result?.trim(),
        unit: body.unit?.trim(),
        referenceRange: body.referenceRange?.trim(),
        status: body.status?.trim() || 'final',
        user: actor.userId,
        ...meta,
      });
    } catch (error: any) {
      this.logger.error(`OpenEMR lab write failed: ${error?.message}`, error?.stack);
      throw new BadRequestException(
        `Could not save lab result to OpenEMR (${error?.message || 'database error'})`,
      );
    }
    this.emitStaffChartWrite(actor, ctx.tenantId, userId);
    return this.getPatientEmr(userId, actor, ctx.tenantId);
  }

  async addCarePlan(
    userId: string,
    actor: AuthUser,
    body: { title: string; goals?: string; status?: string },
    preferredTenantId?: string | null,
  ): Promise<PatientEmrChart> {
    const title = body.title?.trim();
    if (!title) throw new BadRequestException('Care plan title is required');
    const ctx = await this.resolveStaffWriteContext(userId, actor, preferredTenantId);
    const meta = await this.resolveWriterMeta(actor, ctx.tenantId);
    try {
      await this.dbReader.insertCarePlan({
        pid: ctx.pid,
        title,
        goals: body.goals?.trim(),
        status: body.status?.trim() || 'active',
        user: actor.userId,
        ...meta,
      });
    } catch (error: any) {
      this.logger.error(`OpenEMR care plan write failed: ${error?.message}`, error?.stack);
      throw new BadRequestException(
        `Could not save care plan to OpenEMR (${error?.message || 'database error'})`,
      );
    }
    this.emitStaffChartWrite(actor, ctx.tenantId, userId);
    return this.getPatientEmr(userId, actor, ctx.tenantId);
  }

  private emitStaffChartWrite(actor: AuthUser, tenantId: string, userId: string) {
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
  }

  private async fetchClinicSummary(
    tenantId: string,
  ): Promise<{ name: string; city: string | null } | null> {
    try {
      const clinicBase =
        process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3003';
      const path = `/v1/clinics/internal/get-by-id/${tenantId}`;
      const url = `${clinicBase}${path}`;
      const headers = createInternalAuthHeadersForUrl(
        process.env.INTERNAL_AUTH_SERVICE_NAME || 'emr-service',
        process.env.INTERNAL_AUTH_SECRET || '',
        'POST',
        path,
      );
      const response = await axios.post(
        url,
        {},
        { headers, timeout: 4000, validateStatus: () => true },
      );
      if (response.status >= 400) return null;
      const clinic =
        response.data?.clinic ?? response.data?.data ?? response.data;
      const name =
        clinic?.name ??
        clinic?.clinicName ??
        clinic?.title ??
        clinic?.displayName;
      if (typeof name !== 'string' || !name.trim()) return null;
      const city =
        typeof clinic?.city === 'string' && clinic.city.trim()
          ? clinic.city.trim()
          : null;
      return { name: name.trim(), city };
    } catch (error: any) {
      this.logger.warn(`Clinic lookup failed for ${tenantId}: ${error?.message}`);
      return null;
    }
  }

  private async resolveWriterMeta(
    actor: AuthUser,
    tenantId: string,
  ): Promise<{ doctorName: string; clinicName: string }> {
    let doctorName = 'Doctor';
    try {
      const profile = await this.userCorroborator.fetchUserProfile(actor.userId);
      const full = [profile?.firstName, profile?.lastName]
        .map((v) => v?.trim())
        .filter(Boolean)
        .join(' ');
      if (full) doctorName = full.startsWith('Dr') ? full : `Dr. ${full}`;
    } catch {
      /* keep default */
    }

    const clinic = await this.fetchClinicSummary(tenantId);
    return { doctorName, clinicName: clinic?.name ?? 'Clinic' };
  }

  private async resolveStaffWriteContext(
    userId: string,
    actor: AuthUser,
    preferredTenantId?: string | null,
  ): Promise<{ tenantId: string; pid: string | number }> {
    if (!['DOCTOR', 'CLINIC_ADMIN', 'SYSTEM_MANAGER'].includes(actor.role)) {
      throw new ForbiddenException('Only clinic staff can write this chart');
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
    const row = await this.dbReader.getPatientRow(link.openemrPatientId);
    return { tenantId, pid: row?.pid ?? link.openemrPatientId };
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
    }
    // Always write MariaDB so GET /emr/me shows the contact immediately.
    await this.dbReader.updatePatientPortalFields(row.pid, standardFields);

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
      if (e.relationship !== undefined) {
        const relationship = blank(e.relationship) ?? '';
        fields.contact_relationship = relationship;
        fields.guardianrelationship = relationship;
      }
      if (e.phone !== undefined) {
        const phone = blank(e.phone) ?? '';
        fields.phone_contact = phone;
        fields.guardianphone = phone;
      }
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

  private isUnknownGender(value?: string | null): boolean {
    if (!value?.trim()) return true;
    const normalized = value.trim().toLowerCase();
    return normalized === 'unknown' || normalized === 'other' || normalized === 'u';
  }

  private async maybeHealPatientGender(
    link: PatientEmrLink,
    gender?: string | null,
  ): Promise<void> {
    if (!link.openemrPatientId || this.isUnknownGender(gender)) return;

    try {
      const row = await this.dbReader.getPatientRow(link.openemrPatientId);
      if (!row || !this.isUnknownGender(row.sex)) return;

      const sex = this.toOpenEmrSex(gender!);
      if (this.isUnknownGender(sex)) return;

      await this.dbReader.updatePatientPortalFields(row.pid, { sex });
    } catch (error: any) {
      this.logger.warn(`OpenEMR gender heal skipped: ${error?.message}`);
    }
  }
}
