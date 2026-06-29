import { apiRequest } from "./client";

export interface ClinicHoursDay {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed?: boolean;
}

export interface AvailabilitySlot {
  id: string;
  clinicId: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number;
}

export interface ScheduleBlock {
  id: string;
  clinicId: string;
  doctorId?: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
}

export function getClinicHours(clinicId: string, token: string) {
  return apiRequest<{ success: boolean; hours: ClinicHoursDay[] }>(
    `/schedule/clinics/${clinicId}/hours`,
    { token },
  );
}

export function setClinicHoursDay(
  clinicId: string,
  body: ClinicHoursDay,
  token: string,
) {
  return apiRequest<{ success: boolean; hours: ClinicHoursDay }>(
    `/schedule/clinics/${clinicId}/hours`,
    { method: "PUT", body, token },
  );
}

export async function setClinicHoursBatch(
  clinicId: string,
  hours: ClinicHoursDay[],
  token: string,
) {
  for (const day of hours) {
    await setClinicHoursDay(clinicId, day, token);
  }
  return getClinicHours(clinicId, token);
}

export function listAvailability(
  clinicId: string,
  token: string,
  doctorId?: string,
) {
  const q = doctorId ? `&doctorId=${encodeURIComponent(doctorId)}` : "";
  return apiRequest<{ success: boolean; availability: AvailabilitySlot[] }>(
    `/schedule/availability?clinicId=${encodeURIComponent(clinicId)}${q}`,
    { token },
  );
}

export function createAvailability(
  body: {
    clinicId: string;
    doctorId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMinutes?: number;
  },
  token: string,
) {
  return apiRequest<{ success: boolean; availability: AvailabilitySlot }>(
    "/schedule/availability",
    { method: "POST", body, token },
  );
}

export function createScheduleBlock(
  body: {
    clinicId: string;
    doctorId?: string;
    startsAt: string;
    endsAt: string;
    reason?: string;
  },
  token: string,
) {
  return apiRequest<{ success: boolean; block: ScheduleBlock }>(
    "/schedule/blocked",
    { method: "POST", body, token },
  );
}

export function getAvailableSlots(
  query: {
    clinicId: string;
    doctorId: string;
    date: string;
    durationMinutes?: number;
  },
  token: string,
) {
  const params = new URLSearchParams({
    clinicId: query.clinicId,
    doctorId: query.doctorId,
    date: query.date,
  });
  if (query.durationMinutes) {
    params.set("durationMinutes", String(query.durationMinutes));
  }
  return apiRequest<{
    success: boolean;
    slots: Array<{ start: string; end: string }>;
  }>(`/schedule/slots?${params.toString()}`, { token });
}
