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

export function verifyMfa(mfaToken: string, otp: string) {
  return apiRequest<AuthSession | VerifyMfaPasswordChange>("/auth/verify-mfa", {
    method: "POST",
    body: { mfaToken, otp },
  });
}

export function resendMfaOtp(mfaToken: string) {
  return apiRequest<{ message: string }>("/auth/resend-mfa-otp", {
    method: "POST",
    body: { mfaToken },
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

export interface OtpDeliveryResponse {
  message: string;
  whatsappSent?: boolean;
  whatsappHint?: string;
  devOtp?: string;
}

export function sendPasswordResetOtp(phoneNumber: string) {
  return apiRequest<OtpDeliveryResponse>("/auth/forgot-password/send-otp", {
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

export function logout(refreshToken: string, token: string) {
  return apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
    body: { refreshToken },
    token,
  });
}

export function isMfaRequired(
  response: LoginResponse,
): response is LoginMfaRequired {
  return "requiresMfa" in response && response.requiresMfa === true;
}
