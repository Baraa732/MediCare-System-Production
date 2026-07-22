import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from './tenant-context.service';
import { SKIP_TENANT_AUTH_KEY, SKIP_TENANT_GUARD_KEY } from './tenant.decorators';
import { HttpTenantAccessChecker, TENANT_ACCESS_CHECKER, TenantAccessChecker } from './tenant-access-checker';

const PLATFORM_ROLES = new Set(['SYSTEM_MANAGER']);
const STAFF_ROLES = new Set(['CLINIC_ADMIN', 'SECRETARY', 'DOCTOR']);

@Injectable()
export class TenantAuthorizationGuard implements CanActivate {
  private readonly fallbackChecker = new HttpTenantAccessChecker();

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly reflector: Reflector,
    @Optional() @Inject(TENANT_ACCESS_CHECKER) private readonly accessChecker?: TenantAccessChecker,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipAuth = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipAuth) return true;

    const skipTenant = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipTenant) return true;

    const request = context.switchToHttp().getRequest();
    const role =
      (request.user?.role as string | undefined) ??
      (request.headers['x-user-role'] as string | undefined);

    if (role && PLATFORM_ROLES.has(role)) {
      return true;
    }

    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Missing tenant context');
    }

    const userId =
      (request.user?.userId as string | undefined) ??
      (request.headers['x-user-id'] as string | undefined);

    if (!userId) {
      throw new ForbiddenException('Missing user context');
    }

    const checker = this.accessChecker ?? this.fallbackChecker;

    if (role === 'PATIENT') {
      await checker.assertPatientAccess(tenantId, userId);
      return true;
    }

    if (role && STAFF_ROLES.has(role)) {
      await checker.assertStaffAccess(tenantId, userId, role);
      return true;
    }

    throw new ForbiddenException(`Unsupported role: ${role ?? 'unknown'}`);
  }
}
