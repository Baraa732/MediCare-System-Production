export const TENANT_HEADER = 'x-tenant-id';

export const TENANT_ID_CLAIM = 'tenantId';

/** Explicit scope for platform-global patient resources (never use NULL). */
export const PLATFORM_TENANT_SCOPE = '00000000-0000-4000-a000-000000000001';

/** Storage prefix segment for global patient uploads (avatars, etc.). */
export const GLOBAL_PATIENT_STORAGE_SCOPE = 'global-patients';

/** Redis key prefix: tenant:{tenantId}:resource:{id} */
export function tenantRedisKey(tenantId: string, resource: string, id: string): string {
  return `tenant:${tenantId}:${resource}:${id}`;
}

/** File upload root segment: uploads/tenant-{tenantId}/ */
export function tenantUploadPrefix(tenantId: string): string {
  return `uploads/tenant-${tenantId}`;
}

/** Wrap Kafka event with mandatory tenant envelope */
export function withTenantEvent<T extends Record<string, unknown>>(
  tenantId: string,
  payload: T,
): { tenantId: string; payload: T; timestamp: string } {
  return {
    tenantId,
    payload,
    timestamp: new Date().toISOString(),
  };
}
