import { apiRequest } from "./client";
import type { ClinicDoctor, ClinicPublic, StaffMember } from "./types";

export function getMyClinics(token: string) {
  return apiRequest<{ success: boolean; clinics: ClinicPublic[] }>(
    "/clinics/me?staffRole=CLINIC_ADMIN",
    { token },
  );
}

export function getClinic(id: string, token: string) {
  return apiRequest<{ success: boolean; clinic: ClinicPublic }>(
    `/clinics/${id}`,
    { token },
  );
}

export function getClinicProfile(id: string, token: string) {
  return apiRequest<{
    success: boolean;
    clinic: ClinicPublic;
    doctors?: ClinicDoctor[];
    hours?: Array<{
      dayOfWeek: number;
      openTime: string;
      closeTime: string;
      isClosed?: boolean;
    }>;
  }>(`/clinics/${id}/profile`, { token });
}

export function updateClinic(
  id: string,
  body: Partial<ClinicPublic>,
  token: string,
) {
  return apiRequest<{ success: boolean; clinic: ClinicPublic }>(
    `/clinics/${id}`,
    { method: "PUT", body, token },
  );
}

export function listStaff(clinicId: string, token: string, staffRole?: string) {
  const q = staffRole ? `?staffRole=${encodeURIComponent(staffRole)}` : "";
  return apiRequest<{ success: boolean; staff: StaffMember[] }>(
    `/clinics/${clinicId}/staff${q}`,
    { token },
  );
}

export function listDoctors(clinicId: string, token: string) {
  return apiRequest<{ success: boolean; doctors: ClinicDoctor[] }>(
    `/clinics/${clinicId}/doctors`,
    { token },
  );
}

export function assignStaff(
  clinicId: string,
  body: { userId: string; staffRole: string },
  token: string,
) {
  return apiRequest<{ success: boolean }>(`/clinics/${clinicId}/staff`, {
    method: "POST",
    body,
    token,
  });
}

export function removeStaff(clinicId: string, userId: string, token: string) {
  return apiRequest<{ success: boolean }>(
    `/clinics/${clinicId}/staff/${userId}`,
    { method: "DELETE", token },
  );
}
