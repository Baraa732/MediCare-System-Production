import { apiRequest } from "./client";

export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface ClinicHoursDay {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed?: boolean;
}

export function getClinicHours(clinicId: string, token: string) {
  return apiRequest<{ success: boolean; hours: ClinicHoursDay[] }>(
    `/schedule/clinics/${clinicId}/hours`,
    { token },
  );
}

export interface ScheduleBlock {
  id: string;
  clinicId?: string;
  doctorId?: string | null;
  startsAt: string;
  endsAt: string;
  reason?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}

export function listScheduleBlocks(clinicId: string, token: string) {
  const params = new URLSearchParams({ clinicId });
  return apiRequest<{ success: boolean; blocks: ScheduleBlock[] }>(
    `/schedule/blocked?${params.toString()}`,
    { token },
  );
}

export function listAvailableSlots(
  query: {
    clinicId: string;
    doctorId: string;
    date: Date;
    durationMinutes?: number;
  },
  token: string,
) {
  const params = new URLSearchParams({
    clinicId: query.clinicId,
    doctorId: query.doctorId,
    date: dateKey(query.date),
  });
  if (query.durationMinutes) {
    params.set("durationMinutes", String(query.durationMinutes));
  }

  return apiRequest<{
    success: boolean;
    slots: string[];
    timezone?: string;
    closed?: boolean;
  }>(`/schedule/slots?${params.toString()}`, { token });
}

export function minutesFromMidnight(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

export function formatSlotLabel(iso: string, durationMinutes: number): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const fmt = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const displayH = h % 12 || 12;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${displayH}:${String(m).padStart(2, "0")} ${ampm}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}
