import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_GUARD_KEY = 'skipTenantGuard';

/** Skip mandatory tenant context (public routes, platform admin). */
export const SkipTenantGuard = () => SetMetadata(SKIP_TENANT_GUARD_KEY, true);
