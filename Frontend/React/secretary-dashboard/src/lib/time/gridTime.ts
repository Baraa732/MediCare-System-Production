import {
  ROW_MINUTES,
  START_TIME_MINUTES,
} from "@/features/dashboardAssitant/data/scheduleGrid";

/** Minutes since local midnight (e.g. 8:00 AM => 480). */
export function absoluteMinutesFromDate(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Minutes since the schedule grid start (8:00 AM by default). */
export function gridMinutesFromAbsolute(absoluteMinutes: number): number {
  return Math.max(0, absoluteMinutes - START_TIME_MINUTES);
}

export function absoluteMinutesFromGridSlot(slotIdx: number): number {
  return START_TIME_MINUTES + slotIdx * ROW_MINUTES;
}

export function absoluteMinutesFromGridMinutes(gridMinutes: number): number {
  return START_TIME_MINUTES + gridMinutes;
}

export function gridMinutesFromSlot(slotIdx: number): number {
  return slotIdx * ROW_MINUTES;
}

export function slotRangeDurationMinutes(
  startSlot: number,
  endSlot: number,
): number {
  return (Math.abs(endSlot - startSlot) + 1) * ROW_MINUTES;
}

export function scheduledAtFromAbsoluteMinutes(
  absoluteMinutes: number,
  referenceDate = new Date(),
): string {
  const date = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0,
  );
  date.setHours(
    Math.floor(absoluteMinutes / 60),
    absoluteMinutes % 60,
    0,
    0,
  );
  return date.toISOString();
}

export function scheduledAtFromGridMinutes(
  gridMinutes: number,
  referenceDate = new Date(),
): string {
  return scheduledAtFromAbsoluteMinutes(
    absoluteMinutesFromGridMinutes(gridMinutes),
    referenceDate,
  );
}

export function absoluteMinutesFromIso(iso: string): number {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return START_TIME_MINUTES;
  return absoluteMinutesFromDate(date);
}

export function gridMinutesFromIso(iso: string): number {
  return gridMinutesFromAbsolute(absoluteMinutesFromIso(iso));
}

export function formatAbsoluteMinutesLabel(absoluteMinutes: number): string {
  const hours = Math.floor(absoluteMinutes / 60);
  const mins = absoluteMinutes % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(mins).padStart(2, "0")} ${ampm}`;
}

export function formatAbsoluteRangeLabel(
  startAbsolute: number,
  durationMinutes: number,
): string {
  const endAbsolute = startAbsolute + durationMinutes;
  return `${formatAbsoluteMinutesLabel(startAbsolute)} – ${formatAbsoluteMinutesLabel(endAbsolute)}`;
}
