import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService, AppointmentEventPayload } from './notification.service';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { withValidatedTenantEvent } from '../../tenant-shared/tenant-kafka';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';

@Controller()
export class KafkaConsumerService {
  private readonly logger: Logger;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.logger = createTenantLogger(KafkaConsumerService.name, tenantContext);
  }

  @EventPattern('appointment.created')
  async onAppointmentCreated(@Payload() event: unknown) {
    await withValidatedTenantEvent(
      event,
      'appointment.created',
      this.tenantContext,
      this.logger,
      async ({ payload }) => {
        this.logger.log(`appointment.created: ${payload.appointmentId}`);
        await this.notificationService.handleAppointmentCreated(payload as AppointmentEventPayload);
      },
    );
  }

  @EventPattern('appointment.cancelled')
  async onAppointmentCancelled(@Payload() event: unknown) {
    await withValidatedTenantEvent(
      event,
      'appointment.cancelled',
      this.tenantContext,
      this.logger,
      async ({ payload }) => {
        this.logger.log(`appointment.cancelled: ${payload.appointmentId}`);
        await this.notificationService.handleAppointmentCancelled(payload as AppointmentEventPayload);
      },
    );
  }

  @EventPattern('appointment.updated')
  async onAppointmentUpdated(@Payload() event: unknown) {
    await withValidatedTenantEvent(
      event,
      'appointment.updated',
      this.tenantContext,
      this.logger,
      async ({ payload }) => {
        this.logger.log(`appointment.updated: ${payload.appointmentId}`);
        await this.notificationService.handleAppointmentUpdated(payload as AppointmentEventPayload);
      },
    );
  }
}
