import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_GUARD_KEY = 'skipTenantGuard';

export const SKIP_TENANT_AUTH_KEY = 'skipTenantAuth';

export const SkipTenantGuard = () => SetMetadata(SKIP_TENANT_GUARD_KEY, true);

export const SkipTenantAuthorization = () => SetMetadata(SKIP_TENANT_AUTH_KEY, true);
