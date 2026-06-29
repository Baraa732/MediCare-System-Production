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

export function lookupPatientByPhone(phoneNumber: string, token: string) {
  return apiRequest<PatientLookup>(
    `/users/lookup/patient/${encodeURIComponent(phoneNumber)}`,
    { token },
  );
}

export function getUserProfile(id: string, token: string) {
  return apiRequest<UserProfile>(`/users/${id}`, { token });
}

export function updateUserProfile(
  id: string,
  body: { firstName?: string; lastName?: string; email?: string },
  token: string,
) {
  return apiRequest<UserProfile>(`/users/${id}`, {
    method: "PUT",
    body,
    token,
  });
}

export function updateUserStatus(id: string, status: string, token: string) {
  return apiRequest<{ id: string; status: string }>(`/users/${id}/status`, {
    method: "PUT",
    body: { status },
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
