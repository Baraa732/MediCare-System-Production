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

/** Public auth routes — no tenant context required (mirrors api-gateway PRODUCTION_PUBLIC_PATHS). */
const PUBLIC_AUTH_PATHS = new Set([
  '/v1/auth/register',
  '/v1/auth/send-otp',
  '/v1/auth/verify-otp',
  '/v1/auth/login',
  '/v1/auth/refresh-token',
  '/v1/auth/reset-password',
  '/v1/auth/forgot-password/send-otp',
  '/v1/auth/forgot-password/verify-otp',
  '/v1/auth/verify-mfa',
  '/v1/auth/staff/complete-activation',
  '/v1/auth/resend-otp',
  '/v1/auth/resend-mfa-otp',
  '/v1/auth/check-otp-status',
  '/v1/auth/clinic-admin/activate',
  '/v1/auth/clinic-admin/onboarding-status',
]);

const PUBLIC_AUTH_DEV_PREFIX = '/v1/auth/dev/';

const INTERNAL_PATH_MARKERS = ['/internal', '/v1/clinics/internal', '/v1/appointments/internal', '/v1/schedule/internal', '/v1/notifications/internal', '/internal/emr'];

function requestPath(req: Request): string {
  const raw = (req.originalUrl || req.url || req.path || '').split('?')[0];
  if (!raw) return '/';
  return raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function isPublicAuthRoute(path: string): boolean {
  if (PUBLIC_AUTH_PATHS.has(path)) return true;
  if (process.env.NODE_ENV === 'development' && path.startsWith(PUBLIC_AUTH_DEV_PREFIX)) {
    return true;
  }
  return false;
}

function isPublicOrInternal(req: Request): boolean {
  if (isPublicOrInternalServiceRequest(req)) return true;
  const path = requestPath(req);
  if (PUBLIC_PATH_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (isPublicAuthRoute(path)) return true;
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

    if (!tenantId && !isPublicOrInternal(req) && role !== 'PATIENT') {
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
