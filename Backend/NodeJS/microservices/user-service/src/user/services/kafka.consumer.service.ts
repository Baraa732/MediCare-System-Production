import { Injectable, Logger, OnModuleInit, Controller } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload, Ctx } from '@nestjs/microservices';
import { KafkaContext } from '@nestjs/microservices';
import { AccountLinkingService } from './account-linking.service';
import { UserService } from './user.service';
import { IdempotencyService } from './idempotency.service';
import { SchemaValidationService, UserCreateSchema, UserLoginRequestSchema, UserVerifyOtpSchema, UserLinkPatientAccountSchema, UserUnlinkAccountSchema, UserGetLinkedAccountsSchema } from './schema-validation.service';
import { AlertingService } from './alerting.service';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { withOptionalTenantEvent, withValidatedTenantEvent } from '../../tenant-shared/tenant-kafka';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';

@Controller()
@Injectable()
export class KafkaConsumerService implements OnModuleInit {
  private readonly logger: Logger;

  constructor(
    private accountLinkingService: AccountLinkingService,
    private userService: UserService,
    private idempotencyService: IdempotencyService,
    private schemaValidationService: SchemaValidationService,
    private alertingService: AlertingService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.logger = createTenantLogger(KafkaConsumerService.name, tenantContext);
  }

  async onModuleInit() {
    this.logger.log('Kafka consumer service initialized');
  }

  private runWithPayloadTenant<T>(data: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
    const tenantId =
      (data.tenantId as string | undefined) ?? (data.clinicId as string | undefined);
    if (tenantId) {
      return Promise.resolve(
        this.tenantContext.run({ tenantId, service: 'user-service' }, fn),
      );
    }
    return fn();
  }

  // ─── Request-Reply handlers (.send()) ────────────────────────────────────────

  @MessagePattern('user.create')
  async handleUserCreate(@Payload() data: any) {
    return this.runWithPayloadTenant(data, async () => {
    // Fix 25: Validate schema
    const validation = await this.schemaValidationService.validate(data, UserCreateSchema);
    if (!validation.isValid) {
      this.logger.error(`Schema validation failed for user.create: ${JSON.stringify(validation.errors)}`);
      return { success: false, error: 'Invalid message schema' };
    }

    const { phoneNumber, firstName, lastName, email, password, role, clinicId, specialization, licenseNumber } = data;
    try {
      try {
        const existing = await this.userService.findByPhoneNumber(phoneNumber);
        if (existing) {
          this.logger.log(`User already exists for phone: ${phoneNumber}, returning success`);
          return { success: true, userId: existing.id };
        }
      } catch {
        // Not found — proceed to create
      }

      const user = await this.userService.create({
        phoneNumber, firstName, lastName, email, password,
        role, clinicId, specialization, licenseNumber,
      });
      return { success: true, userId: user.id };
    } catch (error: any) {
      this.logger.error(`user.create failed for ${phoneNumber}: ${error.message}`);
      return { success: false, error: error.message };
    }
    });
  }

  @MessagePattern('user.login.request')
  async handleLoginRequest(@Payload() data: any) {
    return this.runWithPayloadTenant(data, async () => {
    // Fix 25: Validate schema
    const validation = await this.schemaValidationService.validate(data, UserLoginRequestSchema);
    if (!validation.isValid) {
      this.logger.error(`Schema validation failed for user.login.request: ${JSON.stringify(validation.errors)}`);
      return { success: false, error: 'Invalid message schema' };
    }

    const { phoneNumber, password } = data;

    try {
      this.logger.log(`Login request for: ${phoneNumber}`);
      return await this.userService.validateLogin(phoneNumber, password);
    } catch (error: any) {
      this.logger.error(`Login validation error: ${error.message}`);
      return { success: false };
    }
    });
  }

  @MessagePattern('user.check.exists')
  async handleCheckExists(@Payload() data: any) {
    return this.runWithPayloadTenant(data, async () => {
    const { phoneNumber } = data;
    try {
      await this.userService.findByPhoneNumber(phoneNumber);
      return { exists: true };
    } catch {
      return { exists: false };
    }
    });
  }

  @MessagePattern('user.link.patient.account')
  async handleLinkPatientAccount(@Payload() data: any) {
    return this.runWithPayloadTenant(data, async () => {
    // Fix 25: Validate schema
    const validation = await this.schemaValidationService.validate(data, UserLinkPatientAccountSchema);
    if (!validation.isValid) {
      this.logger.error(`Schema validation failed for user.link.patient.account: ${JSON.stringify(validation.errors)}`);
      return { success: false, error: 'Invalid message schema' };
    }

    const { systemManagerId, phoneNumber, firstName, lastName, email } = data;
    try {
      return await this.accountLinkingService.linkPatientAccount(systemManagerId, {
        phoneNumber, firstName, lastName, email,
      });
    } catch (error: any) {
      this.logger.error(`user.link_patient_account failed: ${error.message}`);
      return { success: false, error: error.message };
    }
    });
  }

