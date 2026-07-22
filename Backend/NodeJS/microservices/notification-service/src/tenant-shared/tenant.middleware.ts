import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';
import { resolveTenantId } from './tenant-resolver';
import { TENANT_HEADER } from './tenant.constants';
import { isPublicOrInternalServiceRequest } from '../internal-auth-shared/tenant-internal-auth';

const PUBLIC_PATH_PREFIXES = ['/health', '/metrics'];
const INTERNAL_PATH_MARKERS = ['/internal', '/v1/clinics/internal', '/v1/appointments/internal', '/v1/schedule/internal', '/v1/notifications/internal', '/internal/emr'];

function isPublicOrInternal(req: Request): boolean {
  if (isPublicOrInternalServiceRequest(req)) return true;
  const path = (req.originalUrl || req.url || req.path || '').split('?')[0];
  if (PUBLIC_PATH_PREFIXES.some((p) => path.startsWith(p))) return true;
  return INTERNAL_PATH_MARKERS.some((m) => path.includes(m));
}

function resolveActorRole(req: Request, user?: Record<string, unknown>): string | undefined {
  return (
    (user?.role as string | undefined) ??
    (req.headers['x-user-role'] as string | undefined) ??
    (user ? undefined : (() => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) return undefined;
      try {
        const segment = auth.slice(7).split('.')[1];
        if (!segment) return undefined;
        const payload = JSON.parse(
          Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
        ) as { role?: string };
        return payload.role;
      } catch {
        return undefined;
      }
    })())
  );
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const user = (req as Request & { user?: Record<string, unknown> }).user;
    const role = resolveActorRole(req, user);
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
      role,
    });

    const userId =
      (user?.userId as string | undefined) ??
      (user?.id as string | undefined) ??
      (req.headers['x-user-id'] as string | undefined);

    const requestId = (req.headers['x-request-id'] as string | undefined) ?? undefined;

    if (role === 'SYSTEM_MANAGER') {
      this.tenantContext.run(
        {
          tenantId: null,
          userId,
          requestId,
          service: process.env.INTERNAL_AUTH_SERVICE_NAME || process.env.SERVICE_NAME,
        },
        () => next(),
      );
      return;
    }

    if (!tenantId && !isPublicOrInternal(req)) {
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
