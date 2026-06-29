import { Injectable, Logger, Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { SystemManagerService } from './system-manager.service';

@Controller()
@Injectable()
export class KafkaConsumerService {
  private readonly logger = new Logger(KafkaConsumerService.name);

  constructor(private readonly systemManagerService: SystemManagerService) {}

  // account.linked is emitted with .emit() (fire-and-forget) — MUST use @EventPattern
  // Using @MessagePattern here would cause messages to never be received because
  // @MessagePattern expects a reply correlation ID that .emit() never sends
  @EventPattern('account.linked')
  async handleAccountLinked(@Payload() data: any): Promise<void> {
    const { systemManagerId, userId } = data;
    try {
      await this.systemManagerService.updateLinkedUserIds(systemManagerId, userId, 'add');
    } catch (error: any) {
      this.logger.error(
        `handleAccountLinked failed systemManager=${systemManagerId} user=${userId}: ${error.message}`,
        error.stack,
      );
      // Re-throw so Kafka does NOT commit the offset — message will be retried
      // After max retries exhausted, Kafka routes to account.linked.DLT
      throw error;
    }
  }

  @EventPattern('account.unlinked')
  async handleAccountUnlinked(@Payload() data: any): Promise<void> {
    const { systemManagerId, userId } = data;
    try {
      await this.systemManagerService.updateLinkedUserIds(systemManagerId, userId, 'remove');
    } catch (error: any) {
      this.logger.error(
        `handleAccountUnlinked failed systemManager=${systemManagerId} user=${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ─── DLT consumers — messages that exhausted all retries ─────────────────
  // These are the safety net. Log + alert. Never throw here.

  @EventPattern('account.linked.dlt')
  async handleAccountLinkedDlt(@Payload() data: any): Promise<void> {
    this.logger.error(
      `[DLT] account.linked permanently failed — manual intervention required. Payload: ${JSON.stringify(data)}`,
    );
    // TODO: send alert to monitoring system (SNS, PagerDuty, Slack webhook)
  }

  @EventPattern('account.unlinked.dlt')
  async handleAccountUnlinkedDlt(@Payload() data: any): Promise<void> {
    this.logger.error(
      `[DLT] account.unlinked permanently failed — manual intervention required. Payload: ${JSON.stringify(data)}`,
    );
  }

  // Handle clinic admin activation request from auth service
  @MessagePattern('system.manager.activate.clinic.admin')
  async handleActivateClinicAdmin(@Payload() data: any): Promise<{ success: boolean; message: string; activationData?: any }> {
    const { code, phoneNumber } = data;
    try {
      // Call the existing validateActivationCode method
      const result = await this.systemManagerService.validateActivationCode({ code, phoneNumber });
      
      return { success: true, message: result.message };
    } catch (error: any) {
      this.logger.error(`Clinic admin activation failed: ${error.message}`);
      return { success: false, message: error.message };
    }
  }
}
