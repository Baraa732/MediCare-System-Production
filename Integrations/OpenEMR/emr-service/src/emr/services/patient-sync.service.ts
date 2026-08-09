import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmrSyncStatus, PatientEmrLink } from '../entities/patient-emr-link.entity';
import { OpenEmrClient } from './openemr.client';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';
import { EmrSyncConcurrencyService } from './emr-sync-concurrency.service';
import { EmrObservabilityService } from './emr-observability.service';

export interface UserCreatedEvent {
  userId: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  tenantId?: string;
  clinicId?: string;
  gender?: string;
  birthDate?: string;
  createdAt?: string;
}

@Injectable()
export class PatientSyncService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(PatientEmrLink)
    private linkRepository: Repository<PatientEmrLink>,
    private openEmrClient: OpenEmrClient,
    tenantContext: TenantContextService,
    private readonly syncConcurrency: EmrSyncConcurrencyService,
    private readonly observability: EmrObservabilityService,
  ) {
    this.logger = createTenantLogger(PatientSyncService.name, tenantContext);
  }

  async syncPatientFromUserCreated(event: UserCreatedEvent): Promise<PatientEmrLink> {
    const tenantId = event.tenantId ?? event.clinicId;
    if (!tenantId) {
      throw new ForbiddenException('tenantId is required for EMR patient sync');
    }

    if (event.role && event.role !== 'PATIENT') {
      this.logger.debug(`Skipping EMR sync for non-patient role: ${event.role}`);
      return this.ensureSkippedLink(event.userId, event.phoneNumber, tenantId);
    }

    const existing = await this.findLink(event.userId, tenantId);
    if (existing?.syncStatus === EmrSyncStatus.SYNCED && existing.openemrPatientId) {
      this.logger.log(`EMR already synced for user ${event.userId}`);
      return existing;
    }

    const link = existing ?? this.linkRepository.create({
      userId: event.userId,
      tenantId,
      phoneNumber: event.phoneNumber,
      syncStatus: EmrSyncStatus.PENDING,
    });

    this.observability.recordSyncAttempt(tenantId);
    const release = await this.syncConcurrency.acquire(tenantId);
    try {
      const openemrPatientId = await this.openEmrClient.createPatient({
        userId: event.userId,
        phoneNumber: event.phoneNumber,
        firstName: event.firstName,
        lastName: event.lastName,
        email: event.email,
        gender: event.gender,
        birthDate: event.birthDate,
        tenantId,
      });

      link.openemrPatientId = openemrPatientId;
      link.syncStatus = EmrSyncStatus.SYNCED;
      link.lastError = null;
      link.phoneNumber = event.phoneNumber;
      link.tenantId = tenantId;

      return this.linkRepository.save(link);
    } catch (error: any) {
      link.syncStatus = EmrSyncStatus.FAILED;
      link.lastError = error.message?.substring(0, 2000) ?? 'Unknown error';
      await this.linkRepository.save(link);
      this.observability.recordEmrSyncFailure(
        tenantId,
        event.userId,
        link.lastError ?? 'Unknown error',
      );
      throw error;
    } finally {
      await release();
    }
  }

  async getLinkByUserId(userId: string, tenantId: string): Promise<PatientEmrLink | null> {
    return this.findLink(userId, tenantId);
  }

  async getLinksByUserId(userId: string): Promise<PatientEmrLink[]> {
    return this.linkRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Resolve the EMR link a patient should see.
   * Prefer explicit tenant, then SYNCED links, then newest link.
   */
  async resolvePatientLink(
    userId: string,
    preferredTenantId?: string | null,
  ): Promise<PatientEmrLink | null> {
    if (preferredTenantId) {
      return this.findLink(userId, preferredTenantId);
    }

    const links = await this.getLinksByUserId(userId);
    if (links.length === 0) return null;

    const synced = links.find(
      (link) => link.syncStatus === EmrSyncStatus.SYNCED && !!link.openemrPatientId,
    );
    return synced ?? links[0];
  }

  private async findLink(userId: string, tenantId: string): Promise<PatientEmrLink | null> {
    return this.linkRepository.findOne({ where: { userId, tenantId } });
  }

  private async ensureSkippedLink(
    userId: string,
    phoneNumber: string,
    tenantId: string,
  ): Promise<PatientEmrLink> {
    const existing = await this.findLink(userId, tenantId);
    if (existing) return existing;

    return this.linkRepository.save(
      this.linkRepository.create({
        userId,
        tenantId,
        phoneNumber,
        syncStatus: EmrSyncStatus.PENDING,
        lastError: 'Not a patient account',
      }),
    );
  }
}
