import { AuthUserProfile } from '../services/user-http.client';

/** Explicit identity fields returned on auth endpoints for mobile clients. */
export interface AuthIdentityFields {
  userId: string;
  role: string;
  tenantId?: string;
  clinicId?: string;
}

export interface AuthSessionResponse extends AuthIdentityFields {
  message: string;
  accessToken: string;
  refreshToken: string;
}

export interface AuthTokenRefreshResponse extends AuthIdentityFields {
  accessToken: string;
  refreshToken: string;
}

export function toAuthIdentity(user: AuthUserProfile & { clinicId?: string | null; tenantId?: string | null }): AuthIdentityFields {
  const identity: AuthIdentityFields = {
    userId: user.id,
    role: user.role,
  };
  const tenantId = user.tenantId ?? user.clinicId;
  if (tenantId) {
    identity.tenantId = tenantId;
    identity.clinicId = tenantId;
  }
  return identity;
}