  @MessagePattern('user.get.linked.accounts')
  async handleGetLinkedAccounts(@Payload() data: any) {
    return this.runWithPayloadTenant(data, async () => {
    // Fix 25: Validate schema
    const validation = await this.schemaValidationService.validate(data, UserGetLinkedAccountsSchema);
    if (!validation.isValid) {
      this.logger.error(`Schema validation failed for user.get.linked.accounts: ${JSON.stringify(validation.errors)}`);
      return [];
    }

    const { systemManagerId } = data;
    try {
      return await this.accountLinkingService.getLinkedAccounts(systemManagerId);
    } catch (error: any) {
      this.logger.error(`user.get_linked_accounts failed: ${error.message}`);
      return [];
    }
    });
  }

  @MessagePattern('user.unlink.account')
  async handleUnlinkAccount(@Payload() data: any) {
    return this.runWithPayloadTenant(data, async () => {
    // Fix 25: Validate schema
    const validation = await this.schemaValidationService.validate(data, UserUnlinkAccountSchema);
    if (!validation.isValid) {
      this.logger.error(`Schema validation failed for user.unlink.account: ${JSON.stringify(validation.errors)}`);
      return { success: false, error: 'Invalid message schema' };
    }

    const { systemManagerId, userId } = data;
    try {
      return await this.accountLinkingService.unlinkAccount(systemManagerId, userId);
    } catch (error: any) {
      this.logger.error(`user.unlink_account failed: ${error.message}`);
      return { success: false, error: error.message };
    }
    });
  }

  // ─── Fire-and-forget event handlers (.emit()) ─────────────────────────────

  @MessagePattern('user.create.by.admin')
  async handleCreateByAdmin(@Payload() data: any) {
    return this.runWithPayloadTenant(data, async () => {
    try {
      const { phoneNumber, firstName, lastName, email, password, role, clinicId, specialization, licenseNumber } = data;
      try {
        await this.userService.findByPhoneNumber(phoneNumber);
        return { success: true, message: 'User already exists' };
      } catch {
        // proceed
      }
      await this.userService.create({ phoneNumber, firstName, lastName, email, password, role, clinicId, specialization, licenseNumber });
      this.logger.log(`User created by admin: ${phoneNumber}`);
      return { success: true, message: 'User created successfully' };
    } catch (error: any) {
      this.logger.error(`user.create_by_admin failed: ${error.message}`);
      return { success: false, error: error.message };
    }
    });
  }

  @EventPattern('user.verify.otp')
  async handleVerifyOtp(@Payload() event: unknown, @Ctx() context: KafkaContext): Promise<void> {
    await withOptionalTenantEvent(
      event,
      'user.verify.otp',
      this.tenantContext,
      this.logger,
      async (data) => {
        const validation = await this.schemaValidationService.validate(data, UserVerifyOtpSchema);
        if (!validation.isValid) {
          this.logger.error(`Schema validation failed for user.verify.otp: ${JSON.stringify(validation.errors)}`);
          return;
        }

        const topic = context.getTopic();
        const partition = context.getPartition();
        const { offset } = context.getMessage();
        const messageId = `${partition}:${offset}`;

        const isProcessed = await this.idempotencyService.isProcessed(messageId, topic);
        if (isProcessed) {
          this.logger.log(`Skipping already processed message: ${topic}/${messageId}`);
          return;
        }

        try {
          const { phoneNumber } = data as { phoneNumber: string };
          await this.userService.verifyPhone(phoneNumber);
          await this.idempotencyService.markProcessed(messageId, topic);
        } catch (error: any) {
          this.logger.error(`user.verify_otp failed: ${error.message}`);
          throw error;
        }
      },
    );
  }

  @EventPattern('user.create.clinic.admin')
  async handleCreateClinicAdmin(@Payload() event: unknown, @Ctx() context: KafkaContext): Promise<void> {
    await withValidatedTenantEvent(
      event,
      'user.create.clinic.admin',
      this.tenantContext,
      this.logger,
      async () => {
        const topic = context.getTopic();
        const partition = context.getPartition();
        const { offset } = context.getMessage();
        const messageId = `${partition}:${offset}`;

        const isProcessed = await this.idempotencyService.isProcessed(messageId, topic);
        if (isProcessed) {
          this.logger.log(`Skipping already processed message: ${topic}/${messageId}`);
          return;
        }

        this.logger.log('Clinic admin creation request acknowledged');
        await this.idempotencyService.markProcessed(messageId, topic);
      },
    );
  }

