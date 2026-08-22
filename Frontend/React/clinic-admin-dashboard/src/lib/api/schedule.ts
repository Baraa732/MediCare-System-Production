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
  doctorId?: string | null;
  startsAt: string;
  endsAt: string;
  reason?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  createdBy?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
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
  return apiRequest<{
    success: boolean;
    hours: ClinicHoursDay;
    cancelledCount?: number;
  }>(`/schedule/clinics/${clinicId}/hours`, {
    method: "PUT",
    body,
    token,
  });
}

export async function setClinicHoursBatch(
  clinicId: string,
  hours: ClinicHoursDay[],
  token: string,
) {
  let cancelledCount = 0;
  for (const day of hours) {
    const res = await setClinicHoursDay(clinicId, day, token);
    cancelledCount += res.cancelledCount ?? 0;
  }
  const loaded = await getClinicHours(clinicId, token);
  return { ...loaded, cancelledCount };
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
  return apiRequest<{
    success: boolean;
    block: ScheduleBlock;
    cancelledCount?: number;
  }>("/schedule/blocked", { method: "POST", body, token });
}

export function listScheduleBlocks(
  clinicId: string,
  token: string,
  doctorId?: string,
) {
  const params = new URLSearchParams({ clinicId });
  if (doctorId) params.set("doctorId", doctorId);
  return apiRequest<{ success: boolean; blocks: ScheduleBlock[] }>(
    `/schedule/blocked?${params.toString()}`,
    { token },
  );
}

export function closeClinicDay(
  clinicId: string,
  body: { date: string; reason?: string },
  token: string,
) {
  return apiRequest<{
    success: boolean;
    block: ScheduleBlock;
    cancelledCount: number;
  }>(`/schedule/clinics/${clinicId}/close-day`, {
    method: "POST",
    body,
    token,
  });
}

export function openClinicDay(
  clinicId: string,
  body: { date: string },
  token: string,
) {
  return apiRequest<{
    success: boolean;
    removed: number;
  }>(`/schedule/clinics/${clinicId}/open-day`, {
    method: "POST",
    body,
    token,
  });
}

export function approveLeaveRequest(blockId: string, token: string) {
  return apiRequest<{
    success: boolean;
    block: ScheduleBlock;
    cancelledCount?: number;
  }>(`/schedule/blocked/${blockId}/approve`, { method: "PATCH", token });
}

export function rejectLeaveRequest(blockId: string, token: string) {
  return apiRequest<{
    success: boolean;
    block: ScheduleBlock;
    cancelledCount?: number;
  }>(`/schedule/blocked/${blockId}/reject`, { method: "PATCH", token });
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
