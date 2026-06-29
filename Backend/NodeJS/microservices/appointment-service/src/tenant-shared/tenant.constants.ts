export const TENANT_HEADER = 'x-tenant-id';

export const TENANT_ID_CLAIM = 'tenantId';

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
