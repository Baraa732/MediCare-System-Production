import { TENANT_HEADER, TENANT_ID_CLAIM } from './tenant.constants';

export const CLINIC_ID_HEADER = 'x-clinic-id';

export interface TenantResolutionInput {
  jwtPayload?: Record<string, unknown> | null;
  headers?: Record<string, string | string[] | undefined>;
  hostname?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  /** When PATIENT, header/JWT tenant claims are ignored — only body/query clinicId is trusted. */
  role?: string;
}

function headerValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0]?.trim() || undefined;
  return raw?.trim() || undefined;
}

function paramValue(source: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!source) return undefined;
  const raw = source[key];
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return undefined;
}

/** Subdomain tenant slug — future-ready; returns null until DNS routing is enabled. */
export function resolveTenantFromSubdomain(hostname?: string): string | null {
  if (!hostname) return null;
  const host = hostname.split(':')[0].toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return null;
  const parts = host.split('.');
  if (parts.length < 3) return null;
  const slug = parts[0];
  if (!slug || slug === 'www' || slug === 'api') return null;
  return slug;
}

function resolveRole(input: TenantResolutionInput): string | undefined {
  return input.role ?? (typeof input.jwtPayload?.role === 'string' ? input.jwtPayload.role : undefined);
}

/**
 * Priority (staff / default):
 *   JWT tenantId → JWT clinicId → X-Tenant-ID → X-Clinic-ID → query/body clinicId → subdomain
 *
 * Priority (PATIENT):
 *   query/body clinicId only — patients must not drive tenant via raw X-Tenant-ID or JWT tenantId.
 */
export function resolveTenantId(input: TenantResolutionInput): string | null {
  const role = resolveRole(input);
  const isPatient = role === 'PATIENT';

  if (!isPatient) {
    const jwtTenant = input.jwtPayload?.[TENANT_ID_CLAIM];
    if (typeof jwtTenant === 'string' && jwtTenant.length > 0) {
      return jwtTenant;
    }

    const jwtClinic = input.jwtPayload?.clinicId;
    if (typeof jwtClinic === 'string' && jwtClinic.length > 0) {
      return jwtClinic;
    }

    const headerTenant = headerValue(input.headers, TENANT_HEADER);
    if (headerTenant) {
      return headerTenant;
    }

    const headerClinic = headerValue(input.headers, CLINIC_ID_HEADER);
    if (headerClinic) {
      return headerClinic;
    }
  }

  const queryTenant =
    paramValue(input.query, 'tenantId') ??
    paramValue(input.query, 'clinicId');
  if (queryTenant) {
    return queryTenant;
  }

  const bodyTenant =
    paramValue(input.body, 'tenantId') ??
    paramValue(input.body, 'clinicId');
  if (bodyTenant) {
    return bodyTenant;
  }

  if (isPatient) {
    return null;
  }

  return resolveTenantFromSubdomain(input.hostname);
}
