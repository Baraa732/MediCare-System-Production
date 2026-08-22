import type { ApiAppointment, ClinicDoctor } from "./types";
import type { ColumnAppointmentsType } from "@/features/dashboardAssitant/types";
import type { DoctorType } from "@/features/dashboardAssitant/types";
import type { PendingRequest } from "@/features/dashboardAssitant/types/PendingRequest";
import { doctorImageSrc } from "@/lib/defaultMedia";
import {
  gridMinutesFromIso,
  scheduledAtFromAbsoluteMinutes,
  scheduledAtFromGridMinutes,
} from "@/lib/time/gridTime";

export { scheduledAtFromAbsoluteMinutes, scheduledAtFromGridMinutes };

const STATUS_MAP: Record<string, string> = {
  CONFIRMED: "confirmed",
  REQUESTED: "pending_request",
  COMPLETED: "done",
  NO_SHOW: "no-show",
  CANCELLED: "cancelled",
};

function safeDuration(minutes: number | undefined | null): number {
  if (!Number.isFinite(minutes) || !minutes || minutes <= 0) return 30;
  return Math.min(240, Math.max(5, minutes));
}

function minutesFromGridStart(scheduledAt: string): number {
  return gridMinutesFromIso(scheduledAt);
}

function parseNotesMetadata(notes?: string | null): Record<string, unknown> {
  if (!notes?.trim()) return {};
  const trimmed = notes.trim();
  if (!trimmed.startsWith("{")) return {};
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Human-readable note text (strips embedded Medicare metadata JSON when present). */
export function displayNotesFromStored(notes?: string | null): string | undefined {
  if (!notes?.trim()) return undefined;
  const meta = parseNotesMetadata(notes);
  if (typeof meta.text === "string") return meta.text || undefined;
  if (notes.trim().startsWith("{")) return undefined;
  return notes;
}

/**
 * Persist the human note. Metadata is only embedded when it is not the
 * default (standard / unlocked) so the field never shows JSON for empty notes.
 */
export function encodeAppointmentNotes(
  userNotes: string | undefined | null,
  meta: {
    complexity?: string | null;
    refuseTransfer?: boolean | null;
  } = {},
): string | undefined {
  const text = userNotes?.trim() ?? "";
  const complexity = meta.complexity?.trim().toLowerCase() || undefined;
  const nonDefaultComplexity =
    complexity && complexity !== "standard" ? complexity : undefined;
  const locked = meta.refuseTransfer === true;
  if (!nonDefaultComplexity && !locked) return text || undefined;
  return JSON.stringify({
    text,
    ...(nonDefaultComplexity ? { complexity: nonDefaultComplexity } : {}),
    ...(locked ? { refuseTransfer: true } : {}),
  });
}

function resolveComplexity(
  appointment: ApiAppointment & { complexity?: string | null },
): string | undefined {
  const meta = {
    ...parseNotesMetadata(appointment.notes),
    ...(appointment.metadata ?? {}),
  };
  const raw =
    appointment.complexity ??
    (typeof meta.complexity === "string" ? meta.complexity : undefined);
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  if (
    normalized === "standard" ||
    normalized === "complex" ||
    normalized === "elderly" ||
    normalized === "urgent"
  ) {
    return normalized;
  }
  return undefined;
}

function resolveRefuseTransfer(
  appointment: ApiAppointment & {
    refuseTransfer?: boolean | null;
    lockedToDoctor?: boolean | null;
  },
): boolean | undefined {
  if (typeof appointment.refuseTransfer === "boolean") {
    return appointment.refuseTransfer;
  }
  if (typeof appointment.lockedToDoctor === "boolean") {
    return appointment.lockedToDoctor;
  }
  const meta = {
    ...parseNotesMetadata(appointment.notes),
    ...(appointment.metadata ?? {}),
  };
  if (typeof meta.refuseTransfer === "boolean") return meta.refuseTransfer;
  if (typeof meta.lockedToDoctor === "boolean") return meta.lockedToDoctor;
  if (typeof meta.isLockedToDoctor === "boolean") return meta.isLockedToDoctor;
  return undefined;
}

export function mapAppointmentToGrid(
  appointment: ApiAppointment & {
    patientName?: string | null;
    patientPhone?: string | null;
  },
  patientLabel?: string,
): ColumnAppointmentsType {
  const duration = safeDuration(appointment.durationMinutes);
  const start = minutesFromGridStart(appointment.scheduledAt);
  const title =
    patientLabel ??
    appointment.patientName?.trim() ??
    appointment.reason ??
    appointment.guestPatientName ??
    (appointment.patientId ? `Patient ${appointment.patientId.slice(0, 8)}` : "Guest patient");

  const complexity = resolveComplexity(appointment);
  const refuseTransfer = resolveRefuseTransfer(appointment);
  const displayNotes = displayNotesFromStored(appointment.notes);

  return {
    id: appointment.id,
    docId: appointment.doctorId,
    title,
    start,
    end: start + duration,
    status: STATUS_MAP[appointment.status] ?? appointment.status.toLowerCase(),
    date: new Date(appointment.scheduledAt),
    duration,
    notes: displayNotes,
    ...(complexity
      ? { complexity: complexity as ColumnAppointmentsType["complexity"] }
      : {}),
    ...(typeof refuseTransfer === "boolean" ? { refuseTransfer } : {}),
    patient: {
      name: title,
      age: 0,
      phone: appointment.patientPhone ?? appointment.guestPatientPhone ?? "",
      gender: null,
      adddress: "",
    },
  };
}

export function mapDoctorToGrid(
  doctor: ClinicDoctor,
  _appointmentCount: number,
): DoctorType {
  const name =
    doctor.fullName?.trim() ||
    `${doctor.firstName ?? ""} ${doctor.lastName ?? ""}`.trim() ||
    "Doctor";
  return {
    id: doctor.userId,
    name,
    specialty: doctor.specialization ?? "General Dentistry",
    avatar: doctorImageSrc(
      (doctor as { avatarUrl?: string }).avatarUrl,
    ),
    appointments: [],
  };
}

export function dayRangeIso(date = new Date()) {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function mapApiAppointmentToPendingRequest(
  appointment: ApiAppointment & {
    patientName?: string;
    patientPhone?: string;
    doctorName?: string;
  },
): PendingRequest {
  const scheduledDate = new Date(appointment.scheduledAt);
  const duration = safeDuration(appointment.durationMinutes);
  const start = Number.isNaN(scheduledDate.getTime())
    ? 0
    : gridMinutesFromIso(appointment.scheduledAt);
  const minutesAgo = Number.isNaN(scheduledDate.getTime())
    ? 0
    : Math.max(0, Math.floor((Date.now() - scheduledDate.getTime()) / 60_000));
  const patientName =
    appointment.patientName?.trim() ||
    appointment.guestPatientName?.trim() ||
    appointment.reason ||
    (appointment.patientId
      ? `Patient ${appointment.patientId.slice(0, 8)}`
      : "Guest patient");

  return {
    id: appointment.id,
    docId: appointment.doctorId,
    title: appointment.reason ?? "Patient appointment request",
    scheduledAt: appointment.scheduledAt,
    start,
    end: start + duration,
    status: "pending_request",
    date: Number.isNaN(scheduledDate.getTime()) ? new Date() : scheduledDate,
    treatmentId: "patient-request",
    complexity: "standard",
    duration,
    price: 0,
    notes: displayNotesFromStored(appointment.notes),
    patient: {
      name: patientName,
      age: 0,
      phone: appointment.patientPhone ?? appointment.guestPatientPhone ?? "",
      gender: null,
      adddress: "",
    },
    refuseTransfer: false,
    timeRequistAgo: minutesAgo,
  };
}