  // ─── Fix 22: DLT (Dead-Letter Topic) handlers for failed messages ─────────────
  // These handlers process messages that failed after all retries.
  // They log the failure, send alerts to monitoring system, and ensure no data loss.

  @EventPattern('user.verify.otp.dlt')
  async handleVerifyOtpDlt(@Payload() data: any, @Ctx() context: KafkaContext): Promise<void> {
    const { offset } = context.getMessage();
    const partition = context.getPartition();
    const topic = context.getTopic();
    this.logger.error(`DLT: user.verify.otp failed - topic: ${topic}, partition: ${partition}, offset: ${offset}, data: ${JSON.stringify(data)}`);
    // MEDIUM FIX: Send alert to monitoring system
    await this.alertingService.sendDltAlert(topic, partition, offset, data);
  }

  @EventPattern('user.create.dlt')
  async handleUserCreateDlt(@Payload() data: any, @Ctx() context: KafkaContext): Promise<void> {
    const { offset } = context.getMessage();
    const partition = context.getPartition();
    const topic = context.getTopic();
    this.logger.error(`DLT: user.create failed - topic: ${topic}, partition: ${partition}, offset: ${offset}, data: ${JSON.stringify(data)}`);
    // MEDIUM FIX: Send alert to monitoring system
    await this.alertingService.sendDltAlert(topic, partition, offset, data);
  }

  @EventPattern('user.login.request.dlt')
  async handleLoginRequestDlt(@Payload() data: any, @Ctx() context: KafkaContext): Promise<void> {
    const { offset } = context.getMessage();
    const partition = context.getPartition();
    const topic = context.getTopic();
    this.logger.error(`DLT: user.login.request failed - topic: ${topic}, partition: ${partition}, offset: ${offset}, data: ${JSON.stringify(data)}`);
    // MEDIUM FIX: Send alert to monitoring system
    await this.alertingService.sendDltAlert(topic, partition, offset, data);
  }

  @EventPattern('user.check.exists.dlt')
  async handleCheckExistsDlt(@Payload() data: any, @Ctx() context: KafkaContext): Promise<void> {
    const { offset } = context.getMessage();
    const partition = context.getPartition();
    const topic = context.getTopic();
    this.logger.error(`DLT: user.check.exists failed - topic: ${topic}, partition: ${partition}, offset: ${offset}, data: ${JSON.stringify(data)}`);
    // MEDIUM FIX: Send alert to monitoring system
    await this.alertingService.sendDltAlert(topic, partition, offset, data);
  }

  @EventPattern('user.link.patient.account.dlt')
  async handleLinkPatientAccountDlt(@Payload() data: any, @Ctx() context: KafkaContext): Promise<void> {
    const { offset } = context.getMessage();
    const partition = context.getPartition();
    const topic = context.getTopic();
    this.logger.error(`DLT: user.link.patient.account failed - topic: ${topic}, partition: ${partition}, offset: ${offset}, data: ${JSON.stringify(data)}`);
    // MEDIUM FIX: Send alert to monitoring system
    await this.alertingService.sendDltAlert(topic, partition, offset, data);
  }

  @EventPattern('user.unlink.account.dlt')
  async handleUnlinkAccountDlt(@Payload() data: any, @Ctx() context: KafkaContext): Promise<void> {
    const { offset } = context.getMessage();
    const partition = context.getPartition();
    const topic = context.getTopic();
    this.logger.error(`DLT: user.unlink.account failed - topic: ${topic}, partition: ${partition}, offset: ${offset}, data: ${JSON.stringify(data)}`);
    // MEDIUM FIX: Send alert to monitoring system
    await this.alertingService.sendDltAlert(topic, partition, offset, data);
  }

  @EventPattern('user.get.linked.accounts.dlt')
  async handleGetLinkedAccountsDlt(@Payload() data: any, @Ctx() context: KafkaContext): Promise<void> {
    const { offset } = context.getMessage();
    const partition = context.getPartition();
    const topic = context.getTopic();
    this.logger.error(`DLT: user.get.linked.accounts failed - topic: ${topic}, partition: ${partition}, offset: ${offset}, data: ${JSON.stringify(data)}`);
    // MEDIUM FIX: Send alert to monitoring system
    await this.alertingService.sendDltAlert(topic, partition, offset, data);
  }

  @EventPattern('user.create.by.admin.dlt')
  async handleCreateByAdminDlt(@Payload() data: any, @Ctx() context: KafkaContext): Promise<void> {
    const { offset } = context.getMessage();
    const partition = context.getPartition();
    const topic = context.getTopic();
    this.logger.error(`DLT: user.create.by.admin failed - topic: ${topic}, partition: ${partition}, offset: ${offset}, data: ${JSON.stringify(data)}`);
    // MEDIUM FIX: Send alert to monitoring system
    await this.alertingService.sendDltAlert(topic, partition, offset, data);
  }
}
