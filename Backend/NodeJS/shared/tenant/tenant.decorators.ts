import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_GUARD_KEY = 'skipTenantGuard';

export const SKIP_TENANT_AUTH_KEY = 'skipTenantAuth';

export const DOCTOR_PATIENT_PARAM_KEY = 'doctorPatientParam';

/** Skip mandatory tenant context (public routes, platform admin). */
export const SkipTenantGuard = () => SetMetadata(SKIP_TENANT_GUARD_KEY, true);

/** Skip actor↔tenant membership validation (public booking, self-scoped routes). */
export const SkipTenantAuthorization = () => SetMetadata(SKIP_TENANT_AUTH_KEY, true);

/** Route param / body / query key holding patient userId for doctor assignment checks. */
export const DoctorPatientParam = (paramKey = 'userId') =>
  SetMetadata(DOCTOR_PATIENT_PARAM_KEY, paramKey);
