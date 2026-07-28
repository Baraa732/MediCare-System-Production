import type { ApiAppointment, ClinicDoctor } from "./types";
import type { ColumnAppointmentsType } from "@/features/dashboardAssitant/types";
import type { DoctorType } from "@/features/dashboardAssitant/types";
import { START_TIME_MINUTES } from "@/features/dashboardAssitant/data/scheduleGrid";

const STATUS_MAP: Record<string, string> = {
  CONFIRMED: "confirmed",
  REQUESTED: "pending_request",
  COMPLETED: "done",
  NO_SHOW: "no-show",
  CANCELLED: "cancelled",
};

function minutesFromGridStart(scheduledAt: string): number {
  const date = new Date(scheduledAt);
  const absoluteMinutes = date.getHours() * 60 + date.getMinutes();
  return Math.max(0, absoluteMinutes - START_TIME_MINUTES);
}

export function mapAppointmentToGrid(
  appointment: ApiAppointment,
  patientLabel?: string,
): ColumnAppointmentsType {
  const start = minutesFromGridStart(appointment.scheduledAt);
  const end = start + appointment.durationMinutes;
  const title =
    patientLabel ??
    appointment.reason ??
    `Patient ${appointment.patientId.slice(0, 8)}`;

  return {
    id: appointment.id,
    docId: appointment.doctorId,
    title,
    start,
    end,
    status: STATUS_MAP[appointment.status] ?? appointment.status.toLowerCase(),
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
