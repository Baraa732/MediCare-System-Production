import { START_TIME_MINUTES } from "../data/scheduleGrid";
import type { AppointmentType, DoctorType, PendingRequest } from "../types";
import type { ComplexityType } from "../CreateAppointmentWizard/useAppointmentWizard";
import {
  type AppointmentDisplayStatus,
  resolveDisplayStatus,
} from "./appointmentStatusStyles";

export type TimeOfDayFilter = "any" | "morning" | "afternoon" | "evening";
export type NotesFilter = "any" | "with" | "without";
export type GenderFilter = "any" | "Male" | "Female";

export interface ScheduleFilters {
  query: string;
  statuses: AppointmentDisplayStatus[];
  doctorIds: string[];
  timeOfDay: TimeOfDayFilter;
  gender: GenderFilter;
  notes: NotesFilter;
  complexities: ComplexityType[];
  /** When true, hide doctor columns with zero matching appointments (unless doctor name matches query). */
  hideEmptyDoctors: boolean;
}

export const DEFAULT_SCHEDULE_FILTERS: ScheduleFilters = {
  query: "",
  statuses: [],
  doctorIds: [],
  timeOfDay: "any",
  gender: "any",
  notes: "any",
  complexities: [],
  hideEmptyDoctors: true,
};

export const FILTER_STATUS_OPTIONS: {
  key: AppointmentDisplayStatus;
  label: string;
  swatch: string;
}[] = [
  { key: "confirmed", label: "Confirmed", swatch: "bg-blue-500" },
  { key: "in_progress", label: "In progress", swatch: "bg-purple-500" },
  { key: "late", label: "Late", swatch: "bg-rose-500" },
  { key: "done", label: "Done", swatch: "bg-emerald-500" },
  { key: "pending_request", label: "Pending", swatch: "bg-orange-500" },
  { key: "no-show", label: "No-show", swatch: "bg-red-600" },
  { key: "cancelled", label: "Cancelled", swatch: "bg-neutral-400" },
];

export const TIME_OF_DAY_OPTIONS: {
  key: TimeOfDayFilter;
  label: string;
  hint: string;
}[] = [
  { key: "any", label: "Any time", hint: "Full day" },
  { key: "morning", label: "Morning", hint: "8–12" },
  { key: "afternoon", label: "Afternoon", hint: "12–5" },
  { key: "evening", label: "Evening", hint: "5+" },
];

