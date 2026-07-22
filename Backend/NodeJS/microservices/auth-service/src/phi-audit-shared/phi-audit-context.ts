import { Request } from 'express';
import { TenantContextService } from '../tenant-shared/tenant-context.service';
import { PhiAuditEvent } from './types';

type AuthUser = { userId?: string; id?: string; role?: string };

export function buildPhiAuditContextFromRequest(
  req: Request & { user?: AuthUser },
  tenantContext: TenantContextService,
): Pick<PhiAuditEvent, 'actorId' | 'actorRole' | 'tenantId' | 'requestId' | 'ip' | 'userAgent'> {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
    req.ip ||
    undefined;

  return {
    actorId:
      req.user?.userId ??
      req.user?.id ??
      tenantContext.getUserId() ??
      (req.headers['x-user-id'] as string | undefined),
    actorRole:
      req.user?.role ??
      (req.headers['x-user-role'] as string | undefined) ??
      (req.headers['x-service-name'] as string | undefined),
    tenantId: tenantContext.getTenantId() ?? undefined,
    requestId:
      tenantContext.getRequestId() ??
      (req.headers['x-request-id'] as string | undefined),
    ip,
    userAgent: req.headers['user-agent'] as string | undefined,
  };
}
