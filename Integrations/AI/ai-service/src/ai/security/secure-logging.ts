import { createHash, randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestLogContext {
  correlationId: string;
}

export const requestLogContext = new AsyncLocalStorage<RequestLogContext>();

export function getCorrelationId(): string {
  return requestLogContext.getStore()?.correlationId ?? 'no-correlation-id';
}

export function createCorrelationId(): string {
  return randomUUID();
}

export function hashRef(value: string): string {
  if (!value) return 'empty';
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

export function sanitizeAxiosError(err: unknown): {
  correlationId: string;
  status?: number;
  code?: string;
  reason: string;
} {
  const correlationId = getCorrelationId();
  if (err && typeof err === 'object' && 'isAxiosError' in err) {
    const axiosErr = err as { response?: { status?: number }; code?: string };
    return {
      correlationId,
      status: axiosErr.response?.status,
      code: axiosErr.code,
      reason: 'upstream_request_failed',
    };
  }
  return { correlationId, reason: 'unexpected_error' };
}
