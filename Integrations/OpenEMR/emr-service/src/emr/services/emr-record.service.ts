import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EmrSyncStatus, PatientEmrLink } from '../entities/patient-emr-link.entity';
import { ClinicalNoteRecord, PatientEmrChart } from '../types/patient-emr.types';
import { OpenEmrChartService } from './openemr-chart.service';
import { PatientSyncService } from './patient-sync.service';
import { EmrTenantGuardService } from './emr-tenant-guard.service';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { HttpTenantAccessChecker } from '../../tenant-shared/tenant-access-checker';
import { PhiAuditPublisherService } from '../../phi-audit-shared/phi-audit.publisher';
import { PhiAuditAction, PhiAuditResourceType } from '../../phi-audit-shared/types';
import { UserKafkaCorroborator } from './user-kafka-corroborator.service';
import { OpenEmrDbReader } from './openemr-db.reader';

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
  constructor(
    private patientSyncService: PatientSyncService,
    private chartService: OpenEmrChartService,
    private readonly tenantGuard: EmrTenantGuardService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantAccess: HttpTenantAccessChecker,
    private readonly phiAudit: PhiAuditPublisherService,
    private readonly userCorroborator: UserKafkaCorroborator,
    private readonly dbReader: OpenEmrDbReader,
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

    const link = await this.patientSyncService.resolvePatientLink(
      actor.userId,
      preferredTenantId,
    );

    if (!link || !link.tenantId) {
      throw new NotFoundException({
        message: 'No EMR record linked to this user yet',
        medicareUserId: actor.userId,
        syncStatus: EmrSyncStatus.PENDING,
      });
    }

    return this.getPatientEmr(actor.userId, actor, link.tenantId);
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
      if (!link) {
        throw new NotFoundException({
          message: 'No EMR record linked to this user yet',
          medicareUserId: userId,
          syncStatus: EmrSyncStatus.PENDING,
        });
      }

      await this.tenantGuard.assertLinkBelongsToTenant(link, tenantId);

      if (link.syncStatus !== EmrSyncStatus.SYNCED || !link.openemrPatientId) {
        throw new NotFoundException({
          message: 'EMR record is not available yet',
          medicareUserId: userId,
          syncStatus: link.syncStatus,
          lastError: link.lastError,
        });
      }

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
}
