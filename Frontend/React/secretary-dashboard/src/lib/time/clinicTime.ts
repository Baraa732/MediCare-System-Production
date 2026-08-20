/** Clinic wall-clock timezone — must match scheduling-service defaults. */
export const DEFAULT_CLINIC_TIMEZONE = "Asia/Damascus";

export function resolveClinicTimezone(timezone?: string | null): string {
  return timezone?.trim() || DEFAULT_CLINIC_TIMEZONE;
}

function clinicTimeParts(
  value: string | Date,
  timezone = DEFAULT_CLINIC_TIMEZONE,
): { hour: number; minute: number; year: number; month: number; day: number } {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { hour: 0, minute: 0, year: 1970, month: 1, day: 1 };
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: resolveClinicTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
  };
}

/** Minutes since local midnight in the clinic timezone. */
export function absoluteMinutesInClinic(
  value: string | Date,
  timezone = DEFAULT_CLINIC_TIMEZONE,
): number {
  const { hour, minute } = clinicTimeParts(value, timezone);
  return hour * 60 + minute;
}

export function formatClinicDateTime(
  value: string | Date,
  timezone = DEFAULT_CLINIC_TIMEZONE,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-GB", {
    timeZone: resolveClinicTimezone(timezone),
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatClinicTime(
  value: string | Date,
  timezone = DEFAULT_CLINIC_TIMEZONE,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-GB", {
    timeZone: resolveClinicTimezone(timezone),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function clinicDateKey(
  value: Date | string = new Date(),
  timezone = DEFAULT_CLINIC_TIMEZONE,
): string {
  const { year, month, day } = clinicTimeParts(value, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function clinicWallTimeToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone = DEFAULT_CLINIC_TIMEZONE,
): string {
  const tz = resolveClinicTimezone(timezone);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let i = 0; i < 4; i += 1) {
    const parts = clinicTimeParts(new Date(utcMs), tz);
    const desiredDayMs = Date.UTC(year, month - 1, day);
    const actualDayMs = Date.UTC(parts.year, parts.month - 1, parts.day);
    const minuteDiff =
      year === parts.year && month === parts.month && day === parts.day
        ? hour * 60 + minute - (parts.hour * 60 + parts.minute)
        : (desiredDayMs - actualDayMs) / 60_000 +
          (hour * 60 + minute - (parts.hour * 60 + parts.minute));
    if (minuteDiff === 0) break;
    utcMs += minuteDiff * 60_000;
  }

  return new Date(utcMs).toISOString();
}

export function clinicDateParts(
  value: string | Date,
  timezone = DEFAULT_CLINIC_TIMEZONE,
) {
  return clinicTimeParts(value, timezone);
}

export function formatClinicDate(
  value: string | Date,
  timezone = DEFAULT_CLINIC_TIMEZONE,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    timeZone: resolveClinicTimezone(timezone),
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
