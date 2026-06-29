import { apiRequest, apiUpload, API_BASE } from "./client";
import { useAuthStore } from "@/stores/authStore";
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

export function uploadUserAvatar(userId: string, file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<UserProfile>(`/users/${userId}/avatar`, formData, token);
}

const avatarBlobCache = new Map<string, string>();

export async function fetchAvatarBlobUrl(
  userId: string,
  token: string,
  cacheKey?: string,
): Promise<string | null> {
  const key = cacheKey ?? userId;
  const cached = avatarBlobCache.get(key);
  if (cached) return cached;

  try {
    const tenantId =
      useAuthStore.getState().tenantId ?? useAuthStore.getState().clinicId;

    const response = await fetch(`${API_BASE}/users/avatars/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
      },
      credentials: "include",
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    avatarBlobCache.set(key, objectUrl);
    return objectUrl;
  } catch {
    return null;
  }
}

export function revokeAvatarBlobUrl(cacheKey: string) {
  const existing = avatarBlobCache.get(cacheKey);
  if (existing) {
    URL.revokeObjectURL(existing);
    avatarBlobCache.delete(cacheKey);
  }
}

export function clearAvatarCacheForUser(userId: string) {
  for (const key of avatarBlobCache.keys()) {
    if (key.includes(userId)) {
      revokeAvatarBlobUrl(key);
    }
  }
}
