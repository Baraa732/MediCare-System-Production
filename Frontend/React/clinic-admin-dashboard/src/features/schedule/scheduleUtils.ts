import type { AvailabilitySlot, ClinicHoursDay } from "@/lib/api/schedule";

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function minutesToLabel(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function durationHours(start: string, end: string): number {
  const mins = Math.max(0, timeToMinutes(end) - timeToMinutes(start));
  return Math.round((mins / 60) * 10) / 10;
}

export function combineDateAndTime(date: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}

export function hoursEqual(a: ClinicHoursDay[], b: ClinicHoursDay[]): boolean {
  if (a.length !== b.length) return false;
  const sort = (list: ClinicHoursDay[]) =>
    [...list].sort((x, y) => x.dayOfWeek - y.dayOfWeek);
  const left = sort(a);
  const right = sort(b);
  return left.every((day, i) => {
    const other = right[i];
    return (
      day.dayOfWeek === other.dayOfWeek &&
      day.openTime === other.openTime &&
      day.closeTime === other.closeTime &&
      Boolean(day.isClosed) === Boolean(other.isClosed)
    );
  });
}

export function openDaysCount(hours: ClinicHoursDay[]): number {
  return hours.filter((h) => !h.isClosed).length;
}

export function uniqueDoctorsCovered(availability: AvailabilitySlot[]): number {
  return new Set(availability.map((s) => s.doctorId)).size;
}

export function coverageMinutesForDay(
  availability: AvailabilitySlot[],
  dayOfWeek: number,
): number {
  return availability
    .filter((s) => s.dayOfWeek === dayOfWeek)
    .reduce((sum, s) => sum + Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime)), 0);
}

/** Build hour ticks clipped to clinic open window (or full day if closed/missing). */
export function buildHourTicks(openTime?: string, closeTime?: string, isClosed?: boolean): number[] {
  if (isClosed || !openTime || !closeTime) {
    return [9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => h * 60);
  }
  const start = timeToMinutes(openTime);
  const end = timeToMinutes(closeTime);
  const first = Math.floor(start / 60) * 60;
  const ticks: number[] = [];
  for (let t = first; t <= end; t += 60) ticks.push(t);
  if (ticks.length === 0) ticks.push(start);
  return ticks;
}

export function DOCTOR_LANE_COLORS(index: number): string {
  const palette = ["#0066ff", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1"];
  return palette[index % palette.length];
}
