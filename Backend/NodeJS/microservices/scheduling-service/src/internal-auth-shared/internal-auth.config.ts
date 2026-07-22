import { InternalServiceName } from './types';

const WEAK_SECRET_PATTERNS = ['changeme', 'replace-me', 'example', 'default', 'test', 'dummy'];

export interface InternalAuthConfig {
  serviceName: InternalServiceName;
  signingSecret: string;
  trustedSecrets: Record<string, string>;
}

export function validateInternalSecret(label: string, secret: string): void {
  const trimmed = secret?.trim();
  if (!trimmed) {
    throw new Error(`[${label}] secret is required and cannot be empty`);
  }
  if (trimmed.length < 24) {
    throw new Error(`[${label}] secret must be at least 24 characters long`);
  }
  const normalized = trimmed.toLowerCase();
  if (WEAK_SECRET_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    throw new Error(`[${label}] secret appears to be a placeholder value`);
  }
  if (/\s/.test(trimmed)) {
    throw new Error(`[${label}] secret must not contain whitespace`);
  }
}

export function parseTrustedSecrets(raw: string | undefined, serviceName: string): Record<string, string> {
  if (!raw?.trim()) {
    throw new Error(`[${serviceName}] INTERNAL_AUTH_TRUSTED_SECRETS is required`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`[${serviceName}] INTERNAL_AUTH_TRUSTED_SECRETS must be valid JSON`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`[${serviceName}] INTERNAL_AUTH_TRUSTED_SECRETS must be a JSON object`);
  }

  const trusted: Record<string, string> = {};
  for (const [caller, secret] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof secret !== 'string') {
      throw new Error(`[${serviceName}] INTERNAL_AUTH_TRUSTED_SECRETS.${caller} must be a string`);
    }
    validateInternalSecret(`${serviceName}:trusted:${caller}`, secret);
    trusted[caller] = secret.trim();
  }

  if (Object.keys(trusted).length === 0) {
    throw new Error(`[${serviceName}] INTERNAL_AUTH_TRUSTED_SECRETS must contain at least one caller`);
  }

  return trusted;
}

export function requireInternalAuthConfig(expectedServiceName: InternalServiceName): InternalAuthConfig {
  const serviceName = (process.env.INTERNAL_AUTH_SERVICE_NAME?.trim() ||
    process.env.SERVICE_NAME?.trim()) as InternalServiceName | undefined;

  if (!serviceName) {
    throw new Error(`[${expectedServiceName}] INTERNAL_AUTH_SERVICE_NAME is required`);
  }
  if (serviceName !== expectedServiceName) {
    throw new Error(
      `[${expectedServiceName}] INTERNAL_AUTH_SERVICE_NAME must be "${expectedServiceName}" (got "${serviceName}")`,
    );
  }

  const signingSecret = process.env.INTERNAL_AUTH_SECRET?.trim();
  if (!signingSecret) {
    throw new Error(`[${expectedServiceName}] INTERNAL_AUTH_SECRET is required`);
  }
  validateInternalSecret(expectedServiceName, signingSecret);

  const trustedSecrets = parseTrustedSecrets(
    process.env.INTERNAL_AUTH_TRUSTED_SECRETS,
    expectedServiceName,
  );

  return { serviceName, signingSecret, trustedSecrets };
}

export function loadRuntimeInternalAuthConfig(): InternalAuthConfig {
  const serviceName = process.env.INTERNAL_AUTH_SERVICE_NAME?.trim() as InternalServiceName;
  const signingSecret = process.env.INTERNAL_AUTH_SECRET?.trim() || '';
  const trustedSecrets = parseTrustedSecrets(
    process.env.INTERNAL_AUTH_TRUSTED_SECRETS,
    serviceName || 'unknown-service',
  );
  return { serviceName, signingSecret, trustedSecrets };
}