function hay(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function absoluteFromGrid(start: number) {
  return START_TIME_MINUTES + start;
}

function matchesTimeOfDay(startGrid: number, timeOfDay: TimeOfDayFilter) {
  if (timeOfDay === "any") return true;
  const abs = absoluteFromGrid(startGrid);
  if (timeOfDay === "morning") return abs < 12 * 60;
  if (timeOfDay === "afternoon") return abs >= 12 * 60 && abs < 17 * 60;
  return abs >= 17 * 60;
}

export function isScheduleFiltersActive(filters: ScheduleFilters): boolean {
  return countActiveScheduleFilters(filters) > 0 || filters.query.trim().length > 0;
}

/** Counts structured filters only (not free-text query). */
export function countActiveScheduleFilters(filters: ScheduleFilters): number {
  let n = 0;
  if (filters.statuses.length) n += 1;
  if (filters.doctorIds.length) n += 1;
  if (filters.timeOfDay !== "any") n += 1;
  if (filters.gender !== "any") n += 1;
  if (filters.notes !== "any") n += 1;
  if (filters.complexities.length) n += 1;
  if (!filters.hideEmptyDoctors) n += 1;
  return n;
}

export function appointmentMatchesFilters(
  apt: AppointmentType,
  doctor: Pick<DoctorType, "id" | "name" | "specialty">,
  filters: ScheduleFilters,
  ctx: { nowGridMinutes: number; selectedDate: Date },
): boolean {
  const q = filters.query.trim().toLowerCase();
  if (q) {
    const blob = hay(
      apt.title,
      apt.notes,
      apt.status,
      apt.patient?.name,
      apt.patient?.phone,
      apt.patient?.gender ?? undefined,
      apt.complexity,
      doctor.name,
      doctor.specialty,
    );
    if (!blob.includes(q)) return false;
  }

  if (filters.doctorIds.length && !filters.doctorIds.includes(doctor.id)) {
    return false;
  }

  if (filters.statuses.length) {
    const display = resolveDisplayStatus(apt.status, {
      startMinutes: apt.start,
      endMinutes: apt.end,
      nowMinutes: ctx.nowGridMinutes,
      scheduledDate: ctx.selectedDate,
      referenceDate: new Date(),
    });
    if (!filters.statuses.includes(display)) return false;
  }

  if (!matchesTimeOfDay(apt.start, filters.timeOfDay)) return false;

  if (filters.gender !== "any") {
    if (apt.patient?.gender !== filters.gender) return false;
  }

  if (filters.notes === "with" && !(apt.notes ?? "").trim()) return false;
  if (filters.notes === "without" && (apt.notes ?? "").trim()) return false;

  if (filters.complexities.length) {
    const c = (apt.complexity ?? "standard") as ComplexityType;
    if (!filters.complexities.includes(c)) return false;
  }

  return true;
}

export function filterDoctorsByScheduleFilters(
  source: DoctorType[],
  filters: ScheduleFilters,
  ctx: { nowGridMinutes: number; selectedDate: Date },
): DoctorType[] {
  const q = filters.query.trim().toLowerCase();
  const hasStructured = countActiveScheduleFilters(filters) > 0;
  if (!q && !hasStructured) return source;

  return source
    .map((doc) => {
      const appointments = doc.appointments.filter((apt) =>
        appointmentMatchesFilters(apt, doc, filters, ctx),
      );
      return { ...doc, appointments };
    })
    .filter((doc) => {
      if (doc.appointments.length > 0) return true;
      if (!filters.hideEmptyDoctors) {
        // Keep column if doctor is explicitly selected or name matches query
        if (filters.doctorIds.includes(doc.id)) return true;
        if (q && hay(doc.name, doc.specialty).includes(q)) return true;
        return !hasStructured && !q ? true : false;
      }
      // hide empty: keep doctor column only if query matches doctor itself
      if (q && hay(doc.name, doc.specialty).includes(q) && !hasStructured) {
        return true;
      }
      if (
        q &&
        hay(doc.name, doc.specialty).includes(q) &&
        filters.doctorIds.length === 0 &&
        filters.statuses.length === 0
      ) {
        return true;
      }
      return false;
    });
}

export function pendingRequestMatchesFilters(
  req: PendingRequest,
  doctors: DoctorType[],
  filters: ScheduleFilters,
): boolean {
  const doctor =
    doctors.find((d) => d.id === req.docId) ??
    ({ id: req.docId, name: "", specialty: "" } as DoctorType);

  // Pending items always map to pending_request for status filter purposes
  const pendingAsApt: AppointmentType = {
    ...req,
    status: "REQUESTED",
  };

  const q = filters.query.trim().toLowerCase();
  if (q) {
    const blob = hay(
      req.title,
      req.notes,
      req.patient?.name,
      req.patient?.phone,
      doctor.name,
    );
    if (!blob.includes(q)) return false;
  }

  if (filters.doctorIds.length && !filters.doctorIds.includes(req.docId)) {
    return false;
  }

  if (filters.statuses.length && !filters.statuses.includes("pending_request")) {
    // If user filtered to statuses that exclude pending, hide pending list matches
    // unless they're also searching broadly with only text
    if (countActiveScheduleFilters(filters) > 0) return false;
  }

  if (filters.gender !== "any" && req.patient?.gender !== filters.gender) {
    return false;
  }

  if (filters.notes === "with" && !(req.notes ?? "").trim()) return false;
  if (filters.notes === "without" && (req.notes ?? "").trim()) return false;

  if (filters.complexities.length) {
    const c = (req.complexity ?? "standard") as ComplexityType;
    if (!filters.complexities.includes(c)) return false;
  }

  if (!matchesTimeOfDay(req.start, filters.timeOfDay)) return false;

  // Re-use appointment matcher for consistency on remaining fields
  return appointmentMatchesFilters(pendingAsApt, doctor, {
    ...filters,
    // status already handled for pending
    statuses: [],
    query: "",
  }, { nowGridMinutes: Number.NEGATIVE_INFINITY, selectedDate: new Date() });
}

export type FilterPresetId =
  | "late"
  | "in_progress"
  | "pending"
  | "with_notes"
  | "morning"
  | "afternoon"
  | "done";

export const FILTER_PRESETS: {
  id: FilterPresetId;
  label: string;
  description: string;
  apply: (prev: ScheduleFilters) => ScheduleFilters;
}[] = [
  {
    id: "late",
    label: "Late now",
    description: "Overdue confirmed slots",
    apply: (prev) => ({ ...prev, statuses: ["late"] }),
  },
  {
    id: "in_progress",
    label: "In progress",
    description: "Active visits",
    apply: (prev) => ({ ...prev, statuses: ["in_progress"] }),
  },
  {
    id: "pending",
    label: "Pending requests",
    description: "Awaiting confirmation",
    apply: (prev) => ({ ...prev, statuses: ["pending_request"] }),
  },
  {
    id: "with_notes",
    label: "Has notes",
    description: "Grid notes only",
    apply: (prev) => ({ ...prev, notes: "with" }),
  },
  {
    id: "morning",
    label: "Morning",
    description: "Before noon",
    apply: (prev) => ({ ...prev, timeOfDay: "morning" }),
  },
  {
    id: "afternoon",
    label: "Afternoon",
    description: "12–5 PM",
    apply: (prev) => ({ ...prev, timeOfDay: "afternoon" }),
  },
  {
    id: "done",
    label: "Completed",
    description: "Checked-in / done",
    apply: (prev) => ({ ...prev, statuses: ["done"] }),
  },
];
