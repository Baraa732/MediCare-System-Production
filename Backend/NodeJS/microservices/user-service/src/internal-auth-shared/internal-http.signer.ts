import {
  INTERNAL_AUTH_HEADERS,
  INTERNAL_SERVICE_NAMES,
  InternalServiceName,
} from './types';
import { signInternalRequest } from './internal-auth.crypto';

export function createInternalAuthHeaders(
  callerName: InternalServiceName | string,
  signingSecret: string,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Record<string, string> {
  if (!signingSecret) {
    throw new Error('INTERNAL_AUTH_SECRET is required for outbound internal requests');
  }

  const { timestamp, signature } = signInternalRequest(
    signingSecret,
    method,
    path,
    body ?? '',
  );

  return {
    [INTERNAL_AUTH_HEADERS.SERVICE_NAME]: callerName,
    [INTERNAL_AUTH_HEADERS.SIGNATURE]: signature,
    [INTERNAL_AUTH_HEADERS.TIMESTAMP]: timestamp,
    ...(extraHeaders ?? {}),
  };
}

export function createInternalAuthHeadersForUrl(
  callerName: InternalServiceName | string,
  signingSecret: string,
  method: string,
  url: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Record<string, string> {
  const path = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0];
  return createInternalAuthHeaders(callerName, signingSecret, method, path, body, extraHeaders);
}

export function isKnownInternalServiceName(name: string): name is InternalServiceName {
  return (INTERNAL_SERVICE_NAMES as readonly string[]).includes(name);
}
