import { UnauthorizedException } from '@nestjs/common';

export type ClientAppId =
  | 'patient-mobile'
  | 'doctor-mobile'
  | 'secretary-web'
  | 'clinic-admin-web'
  | 'system-manager-web';

const CLIENT_APP_ALLOWED_ROLES: Record<ClientAppId, ReadonlySet<string>> = {
  'patient-mobile': new Set(['PATIENT']),
  'doctor-mobile': new Set(['DOCTOR']),
  'secretary-web': new Set(['SECRETARY']),
  'clinic-admin-web': new Set(['CLINIC_ADMIN']),
  'system-manager-web': new Set(['SYSTEM_MANAGER']),
};

export function isKnownClientApp(clientApp?: string): clientApp is ClientAppId {
  return Boolean(clientApp && clientApp in CLIENT_APP_ALLOWED_ROLES);
}

/** Reject cross-app login without revealing the user's actual role. */
export function assertRoleAllowedForClientApp(
  clientApp: string | undefined,
  role: string,
): void {
  if (!isKnownClientApp(clientApp)) return;

  if (!CLIENT_APP_ALLOWED_ROLES[clientApp].has(role)) {
    throw new UnauthorizedException('Invalid credentials');
  }
}
