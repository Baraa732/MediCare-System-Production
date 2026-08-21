import { START_TIME_MINUTES } from "../data/scheduleGrid";
import type { ClinicHoursDay } from "@/lib/api/schedule";
import { clinicDateKey } from "@/lib/time/clinicTime";

/** Parse "HH:MM" / "HH:MM:SS" into minutes since midnight. */
export function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** Day-of-week (0=Sun … 6=Sat) for the clinic calendar date. */
export function clinicDayOfWeek(selectedDate: Date): number {
  const key = clinicDateKey(selectedDate);
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function getHoursForDate(
  hours: ClinicHoursDay[] | null | undefined,
  selectedDate: Date,
): ClinicHoursDay | null {
  if (!hours?.length) return null;
  const dow = clinicDayOfWeek(selectedDate);
  return hours.find((h) => h.dayOfWeek === dow) ?? null;
}

/**
 * Absolute clinic minutes (since midnight) window for the selected day.
 * Returns null when hours are unknown (fail open for loading).
 * Returns closed window when the clinic day is marked closed.
 */
export function getClinicOpenWindow(
  hours: ClinicHoursDay[] | null | undefined,
  selectedDate: Date,
): { open: number; close: number; isClosed: boolean } | null {
  const day = getHoursForDate(hours, selectedDate);
  if (!day) return null;
  if (day.isClosed) {
    return { open: 0, close: 0, isClosed: true };
  }
  const open = timeStringToMinutes(day.openTime);
  const close = timeStringToMinutes(day.closeTime);
  if (!Number.isFinite(open) || !Number.isFinite(close) || open >= close) {
    return { open: 0, close: 0, isClosed: true };
  }
  return { open, close, isClosed: false };
}

/** Grid minutes (since 08:00) → absolute minutes since midnight. */
export function gridToAbsoluteMinutes(gridMinutes: number): number {
  return START_TIME_MINUTES + gridMinutes;
}

/**
 * True when a grid range is outside clinic open hours (or the day is closed).
 * When hours are not loaded yet, returns false (do not block).
 */
export function isGridRangeOutsideClinicHours(
  gridStart: number,
  gridEnd: number,
  selectedDate: Date,
  hours: ClinicHoursDay[] | null | undefined,
): boolean {
  const window = getClinicOpenWindow(hours, selectedDate);
  if (!window) return false;
  if (window.isClosed) return true;

  const absStart = gridToAbsoluteMinutes(gridStart);
  const absEnd = gridToAbsoluteMinutes(gridEnd);
  return absStart < window.open || absEnd > window.close;
}

/** True when a single 15-min grid slot start is outside open hours. */
export function isGridSlotOutsideClinicHours(
  gridStart: number,
  selectedDate: Date,
  hours: ClinicHoursDay[] | null | undefined,
  slotMinutes = 15,
): boolean {
  return isGridRangeOutsideClinicHours(
    gridStart,
    gridStart + slotMinutes,
    selectedDate,
    hours,
  );
}
