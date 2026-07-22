import * as crypto from 'crypto';

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

export function canonicalBody(body: unknown): string {
  if (body === undefined || body === null) return '';
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (typeof body === 'string') return body;
  return stableStringify(body);
}

export function buildSignaturePayload(
  method: string,
  path: string,
  body: unknown,
  timestamp: string,
): string {
  const normalizedPath = path.split('?')[0];
  return `${method.toUpperCase()}\n${normalizedPath}\n${canonicalBody(body)}\n${timestamp}`;
}

export function signInternalRequest(
  secret: string,
  method: string,
  path: string,
  body: unknown,
  timestamp?: string,
): { timestamp: string; signature: string } {
  const ts = timestamp ?? Date.now().toString();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(buildSignaturePayload(method, path, body, ts))
    .digest('hex');
  return { timestamp: ts, signature };
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

export function isTimestampFresh(
  timestamp: string,
  windowMs: number = 30_000,
): boolean {
  const parsed = parseInt(timestamp, 10);
  if (!Number.isFinite(parsed)) return false;
  const age = Date.now() - parsed;
  return age <= windowMs && age >= -windowMs;
}

export function verifyInternalRequest(
  secret: string,
  method: string,
  path: string,
  body: unknown,
  timestamp: string,
  signature: string,
): boolean {
  if (!secret || !timestamp || !signature) return false;
  if (!isTimestampFresh(timestamp)) return false;
  const expected = signInternalRequest(secret, method, path, body, timestamp).signature;
  return timingSafeEqualHex(expected, signature);
}

export function extractPathFromUrl(urlOrPath: string): string {
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return new URL(urlOrPath).pathname;
  }
  return urlOrPath.split('?')[0];
}
