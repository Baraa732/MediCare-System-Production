import { logKafkaEventIssue } from '@medicare/telemetry';
import { Logger } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

export class TenantEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantEventValidationError';
  }
}

export interface ValidatedTenantEvent<T extends Record<string, unknown> = Record<string, unknown>> {
  tenantId: string;
  payload: T;
}

export function validateTenantEvent<T extends Record<string, unknown> = Record<string, unknown>>(
  event: unknown,
  context?: string,
): ValidatedTenantEvent<T> {
  const label = context ? ` (${context})` : '';
  if (!event || typeof event !== 'object') {
    throw new TenantEventValidationError(`Invalid Kafka event${label}`);
  }
  const raw = event as Record<string, unknown>;
  if (raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)) {
    const inner = raw.payload as Record<string, unknown>;
    const tenantId =
      (raw.tenantId as string | undefined) ??
      (inner.tenantId as string | undefined) ??
      (inner.clinicId as string | undefined);
    if (!tenantId || typeof tenantId !== 'string') {
      throw new TenantEventValidationError(`Missing tenantId in Kafka envelope${label}`);
    }
    return {
      tenantId,
      payload: { ...inner, tenantId, clinicId: inner.clinicId ?? tenantId } as unknown as T,
    };
  }
  const tenantId = (raw.tenantId as string | undefined) ?? (raw.clinicId as string | undefined);
  if (!tenantId || typeof tenantId !== 'string') {
    throw new TenantEventValidationError(`Missing tenantId in Kafka event${label}`);
  }
  return {
    tenantId,
    payload: { ...raw, tenantId, clinicId: raw.clinicId ?? tenantId } as unknown as T,
  };
}

export async function withValidatedTenantEvent<T extends Record<string, unknown>, R>(
  event: unknown,
  context: string,
  tenantContext: TenantContextService,
  _logger: Logger,
  handler: (validated: ValidatedTenantEvent<T>) => Promise<R>,
): Promise<R | void> {
  try {
    const validated = validateTenantEvent<T>(event, context);
    return tenantContext.run(
      { tenantId: validated.tenantId, service: process.env.SERVICE_NAME },
      () => handler(validated),
    );
  } catch (err) {
    if (err instanceof TenantEventValidationError) {
      logKafkaEventIssue('error', context, err.message, { event: 'kafka_event_validation_failed' });
      return;
    }
    throw err;
  }
}

export async function withOptionalTenantEvent<T extends Record<string, unknown>, R>(
  event: unknown,
  context: string,
  tenantContext: TenantContextService,
  _logger: Logger,
  handler: (payload: T, tenantId?: string) => Promise<R>,
): Promise<R | void> {
  if (!event || typeof event !== 'object') {
    logKafkaEventIssue('error', context, 'Invalid Kafka event', { event: 'kafka_event_invalid' });
    return;
  }
  const raw = event as Record<string, unknown>;
  let payload: T;
  let tenantId: string | undefined;
  try {
    const validated = validateTenantEvent<T>(event, context);
    tenantId = validated.tenantId;
    payload = validated.payload;
  } catch (err) {
    if (!(err instanceof TenantEventValidationError)) throw err;
    payload =
      raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
        ? (raw.payload as T)
        : (raw as T);
    logKafkaEventIssue('warn', context, 'Missing tenantId on optional Kafka event', {
      event: 'kafka_event_missing_tenant',
    });
  }
  const run = () => handler(payload, tenantId);
  if (tenantId) {
    return tenantContext.run({ tenantId, service: process.env.SERVICE_NAME }, run);
  }
  return run();
}
