import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';
import { resolveTenantId } from './tenant-resolver';
import { TENANT_HEADER } from './tenant.constants';

const PUBLIC_PATH_PREFIXES = ['/health', '/metrics'];
const INTERNAL_PATH_MARKERS = ['/internal', '/v1/clinics/internal', '/v1/appointments/internal', '/v1/schedule/internal', '/v1/notifications/internal', '/internal/emr'];
const PLATFORM_ROLES = new Set(['SYSTEM_MANAGER']);

function roleFrom(
  user?: Record<string, unknown>,
  jwtPayload?: Record<string, unknown> | null,
): string | undefined {
  const role = user?.role ?? jwtPayload?.role;
  return typeof role === 'string' ? role : undefined;
}

function isPlatformRole(
  user?: Record<string, unknown>,
  jwtPayload?: Record<string, unknown> | null,
): boolean {
  const role = roleFrom(user, jwtPayload);
  return role !== undefined && PLATFORM_ROLES.has(role);
}

function isPublicOrInternal(req: Request): boolean {
  if (req.headers['x-service-token']) return true;
  const path = (req.originalUrl || req.url || req.path || '').split('?')[0];
  if (PUBLIC_PATH_PREFIXES.some((p) => path.startsWith(p))) return true;
  return INTERNAL_PATH_MARKERS.some((m) => path.includes(m));
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const user = (req as Request & { user?: Record<string, unknown> }).user;
    const jwtPayload = user
      ? {
          tenantId: user.tenantId,
          clinicId: user.clinicId,
          sub: user.userId ?? user.id,
          role: user.role,
        }
      : this.peekJwtPayload(req);

    const tenantId = resolveTenantId({
      jwtPayload,
      headers: req.headers as Record<string, string | string[] | undefined>,
      hostname: req.hostname,
      query: req.query as Record<string, unknown>,
      body: req.body as Record<string, unknown> | undefined,
    });

    const userId =
      (user?.userId as string | undefined) ??
      (user?.id as string | undefined) ??
      (req.headers['x-user-id'] as string | undefined);

    const requestId = (req.headers['x-request-id'] as string | undefined) ?? undefined;

    if (!tenantId && !isPublicOrInternal(req) && !isPlatformRole(user, jwtPayload)) {
      throw new ForbiddenException('Tenant context is required');
    }

    if (tenantId) {
      req.headers[TENANT_HEADER] = tenantId;
    }

    this.tenantContext.run(
      {
        tenantId: tenantId ?? null,
        userId,
        requestId,
        service: process.env.SERVICE_NAME,
      },
      () => next(),
    );
  }

  private peekJwtPayload(req: Request): Record<string, unknown> | null {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    try {
      const segment = auth.slice(7).split('.')[1];
      if (!segment) return null;
      return JSON.parse(
        Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
      ) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
