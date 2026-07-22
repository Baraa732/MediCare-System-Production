import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantGuard } from './tenant.guard';
import { TenantAuthorizationGuard } from './tenant-authorization.guard';
import { HttpTenantAccessChecker } from './tenant-access-checker';

@Global()
@Module({
  providers: [
    TenantContextService,
    TenantGuard,
    TenantAuthorizationGuard,
    HttpTenantAccessChecker,
  ],
  exports: [
    TenantContextService,
    TenantGuard,
    TenantAuthorizationGuard,
    HttpTenantAccessChecker,
  ],
})
export class TenantModule {}
