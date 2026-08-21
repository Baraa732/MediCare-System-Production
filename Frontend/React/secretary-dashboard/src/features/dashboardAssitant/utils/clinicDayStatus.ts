import type { ClinicHoursDay } from "@/lib/api/schedule";
import { clinicDateKey } from "@/lib/time/clinicTime";
import { getClinicOpenWindow } from "./clinicHours";

export interface ScheduleBlockLike {
  doctorId?: string | null;
  startsAt: string;
  endsAt: string;
}

/** True when the selected calendar day is closed (weekly hours or full-day clinic block). */
export function isClinicDateClosed(
  selectedDate: Date,
  hours: ClinicHoursDay[] | null | undefined,
  blocks: ScheduleBlockLike[] | null | undefined = [],
): boolean {
  const window = getClinicOpenWindow(hours, selectedDate);
  if (window?.isClosed) return true;

  const key = clinicDateKey(selectedDate);
  const dayStartMs = Date.parse(`${key}T00:00:00`);
  const dayEndMs = Date.parse(`${key}T23:59:59.999`);
  if (!Number.isFinite(dayStartMs) || !Number.isFinite(dayEndMs)) return false;

  return (blocks ?? []).some((b) => {
    if (b.doctorId) return false;
    const start = new Date(b.startsAt).getTime();
    const end = new Date(b.endsAt).getTime();
    // Full-day (or covering) clinic-wide closure.
    return start <= dayStartMs + 60_000 && end >= dayEndMs - 60_000;
  });
}
