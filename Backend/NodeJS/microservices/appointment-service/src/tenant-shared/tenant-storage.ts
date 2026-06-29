import { join } from 'path';
import { tenantUploadPrefix } from './tenant.constants';

/** Resolve tenant-scoped upload path: uploads/tenant-{tenantId}/... */
export function resolveTenantUploadPath(tenantId: string, ...segments: string[]): string {
  return join(tenantUploadPrefix(tenantId), ...segments);
}
