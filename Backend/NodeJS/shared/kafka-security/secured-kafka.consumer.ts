import { Logger } from '@nestjs/common';
import { logKafkaEventIssue } from '@medicare/telemetry';
import { TenantContextService } from '../tenant/tenant-context.service';
import { verifyKafkaEventEnvelope, extractTenantIdFromPayload } from './kafka-event.verifier';
import { KafkaEventSecurityError } from './kafka-event.config';
import { topicRequiresIdempotency, topicRequiresTenantCorroboration } from './topic-security.matrix';

export interface KafkaIdempotencyStore {
  isProcessed(eventId: string, topic: string): Promise<boolean>;
  markProcessed(eventId: string, topic: string): Promise<void>;
}

export interface KafkaTenantCorroborator {
  corroborateTenant(
    topic: string,
    tenantId: string,
    payload: Record<string, unknown>,
  ): Promise<boolean>;
}

export async function withSecuredKafkaEvent<T extends Record<string, unknown>, R>(
  raw: unknown,
  topic: string,
  tenantContext: TenantContextService,
  logger: Logger,
  deps: {
    idempotency?: KafkaIdempotencyStore;
    corroborator?: KafkaTenantCorroborator;
  },
  handler: (payload: T, meta: { eventId: string; producerService: string; tenantId?: string }) => Promise<R>,
): Promise<R | void> {
  try {
    const envelope = verifyKafkaEventEnvelope(raw, topic);
    const payload = envelope.payload as T;

    if (deps.idempotency && topicRequiresIdempotency(topic)) {
      if (await deps.idempotency.isProcessed(envelope.eventId, topic)) {
        logger.debug(`Skipping duplicate Kafka event ${topic}/${envelope.eventId}`);
        return;
      }
    }

    const claimedTenantId = extractTenantIdFromPayload(payload as Record<string, unknown>);

    if (topicRequiresTenantCorroboration(topic)) {
      if (!claimedTenantId) {
        throw new KafkaEventSecurityError(`Missing tenantId in corroborated Kafka event ${topic}`);
      }
      if (!deps.corroborator) {
        throw new KafkaEventSecurityError(`No tenant corroborator configured for ${topic}`);
      }
      const ok = await deps.corroborator.corroborateTenant(topic, claimedTenantId, payload as Record<string, unknown>);
      if (!ok) {
        throw new KafkaEventSecurityError(
          `Tenant corroboration failed for ${topic} tenant=${claimedTenantId}`,
        );
      }
    }

    const run = async () => handler(payload, {
      eventId: envelope.eventId,
      producerService: envelope.producerService,
      tenantId: claimedTenantId,
    });

    const result = claimedTenantId
      ? await tenantContext.run(
          { tenantId: claimedTenantId, service: process.env.SERVICE_NAME },
          run,
        )
      : await run();

    if (deps.idempotency && topicRequiresIdempotency(topic)) {
      await deps.idempotency.markProcessed(envelope.eventId, topic);
    }

    return result;
  } catch (err) {
    if (err instanceof KafkaEventSecurityError) {
      logKafkaEventIssue('error', topic, err.message, { event: 'kafka_event_security_rejected' });
      return;
    }
    throw err;
  }
}
