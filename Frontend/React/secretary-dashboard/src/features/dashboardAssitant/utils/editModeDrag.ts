import { START_TIME_MINUTES } from "../data/scheduleGrid";
import {
  absoluteMinutesInClinic,
  clinicDateKey,
} from "@/lib/time/clinicTime";
import { normalizeAppointmentStatus } from "./appointmentStatusStyles";

/**
 * Minutes since 8:00 on the selected clinic day.
 * Future days: -Infinity (nothing is past).
 * Past days: +Infinity (everything is past).
 * Today before 8:00: negative (nothing has started yet).
 */
export function clinicNowGridMinutes(selectedDate: Date, now = new Date()): number {
  const selectedKey = clinicDateKey(selectedDate);
  const nowKey = clinicDateKey(now);

  if (selectedKey > nowKey) return Number.NEGATIVE_INFINITY;
  if (selectedKey < nowKey) return Number.POSITIVE_INFINITY;

  return absoluteMinutesInClinic(now) - START_TIME_MINUTES;
}

/** True when a grid slot start is strictly before clinic "now" on that day. */
export function isGridSlotInPast(
  slotStartMinutes: number,
  selectedDate: Date,
  now = new Date(),
): boolean {
  return slotStartMinutes < clinicNowGridMinutes(selectedDate, now);
}

/** Absolute minutes since midnight — used by the booking wizard. */
export function isAbsoluteSlotInPast(
  absoluteMinutes: number,
  selectedDate: Date,
  now = new Date(),
): boolean {
  return isGridSlotInPast(
    absoluteMinutes - START_TIME_MINUTES,
    selectedDate,
    now,
  );
}

const TERMINAL_STATUSES = new Set([
  "done",
  "cancelled",
  "no-show",
  "unavailable",
]);

export function isAppointmentLockedInEditMode(
  status: string | undefined,
  startMinutes: number,
  nowGridMinutes: number,
): boolean {
  const display = normalizeAppointmentStatus(status);
  if (TERMINAL_STATUSES.has(display)) return true;
  if (!Number.isFinite(nowGridMinutes)) return nowGridMinutes > 0;
  return startMinutes <= nowGridMinutes;
}
