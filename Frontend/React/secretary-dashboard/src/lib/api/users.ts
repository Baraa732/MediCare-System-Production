import { apiRequest } from "./client";
import type { UserProfile } from "./types";

export interface PatientLookup {
  id: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  status: string;
}

export interface UpdateProfileBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  profileData?: Record<string, unknown>;
}

export function lookupPatientByPhone(phoneNumber: string, token: string) {
  const encoded = encodeURIComponent(phoneNumber);
  return apiRequest<PatientLookup>(`/users/lookup/patient/${encoded}`, { token });
}

export function getProfile(userId: string, token: string) {
  return apiRequest<UserProfile>(`/users/${userId}`, { token });
}

export function updateProfile(
  userId: string,
  body: UpdateProfileBody,
  token: string,
) {
  return apiRequest<UserProfile>(`/users/${userId}`, {
    method: "PUT",
    body,
    token,
  });
}

export function changePassword(
  userId: string,
  body: { currentPassword: string; newPassword: string },
  token: string,
) {
  return apiRequest<{ message: string }>(`/users/${userId}/change-password`, {
    method: "POST",
    body,
    token,
  });
}
