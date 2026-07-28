import { apiRequest } from "./client";
import type {
  AuthSession,
  LoginMfaRequired,
  LoginResponse,
  VerifyMfaPasswordChange,
} from "./types";

export function login(phoneNumber: string, password: string) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: { phoneNumber, password },
  });
}

export type ClinicAdminOnboardingStatus = {
  phoneNumber: string;
  dashboardActivated: boolean;
  registered: boolean;
  canActivate: boolean;
  canRegister: boolean;
  canLogin: boolean;
  adminFullName?: string;
  clinicLocation?: string;
  idNumber?: string;
  dateOfBirth?: string;
  email?: string;
  registrationLicenseNumber?: string;
  address?: string;
};

export function getClinicAdminOnboardingStatus(phoneNumber: string) {
  const params = new URLSearchParams({ phoneNumber });
  return apiRequest<ClinicAdminOnboardingStatus>(
    `/auth/clinic-admin/onboarding-status?${params.toString()}`,
  );
}

export function activateClinicAdmin(phoneNumber: string, code: string) {
  return apiRequest<{
    message: string;
    phoneNumber?: string;
    adminFullName?: string;
    clinicLocation?: string;
    idNumber?: string;
    dateOfBirth?: string;
    email?: string;
    registrationLicenseNumber?: string;
    address?: string;
  }>("/auth/clinic-admin/activate", {
    method: "POST",
    body: { phoneNumber, code },
  });
}

export type ClinicAdminRegistration = {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  password: string;
  email?: string;
  middleName?: string;
  nationalId?: string;
  motherName?: string;
  motherLastName?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  birthDate?: string;
  birthPlace?: string;
  maritalStatus?: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
  healthStatus?: string;
  yearsOfExperience?: number;
  governorate?: string;
  state?: string;
  streetInfo?: string;
  licenseNumber?: string;
};

export type OtpDeliveryResult = {
  message: string;
  whatsappSent?: boolean;
  whatsappHint?: string;
  devOtp?: string;
};

export function registerClinicAdmin(body: ClinicAdminRegistration) {
  return apiRequest<OtpDeliveryResult>("/auth/register", {
    method: "POST",
    body: { ...body, role: "CLINIC_ADMIN" },
  });
}

export function resendRegistrationOtp(phoneNumber: string) {
  return apiRequest<OtpDeliveryResult>("/auth/resend-otp", {
    method: "POST",
    body: { phoneNumber },
  });
}

export function resendMfaOtp(mfaToken: string) {
  return apiRequest<OtpDeliveryResult>("/auth/resend-mfa-otp", {
    method: "POST",
    body: { mfaToken },
  });
}

export function verifyRegistrationOtp(phoneNumber: string, otp: string) {
  return apiRequest<
    | AuthSession
    | (VerifyMfaPasswordChange & { requiresPasswordChange: true })
    | { message: string }
  >("/auth/verify-otp", {
    method: "POST",
    body: { phoneNumber, otp, autoLogin: "true" },
  });
}

export function verifyMfa(mfaToken: string, otp: string) {
  return apiRequest<AuthSession | VerifyMfaPasswordChange>("/auth/verify-mfa", {
    method: "POST",
    body: { mfaToken, otp },
  });
}

export function completeStaffActivation(
  activationToken: string,
  newPassword: string,
) {
  return apiRequest<AuthSession>("/auth/staff/complete-activation", {
    method: "POST",
    body: { activationToken, newPassword },
  });
}

export function logout(refreshToken: string, token: string) {
  return apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
    body: { refreshToken },
    token,
  });
}

export function sendPasswordResetOtp(phoneNumber: string) {
  return apiRequest<OtpDeliveryResult>("/auth/forgot-password/send-otp", {
    method: "POST",
    body: { phoneNumber },
  });
}

export function verifyPasswordResetOtp(phoneNumber: string, otp: string) {
  return apiRequest<{ message: string; verified: boolean }>(
    "/auth/forgot-password/verify-otp",
    {
      method: "POST",
      body: { phoneNumber, otp },
    },
  );
}

export function resetPassword(body: {
  phoneNumber: string;
  otp: string;
  newPassword: string;
}) {
  return apiRequest<AuthSession>("/auth/reset-password", {
    method: "POST",
    body,
  });
}

export function createClinicStaff(
  body: {
    phoneNumber: string;
    firstName: string;
    lastName: string;
    email?: string;
    role: "SECRETARY" | "DOCTOR";
    clinicId?: string;
    username?: string;
    specialization?: string;
    licenseNumber?: string;
    yearsOfExperience?: number;
    governorate?: string;
    state?: string;
    streetInfo?: string;
    gender?: "MALE" | "FEMALE" | "OTHER";
    birthDate?: string;
    birthPlace?: string;
    middleName?: string;
    nationalId?: string;
    maritalStatus?: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
  },
  token: string,
) {
  return apiRequest<{
    message: string;
    whatsappSent: boolean;
    whatsappHint?: string;
    userId?: string;
    role: string;
    devTemporaryPassword?: string;
  }>("/auth/clinic/create-user", {
    method: "POST",
    body,
    token,
  });
}

export function isMfaRequired(
  response: LoginResponse,
): response is LoginMfaRequired {
  return "requiresMfa" in response && response.requiresMfa === true;
}

export function isAuthSession(
  response: unknown,
): response is AuthSession {
  return (
    typeof response === "object" &&
    response !== null &&
    "accessToken" in response &&
    typeof (response as AuthSession).accessToken === "string"
  );
}

export function requiresPasswordChange(
  response: unknown,
): response is VerifyMfaPasswordChange {
  return (
    typeof response === "object" &&
    response !== null &&
    "requiresPasswordChange" in response &&
    (response as VerifyMfaPasswordChange).requiresPasswordChange === true
  );
}
