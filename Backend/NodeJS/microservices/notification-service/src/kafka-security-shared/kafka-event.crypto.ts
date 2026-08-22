import * as crypto from 'crypto';
import { KafkaEventEnvelope } from './event-envelope.types';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

export function buildKafkaSignaturePayload(
  eventId: string,
  eventType: string,
  producerService: string,
  timestamp: string,
  payload: unknown,
): string {
  return [
    eventId,
    eventType,
    producerService,
    timestamp,
    stableStringify(payload),
  ].join('\n');
}

export function signKafkaEnvelope(
  secret: string,
  envelope: Omit<KafkaEventEnvelope, 'signature'>,
): string {
  const payload = buildKafkaSignaturePayload(
    envelope.eventId,
    envelope.eventType,
    envelope.producerService,
    envelope.timestamp,
    envelope.payload,
  );
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function isKafkaTimestampFresh(
  timestamp: string,
  windowMs: number = 300_000,
): boolean {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return false;
  const age = Date.now() - parsed;
  return age <= windowMs && age >= -windowMs;
}

export function verifyKafkaEnvelopeSignature(
  secret: string,
  envelope: KafkaEventEnvelope,
  windowMs?: number,
): boolean {
  if (!secret || !envelope.signature) return false;
  if (!isKafkaTimestampFresh(envelope.timestamp, windowMs)) return false;

  const expected = signKafkaEnvelope(secret, {
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    producerService: envelope.producerService,
    timestamp: envelope.timestamp,
    payload: envelope.payload,
  });

  return timingSafeEqualHex(expected, envelope.signature);
}
