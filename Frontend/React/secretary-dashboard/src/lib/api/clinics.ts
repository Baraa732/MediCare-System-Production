import { apiRequest } from "./client";
import type { ClinicDoctor } from "./types";

export interface ClinicSummary {
  id: string;
  name: string;
  staffRole?: string;
}

export function listMyClinics(token: string, staffRole?: string) {
  const query = staffRole ? `?staffRole=${encodeURIComponent(staffRole)}` : "";
  return apiRequest<{ success: boolean; clinics: ClinicSummary[] }>(
    `/clinics/me${query}`,
    { token },
  );
}

export function listDoctors(clinicId: string, token: string) {
  return apiRequest<{ success: boolean; doctors: ClinicDoctor[] }>(
    `/clinics/${clinicId}/doctors`,
    { token },
  );
}
