import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { TenantContextService } from '../tenant-shared/tenant-context.service';
import { AUDIT_LOG_TOPIC, PhiAuditEvent } from './types';

export type PhiAuditEmitInput = Omit<PhiAuditEvent, 'timestamp'> & { timestamp?: string };

@Injectable()
export class PhiAuditPublisherService implements OnModuleInit {
  private readonly logger = new Logger(PhiAuditPublisherService.name);
  private connected = false;

  constructor(
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
    private readonly tenantContext: TenantContextService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.connected) return;
    await this.kafkaClient.connect();
    this.connected = true;
  }

  /**
   * Fire-and-forget append to the centralized audit pipeline.
   * Never include PHI values in the payload — IDs and action metadata only.
   */
  emit(input: PhiAuditEmitInput): void {
    const payload: PhiAuditEvent = {
      ...input,
      tenantId: input.tenantId ?? this.tenantContext.getTenantId() ?? undefined,
      actorId: input.actorId ?? this.tenantContext.getUserId(),
      requestId: input.requestId ?? this.tenantContext.getRequestId(),
      sourceService: input.sourceService ?? process.env.SERVICE_NAME ?? process.env.OTEL_SERVICE_NAME,
      timestamp: input.timestamp ?? new Date().toISOString(),
    };

    this.kafkaClient.emit(AUDIT_LOG_TOPIC, payload).subscribe({
      error: (err) => {
        this.logger.error(
          `Failed to emit ${AUDIT_LOG_TOPIC} action=${payload.action} resource=${payload.resourceType}:${payload.resourceId ?? '-'}`,
          err instanceof Error ? err.stack : String(err),
        );
      },
    });
  }
}
