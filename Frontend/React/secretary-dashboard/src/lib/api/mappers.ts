import type { ApiAppointment, ClinicDoctor } from "./types";
import type { ColumnAppointmentsType } from "@/features/dashboardAssitant/types";
import type { DoctorType } from "@/features/dashboardAssitant/types";
import type { PendingRequest } from "@/features/dashboardAssitant/types/PendingRequest";
import { START_TIME_MINUTES } from "@/features/dashboardAssitant/data/scheduleGrid";

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
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return 0;
  const absoluteMinutes = date.getHours() * 60 + date.getMinutes();
  return Math.max(0, absoluteMinutes - START_TIME_MINUTES);
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

  return {
    id: appointment.id,
    docId: appointment.doctorId,
    title,
    start,
    end: start + duration,
    status: STATUS_MAP[appointment.status] ?? appointment.status.toLowerCase(),
    date: new Date(appointment.scheduledAt),
    duration,
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
  return {
    id: doctor.userId,
    name: (doctor.fullName ?? `${doctor.firstName ?? ""} ${doctor.lastName ?? ""}`.trim()) || "Doctor",
    specialty: doctor.specialization ?? "General Dentistry",
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(doctor.fullName ?? doctor.userId)}`,
    appointments: [],
  };
}

export function scheduledAtFromGridMinutes(
  minutesSinceStart: number,
  referenceDate = new Date(),
): string {
  const totalMinutes = START_TIME_MINUTES + minutesSinceStart;
  const date = new Date(referenceDate);
  date.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return date.toISOString();
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
    ? START_TIME_MINUTES
    : scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
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
    start,
    end: start + duration,
    status: "pending_request",
    date: Number.isNaN(scheduledDate.getTime()) ? new Date() : scheduledDate,
    treatmentId: "patient-request",
    complexity: "standard",
    duration,
    price: 0,
    notes: appointment.notes,
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
