import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_GUARD_KEY = 'skipTenantGuard';

export const SKIP_TENANT_AUTH_KEY = 'skipTenantAuth';

export const DOCTOR_PATIENT_PARAM_KEY = 'doctorPatientParam';

export const SkipTenantGuard = () => SetMetadata(SKIP_TENANT_GUARD_KEY, true);

export const SkipTenantAuthorization = () => SetMetadata(SKIP_TENANT_AUTH_KEY, true);

export const DoctorPatientParam = (paramKey = 'userId') =>
  SetMetadata(DOCTOR_PATIENT_PARAM_KEY, paramKey);
