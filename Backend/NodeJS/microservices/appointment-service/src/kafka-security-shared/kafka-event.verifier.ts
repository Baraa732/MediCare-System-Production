import { KafkaEventEnvelope } from './event-envelope.types';
import { verifyKafkaEnvelopeSignature } from './kafka-event.crypto';
import {
  getKafkaEventReplayWindowMs,
  getKafkaTrustedProducerSecrets,
  isKafkaEventSigningRequired,
  KafkaEventSecurityError,
} from './kafka-event.config';
import { isProducerAllowedForTopic } from './topic-security.matrix';
import { isSignedKafkaEnvelope } from './kafka-event.signer';

export function normalizeKafkaEventInput(
  raw: unknown,
  expectedEventType: string,
): KafkaEventEnvelope {
  if (isSignedKafkaEnvelope(raw)) {
    return raw as KafkaEventEnvelope;
  }

  if (!isKafkaEventSigningRequired()) {
    let payload: Record<string, unknown>;
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
        payload = obj.payload as Record<string, unknown>;
      } else {
        payload = obj;
      }
    } else {
      throw new KafkaEventSecurityError(`Invalid Kafka event payload for ${expectedEventType}`);
    }

    return {
      eventId: `legacy-${expectedEventType}-${String(payload.appointmentId ?? payload.userId ?? Date.now())}`,
      eventType: expectedEventType,
      producerService: inferLegacyProducer(expectedEventType),
      timestamp: new Date().toISOString(),
      payload,
      signature: 'unsigned-dev',
    };
  }

  throw new KafkaEventSecurityError(
    `Kafka event for ${expectedEventType} is not a signed envelope`,
  );
}

function inferLegacyProducer(eventType: string): string {
  if (eventType.startsWith('appointment.')) return 'appointment-service';
  if (eventType === 'user.created') return 'user-service';
  if (eventType === 'audit.log') return 'system-manager-service';
  if (eventType === 'user.password.changed') return 'user-service';
  return 'unknown-producer';
}

export function verifyKafkaEventEnvelope(
  raw: unknown,
  expectedEventType: string,
): KafkaEventEnvelope {
  const envelope = normalizeKafkaEventInput(raw, expectedEventType);

  if (envelope.eventType !== expectedEventType) {
    throw new KafkaEventSecurityError(
      `Kafka event type mismatch: expected ${expectedEventType}, got ${envelope.eventType}`,
    );
  }

  if (envelope.signature === 'unsigned-dev' && !isKafkaEventSigningRequired()) {
    return envelope;
  }

  if (!isProducerAllowedForTopic(expectedEventType, envelope.producerService)) {
    throw new KafkaEventSecurityError(
      `Producer ${envelope.producerService} is not authorized for topic ${expectedEventType}`,
    );
  }

  if (envelope.signature === 'unsigned-dev' && !isKafkaEventSigningRequired()) {
    return envelope;
  }

  const trustedSecrets = getKafkaTrustedProducerSecrets();
  const secret = trustedSecrets[envelope.producerService];
  if (!secret) {
    throw new KafkaEventSecurityError(
      `No trusted signing secret configured for producer ${envelope.producerService}`,
    );
  }

  const replayWindowMs = getKafkaEventReplayWindowMs();
  if (!verifyKafkaEnvelopeSignature(secret, envelope, replayWindowMs)) {
    throw new KafkaEventSecurityError(
      `Invalid or replayed Kafka signature for ${expectedEventType} from ${envelope.producerService}`,
    );
  }

  return envelope;
}

export function extractTenantIdFromPayload(payload: Record<string, unknown>): string | undefined {
  const tenantId = payload.tenantId ?? payload.clinicId;
  return typeof tenantId === 'string' && tenantId.trim() !== '' ? tenantId : undefined;
}
