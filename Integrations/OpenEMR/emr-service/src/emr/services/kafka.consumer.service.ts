import { Controller, Get, Injectable, Logger, Param, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PatientSyncService, UserCreatedEvent } from './patient-sync.service';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';
import { TenantQueueThrottle } from '../../tenant-shared/tenant-queue-throttle';
import { EmrObservabilityService } from './emr-observability.service';
import { withSecuredKafkaEvent } from '../../kafka-security-shared/secured-kafka.consumer';
import { UserKafkaCorroborator } from './user-kafka-corroborator.service';

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
    private readonly corroborator: UserKafkaCorroborator,
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
    await withSecuredKafkaEvent(
      event,
      'user.created',
      this.tenantContext,
      this.logger,
      { corroborator: this.corroborator },
      async (payload, meta) => {
        const tenantId = meta.tenantId;
        if (!tenantId) {
          this.logger.error('user.created missing corroborated tenantId');
          return;
        }
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
        data.tenantId = tenantId;
        data.clinicId = tenantId;
        this.logger.log(`Syncing patient to OpenEMR for user ${data.userId}`);
        await this.patientSyncService.syncPatientFromUserCreated(data);
      },
    );
  }

  @EventPattern('user.created.dlt')
  async handleUserCreatedDlt(@Payload() data: unknown): Promise<void> {
    const payload = data as { userId?: string };
    this.logger.error(
      `[DLT] user.created failed — manual intervention required for userId=${payload?.userId ?? 'unknown'}`,
    );
  }

  /** When a patient books (or completes) a visit, ensure their OpenEMR chart exists for that clinic. */
  @EventPattern('appointment.created')
  async handleAppointmentCreated(@Payload() event: unknown): Promise<void> {
    await this.syncPatientFromAppointmentEvent(event, 'appointment.created');
  }

  @EventPattern('appointment.completed')
  async handleAppointmentCompleted(@Payload() event: unknown): Promise<void> {
    await this.syncPatientFromAppointmentEvent(event, 'appointment.completed');
  }

  private async syncPatientFromAppointmentEvent(
    event: unknown,
    topic: 'appointment.created' | 'appointment.completed',
  ): Promise<void> {
    const receivedAt = Date.now();
    await withSecuredKafkaEvent(
      event,
      topic,
      this.tenantContext,
      this.logger,
      { corroborator: this.corroborator },
      async (payload, meta) => {
        const tenantId = meta.tenantId;
        const patientId = (payload as { patientId?: string }).patientId;
        if (!tenantId || !patientId) {
          this.logger.error(`${topic} missing tenantId or patientId`);
          return;
        }

        await this.queueThrottle.throttle(tenantId, topic);
        const lagMs = Date.now() - receivedAt;
        if (lagMs > 5000) {
          this.observability.recordKafkaLag(tenantId, topic, lagMs);
        }

        const existing = await this.patientSyncService.getLinkByUserId(patientId, tenantId);
        if (existing?.syncStatus === 'SYNCED' && existing.openemrPatientId) {
          return;
        }

        const profile = await this.corroborator.fetchUserProfile(patientId);
        if (!profile?.phoneNumber) {
          this.logger.error(
            `${topic}: cannot sync EMR — patient ${patientId} profile/phone missing`,
          );
          return;
        }

        this.logger.log(
          `Ensuring OpenEMR chart for patient ${patientId} at clinic ${tenantId} (${topic})`,
        );
        await this.patientSyncService.syncPatientFromUserCreated({
          userId: patientId,
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
      },
    );
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
