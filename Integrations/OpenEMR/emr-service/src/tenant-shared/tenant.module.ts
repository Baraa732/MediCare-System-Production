import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantGuard } from './tenant.guard';
import { TenantAuthorizationGuard } from './tenant-authorization.guard';
import { DoctorPatientAccessGuard } from './doctor-patient-access.guard';
import { HttpTenantAccessChecker } from './tenant-access-checker';

@Global()
@Module({
  providers: [
    TenantContextService,
    TenantGuard,
    TenantAuthorizationGuard,
    DoctorPatientAccessGuard,
    HttpTenantAccessChecker,
  ],
  exports: [
    TenantContextService,
    TenantGuard,
    TenantAuthorizationGuard,
    DoctorPatientAccessGuard,
    HttpTenantAccessChecker,
  ],
})
export class TenantModule {}
