import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from './tenant-context.service';
import { SKIP_TENANT_GUARD_KEY } from './tenant.decorators';

const PLATFORM_ROLES = new Set(['SYSTEM_MANAGER']);

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const role =
      request.user?.role ?? (request.headers['x-user-role'] as string | undefined);

    if (role && PLATFORM_ROLES.has(role)) {
      return true;
    }

    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Missing tenant context');
    }

    return true;
  }
}
