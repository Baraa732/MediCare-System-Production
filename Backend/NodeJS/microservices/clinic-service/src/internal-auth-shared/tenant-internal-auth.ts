import { Request } from 'express';
import { INTERNAL_AUTH_HEADERS } from './types';
import { verifyInternalRequest } from './internal-auth.crypto';
import { loadRuntimeInternalAuthConfig } from './internal-auth.config';
import { isKnownInternalServiceName } from './internal-http.signer';

export function hasInternalAuthHeaders(req: Request): boolean {
  const headers = req.headers;
  return Boolean(
    headers[INTERNAL_AUTH_HEADERS.SERVICE_NAME] &&
      headers[INTERNAL_AUTH_HEADERS.SIGNATURE] &&
      headers[INTERNAL_AUTH_HEADERS.TIMESTAMP],
  );
}

export function verifyInternalAuthRequest(req: Request, bodyOverride?: unknown): boolean {
  if (headersPresent(req, INTERNAL_AUTH_HEADERS.LEGACY_TOKEN)) {
    return false;
  }

  const callerName = headerValue(req, INTERNAL_AUTH_HEADERS.SERVICE_NAME);
  const signature = headerValue(req, INTERNAL_AUTH_HEADERS.SIGNATURE);
  const timestamp = headerValue(req, INTERNAL_AUTH_HEADERS.TIMESTAMP);

  if (!callerName || !signature || !timestamp) return false;
  if (!isKnownInternalServiceName(callerName)) return false;

  const { trustedSecrets } = loadRuntimeInternalAuthConfig();
  const callerSecret = trustedSecrets[callerName];
  if (!callerSecret) return false;

  const method = (req.method || 'GET').toUpperCase();
  const path = (req.originalUrl || req.url || req.path || '').split('?')[0];
  const body = bodyOverride !== undefined ? bodyOverride : req.body;

  return verifyInternalRequest(callerSecret, method, path, body, timestamp, signature);
}

function headerValue(req: Request, name: string): string | undefined {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function headersPresent(req: Request, name: string): boolean {
  return Boolean(req.headers[name]);
}

export function isVerifiedInternalRequest(req: Request): boolean {
  if (!hasInternalAuthHeaders(req)) return false;
  return verifyInternalAuthRequest(req);
}

/**
 * Gateway proxy requests are signed with an empty body because the gateway
 * streams the upstream body without buffering it for HMAC input.
 */
export function isVerifiedGatewayProxyRequest(req: Request): boolean {
  const callerName = headerValue(req, INTERNAL_AUTH_HEADERS.SERVICE_NAME);
  if (callerName !== 'api-gateway') return false;
  return verifyInternalAuthRequest(req, '');
}

export function isPublicOrInternalServiceRequest(req: Request): boolean {
  if (isVerifiedInternalRequest(req)) return true;
  if (isVerifiedGatewayProxyRequest(req)) return true;
  return false;
}
