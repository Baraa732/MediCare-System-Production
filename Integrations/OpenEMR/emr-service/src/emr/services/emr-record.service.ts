import { Injectable, NotFoundException } from '@nestjs/common';
import { EmrSyncStatus } from '../entities/patient-emr-link.entity';
import { PatientEmrChart } from '../types/patient-emr.types';
import { OpenEmrChartService } from './openemr-chart.service';
import { PatientSyncService } from './patient-sync.service';
import { EmrTenantGuardService } from './emr-tenant-guard.service';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

export interface PatientSyncStatusResponse {
  medicareUserId: string;
  synced: boolean;
  openemrPatientId: string | null;
  syncStatus: EmrSyncStatus;
  lastError: string | null;
  updatedAt: string;
}

@Injectable()
export class EmrRecordService {
  constructor(
    private patientSyncService: PatientSyncService,
    private chartService: OpenEmrChartService,
    private readonly tenantGuard: EmrTenantGuardService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private requireTenantId(): string {
    return this.tenantGuard.requireTenantId(this.tenantContext.getTenantId());
  }

  async getSyncStatus(userId: string): Promise<PatientSyncStatusResponse> {
    const tenantId = this.requireTenantId();
    const link = await this.patientSyncService.getLinkByUserId(userId, tenantId);
    if (!link) {
      return {
        medicareUserId: userId,
        synced: false,
        openemrPatientId: null,
        syncStatus: EmrSyncStatus.PENDING,
        lastError: null,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      medicareUserId: link.userId,
      synced: link.syncStatus === EmrSyncStatus.SYNCED && !!link.openemrPatientId,
      openemrPatientId: link.openemrPatientId,
      syncStatus: link.syncStatus,
      lastError: link.lastError,
      updatedAt: link.updatedAt.toISOString(),
    };
  }

  async getPatientEmr(userId: string): Promise<PatientEmrChart> {
    const tenantId = this.requireTenantId();
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

    return this.chartService.getPatientChart({
      tenantId,
      openemrPatientId: link.openemrPatientId,
      medicareUserId: link.userId,
      syncStatus: link.syncStatus,
      lastSyncAt: link.updatedAt.toISOString(),
    });
  }
}
