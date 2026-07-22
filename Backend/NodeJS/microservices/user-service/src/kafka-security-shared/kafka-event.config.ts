import { KafkaServiceName } from './event-envelope.types';

export class KafkaEventSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KafkaEventSecurityError';
  }
}

function parseTrustedSecretsJson(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.length > 0) {
        out[key] = value;
      }
    }
    return out;
  } catch {
    throw new KafkaEventSecurityError('KAFKA_EVENT_TRUSTED_SECRETS must be valid JSON');
  }
}

export function getKafkaProducerServiceName(): KafkaServiceName {
  const name =
    process.env.KAFKA_EVENT_PRODUCER_SERVICE ??
    process.env.SERVICE_NAME ??
    process.env.OTEL_SERVICE_NAME;
  if (!name) {
    throw new KafkaEventSecurityError('KAFKA_EVENT_PRODUCER_SERVICE or SERVICE_NAME is required');
  }
  return name as KafkaServiceName;
}

export function getKafkaProducerSigningSecret(): string {
  const secret = process.env.KAFKA_EVENT_SIGNING_SECRET?.trim();
  if (!secret) {
    throw new KafkaEventSecurityError('KAFKA_EVENT_SIGNING_SECRET is required for signed Kafka events');
  }
  return secret;
}

export function getKafkaTrustedProducerSecrets(): Record<string, string> {
  const map = parseTrustedSecretsJson(process.env.KAFKA_EVENT_TRUSTED_SECRETS);
  const own = process.env.KAFKA_EVENT_SIGNING_SECRET?.trim();
  const ownService = process.env.KAFKA_EVENT_PRODUCER_SERVICE ?? process.env.SERVICE_NAME;
  if (own && ownService && !map[ownService]) {
    map[ownService] = own;
  }
  return map;
}

export function isKafkaEventSigningRequired(): boolean {
  if (process.env.KAFKA_EVENT_SIGNING_REQUIRED === 'true') return true;
  if (process.env.KAFKA_EVENT_SIGNING_REQUIRED === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export function getKafkaEventReplayWindowMs(): number {
  const raw = process.env.KAFKA_EVENT_REPLAY_WINDOW_MS;
  const parsed = raw ? parseInt(raw, 10) : 300_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300_000;
}

export function requireKafkaEventSecurityConfig(serviceName: KafkaServiceName): void {
  if (!isKafkaEventSigningRequired()) return;
  if (!process.env.KAFKA_EVENT_SIGNING_SECRET?.trim()) {
    throw new KafkaEventSecurityError(
      `KAFKA_EVENT_SIGNING_SECRET is required for ${serviceName} when signing is enabled`,
    );
  }
  if (!process.env.KAFKA_EVENT_TRUSTED_SECRETS?.trim()) {
    throw new KafkaEventSecurityError(
      `KAFKA_EVENT_TRUSTED_SECRETS is required for ${serviceName} when signing is enabled`,
    );
  }
}
