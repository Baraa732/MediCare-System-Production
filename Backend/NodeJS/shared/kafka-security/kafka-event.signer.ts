import { randomUUID } from 'crypto';
import { KafkaEventEnvelope } from './event-envelope.types';
import { signKafkaEnvelope } from './kafka-event.crypto';
import {
  getKafkaProducerServiceName,
  getKafkaProducerSigningSecret,
  isKafkaEventSigningRequired,
} from './kafka-event.config';

export function createSignedKafkaEnvelope<T extends Record<string, unknown>>(
  eventType: string,
  payload: T,
  producerService?: string,
): KafkaEventEnvelope<T> {
  const unsigned: Omit<KafkaEventEnvelope<T>, 'signature'> = {
    eventId: randomUUID(),
    eventType,
    producerService: producerService ?? getKafkaProducerServiceName(),
    timestamp: new Date().toISOString(),
    payload,
  };

  if (!isKafkaEventSigningRequired()) {
    return { ...unsigned, signature: 'unsigned-dev' };
  }

  const secret = getKafkaProducerSigningSecret();
  const signature = signKafkaEnvelope(secret, unsigned);
  return { ...unsigned, signature };
}

export function isSignedKafkaEnvelope(value: unknown): value is KafkaEventEnvelope {
  if (!value || typeof value !== 'object') return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.eventId === 'string' &&
    typeof raw.eventType === 'string' &&
    typeof raw.producerService === 'string' &&
    typeof raw.timestamp === 'string' &&
    typeof raw.signature === 'string' &&
    raw.payload !== undefined &&
    typeof raw.payload === 'object'
  );
}
