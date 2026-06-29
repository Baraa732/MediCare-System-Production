import { Controller, Get, Injectable, Logger, Param, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PatientSyncService, UserCreatedEvent } from './patient-sync.service';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { withValidatedTenantEvent } from '../../tenant-shared/tenant-kafka';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';
import { TenantQueueThrottle } from '../../tenant-shared/tenant-queue-throttle';
import { EmrObservabilityService } from './emr-observability.service';

@Controller()
@Injectable()
export class KafkaConsumerService {
  private readonly logger: Logger;
  private readonly queueThrottle: TenantQueueThrottle;

  constructor(
    private patientSyncService: PatientSyncService,
    private readonly tenantContext: TenantContextService,
    configService: ConfigService,
    private readonly observability: EmrObservabilityService,
  ) {
    this.logger = createTenantLogger(KafkaConsumerService.name, tenantContext);
    const intervalMs = parseInt(
      configService.get<string>('EMR_TENANT_QUEUE_MIN_INTERVAL_MS') || '250',
      10,
    );
    this.queueThrottle = new TenantQueueThrottle(intervalMs);
  }

  @EventPattern('user.created')
  async handleUserCreated(@Payload() event: unknown): Promise<void> {
    const receivedAt = Date.now();
    await withValidatedTenantEvent(
      event,
      'user.created',
      this.tenantContext,
      this.logger,
      async ({ payload, tenantId }) => {
        await this.queueThrottle.throttle(tenantId, 'user.created');
        const lagMs = Date.now() - receivedAt;
        if (lagMs > 5000) {
          this.observability.recordKafkaLag(tenantId, 'user.created', lagMs);
        }
        const data = payload as unknown as UserCreatedEvent;
        if (!data?.userId || !data?.phoneNumber) {
          this.logger.error('user.created missing userId or phoneNumber');
          return;
        }
        this.logger.log(`Syncing patient to OpenEMR for user ${data.userId}`);
        await this.patientSyncService.syncPatientFromUserCreated(data);
      },
    );
  }

  @EventPattern('user.created.dlt')
  async handleUserCreatedDlt(@Payload() data: unknown): Promise<void> {
    this.logger.error(`[DLT] user.created failed — manual intervention required: ${JSON.stringify(data)}`);
  }
}

@Controller('internal/emr')
@UseGuards(InternalServiceGuard)
export class EmrInternalController {
  constructor(
    private patientSyncService: PatientSyncService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get('patient/:userId')
  async getPatientLink(@Param('userId') userId: string) {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      return { synced: false, userId, error: 'Tenant context required' };
    }
    const link = await this.patientSyncService.getLinkByUserId(userId, tenantId);
    if (!link) {
      return { synced: false, userId };
    }
    return {
      synced: link.syncStatus === 'SYNCED',
      userId: link.userId,
      tenantId: link.tenantId,
      openemrPatientId: link.openemrPatientId,
      syncStatus: link.syncStatus,
      lastError: link.lastError,
      updatedAt: link.updatedAt,
    };
  }
}
