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
import { HttpTenantAccessChecker, TENANT_ACCESS_CHECKER, TenantAccessChecker } from './tenant-access-checker';
import { DOCTOR_PATIENT_PARAM_KEY } from './tenant.decorators';

@Injectable()
export class DoctorPatientAccessGuard implements CanActivate {
  private readonly fallbackChecker = new HttpTenantAccessChecker();

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly reflector: Reflector,
    @Optional() @Inject(TENANT_ACCESS_CHECKER) private readonly accessChecker?: TenantAccessChecker,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const role =
      (request.user?.role as string | undefined) ??
      (request.headers['x-user-role'] as string | undefined);

    if (role !== 'DOCTOR') {
      return true;
    }

    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Missing tenant context');
    }

    const doctorId =
      (request.user?.userId as string | undefined) ??
      (request.headers['x-user-id'] as string | undefined);

    if (!doctorId) {
      throw new ForbiddenException('Missing user context');
    }

    const paramKey =
      this.reflector.getAllAndOverride<string>(DOCTOR_PATIENT_PARAM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'userId';

    const patientId =
      (request.params?.[paramKey] as string | undefined) ??
      (request.body?.[paramKey] as string | undefined) ??
      (request.query?.[paramKey] as string | undefined);

    if (!patientId) {
      throw new ForbiddenException('Patient context is required');
    }

    const checker = this.accessChecker ?? this.fallbackChecker;
    await checker.assertDoctorPatientAccess(tenantId, doctorId, patientId);
    return true;
  }
}
