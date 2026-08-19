import { apiRequest } from "./client";
import type { ApiAppointment, EnrichedAppointment } from "./types";

export interface AppointmentQuery {
  clinicId: string;
  doctorId?: string;
  from?: string;
  to?: string;
  status?: string;
}

export interface UpdateAppointmentBody {
  doctorId?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  reason?: string;
  notes?: string;
}

export interface CreateAppointmentBody {
  clinicId: string;
  doctorId: string;
  patientId?: string;
  guestPatientName?: string;
  guestPatientPhone?: string;
  scheduledAt: string;
  durationMinutes?: number;
  reason?: string;
}

export type AppointmentStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export function listAppointments(query: AppointmentQuery, token: string) {
  const params = new URLSearchParams({ clinicId: query.clinicId });
  if (query.doctorId) params.set("doctorId", query.doctorId);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.status) params.set("status", query.status);

  return apiRequest<{ success: boolean; appointments: ApiAppointment[] }>(
    `/appointments?${params.toString()}`,
    { token },
  );
}

export function getAppointment(id: string, token: string) {
  return apiRequest<{ success: boolean; appointment: EnrichedAppointment }>(
    `/appointments/${id}`,
    { token },
  );
}

export function createAppointment(body: CreateAppointmentBody, token: string) {
  return apiRequest<{ success: boolean; appointment: EnrichedAppointment }>(
    "/appointments",
    { method: "POST", body, token },
  );
}

export function updateAppointment(
  id: string,
  body: UpdateAppointmentBody,
  token: string,
) {
  return apiRequest<{ success: boolean; appointment: EnrichedAppointment }>(
    `/appointments/${id}`,
    { method: "PUT", body, token },
  );
}

export function updateAppointmentStatus(
  id: string,
  body: { status: AppointmentStatus; cancellationReason?: string },
  token: string,
) {
  return apiRequest<{ success: boolean; appointment: EnrichedAppointment }>(
    `/appointments/${id}/status`,
    { method: "PATCH", body, token },
  );
}

export function cancelAppointment(id: string, token: string, reason?: string) {
  return updateAppointmentStatus(
    id,
    { status: "CANCELLED", cancellationReason: reason },
    token,
  );
}
