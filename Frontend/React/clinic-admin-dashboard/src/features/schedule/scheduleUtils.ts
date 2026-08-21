import type {
  AvailabilitySlot,
  ClinicHoursDay,
  ScheduleBlock,
} from "@/lib/api/schedule";
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfWeek,
} from "date-fns";

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

export function ensureWeekHours(hours: ClinicHoursDay[]): ClinicHoursDay[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const found = hours.find((h) => h.dayOfWeek === dayOfWeek);
    return (
      found ?? {
        dayOfWeek,
        openTime: "09:00",
        closeTime: "17:00",
        isClosed: dayOfWeek === 5 || dayOfWeek === 6,
      }
    );
  });
}

export function DOCTOR_COLORS(index: number): string {
  const palette = ["#0066ff", "#0f766e", "#b45309", "#0369a1", "#be123c", "#4338ca"];
  return palette[index % palette.length];
}

export type CalendarEventInput = {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  display?: "background" | "auto";
  editable?: boolean;
  extendedProps?: Record<string, unknown>;
};

/** Map clinic hours + availability + blocks into FullCalendar events for a visible range. */
export function buildCalendarEvents(args: {
  rangeStart: Date;
  rangeEnd: Date;
  hours: ClinicHoursDay[];
  availability: AvailabilitySlot[];
  blocks?: ScheduleBlock[];
  doctorName: (id: string) => string;
  doctorColorIndex: Map<string, number>;
}): CalendarEventInput[] {
  const {
    rangeStart,
    rangeEnd,
    hours,
    availability,
    blocks = [],
    doctorName,
    doctorColorIndex,
  } = args;
  const days = eachDayOfInterval({ start: rangeStart, end: addDays(rangeEnd, -1) });
  const events: CalendarEventInput[] = [];

  for (const day of days) {
    const dow = day.getDay();
    const dayHours = hours.find((h) => h.dayOfWeek === dow);
    const dateKey = format(day, "yyyy-MM-dd");

    if (dayHours && !dayHours.isClosed) {
      events.push({
        id: `hours-${dateKey}`,
        title: "Clinic open",
        start: `${dateKey}T${dayHours.openTime}:00`,
        end: `${dateKey}T${dayHours.closeTime}:00`,
        display: "background",
        backgroundColor: "#ecf3ff",
        editable: false,
        extendedProps: { kind: "hours" },
      });
    }

    for (const slot of availability.filter((s) => s.dayOfWeek === dow)) {
      const colorIdx = doctorColorIndex.get(slot.doctorId) ?? 0;
      const color = DOCTOR_COLORS(colorIdx);
      events.push({
        id: `avail-${slot.id}-${dateKey}`,
        title: doctorName(slot.doctorId),
        start: `${dateKey}T${slot.startTime}:00`,
        end: `${dateKey}T${slot.endTime}:00`,
        backgroundColor: color,
        borderColor: color,
        textColor: "#ffffff",
        editable: false,
        extendedProps: {
          kind: "coverage",
          doctorId: slot.doctorId,
          slotId: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      });
    }
  }

  for (const block of blocks) {
    const start = new Date(block.startsAt);
    const end = new Date(block.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (end < rangeStart || start > rangeEnd) continue;
    const scope = block.doctorId ? doctorName(block.doctorId) : "Whole clinic";
    events.push({
      id: `block-${block.id}`,
      title: block.reason?.trim()
        ? `Closed · ${block.reason.trim()}`
        : `Closed · ${scope}`,
      start: block.startsAt,
      end: block.endsAt,
      backgroundColor: "#9ca3af",
      borderColor: "#6b7280",
      textColor: "#ffffff",
      editable: false,
      extendedProps: {
        kind: "block",
        doctorId: block.doctorId,
        reason: block.reason,
        startTime: format(start, "HH:mm"),
        endTime: format(end, "HH:mm"),
      },
    });
  }

  return events;
}

export function weekContaining(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 0 }),
    end: endOfWeek(date, { weekStartsOn: 0 }),
  };
}
