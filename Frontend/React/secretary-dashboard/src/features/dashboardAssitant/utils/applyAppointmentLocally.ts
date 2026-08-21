import type { ApiAppointment, EnrichedAppointment, ClinicDoctor } from "@/lib/api/types";
import {
  mapAppointmentToGrid,
  mapApiAppointmentToPendingRequest,
  mapDoctorToGrid,
} from "@/lib/api/mappers";
import type { DoctorWithAppointments } from "@/features/dashboardAssitant/types/DoctorWithAppointments";
import { useScheduleGridStore } from "@/features/dashboardAssitant/hooks/scheduleGridStore";
import { usePendingRequest } from "@/features/dashboardAssitant/hooks/usePendingRequest";
import { clinicDateKey } from "@/lib/time/clinicTime";

/** Merge appointment into doctor columns for the visible day. */
export function mergeAppointmentIntoDoctors(
  doctors: DoctorWithAppointments[],
  appointment: ApiAppointment | EnrichedAppointment,
  selectedDate: Date,
): DoctorWithAppointments[] {
  const onVisibleDay =
    clinicDateKey(appointment.scheduledAt) === clinicDateKey(selectedDate);

  if (appointment.status === "CANCELLED" || !onVisibleDay) {
    return doctors.map((doc) => ({
      ...doc,
      appointments: doc.appointments.filter((a) => a.id !== appointment.id),
    }));
  }

  const gridApt = mapAppointmentToGrid(appointment);

  return doctors.map((doc) => {
    const without = doc.appointments.filter((a) => a.id !== appointment.id);
    if (doc.id !== appointment.doctorId) {
      return { ...doc, appointments: without };
    }
    return {
      ...doc,
      appointments: [...without, gridApt].sort((a, b) => a.start - b.start),
    };
  });
}

export function rebuildDoctorsWithAppointments(
  clinicDoctors: ClinicDoctor[],
  appointments: ApiAppointment[],
): DoctorWithAppointments[] {
  const active = appointments.filter((a) => a.status !== "CANCELLED");
  return clinicDoctors.map((doctor) => {
    const doctorAppointments = active
      .filter((a) => a.doctorId === doctor.userId)
      .map((a) => mapAppointmentToGrid(a));
    return {
      ...mapDoctorToGrid(doctor, doctorAppointments.length),
      appointments: doctorAppointments,
    };
  });
}

/** Instantly patch grid store + pending sidebar from an appointment snapshot. */
export function applyAppointmentSnapshotLocally(
  appointment: ApiAppointment | EnrichedAppointment,
  selectedDate: Date,
) {
  const store = useScheduleGridStore.getState();
  store.setDoctors(
    mergeAppointmentIntoDoctors(store.doctors, appointment, selectedDate),
  );

  const pending = usePendingRequest.getState();
  if (appointment.status === "REQUESTED") {
    const mapped = mapApiAppointmentToPendingRequest(appointment);
    const others = pending.requests.filter((r) => r.id !== appointment.id);
    pending.setRequests([mapped, ...others]);
  } else {
    pending.onRemovePendingRequest(appointment.id);
  }
}
