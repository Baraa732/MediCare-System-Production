
import { TOTAL_SLOTS, ROW_MINUTES } from "@/features/dashboardAssitant/data/scheduleGrid";
import type { DoctorType, AppointmentType } from "@/features/dashboardAssitant/types";

/**
 * Checks if a given time range conflicts with any existing appointment for a specific doctor
 */
export function hasSchedulingConflict(
  start: number,
  end: number,
  docId: string,
  allDoctors: DoctorType[],
  excludeAptId?: string
): boolean {
  const doctor = allDoctors.find((d) => d.id === docId);
  if (!doctor) return false;

  const appointments = doctor.appointments || [];
  return appointments.some((apt) => {
    if (excludeAptId && apt.id === excludeAptId) return false;
    // 1-minute precision conflict rule: Max(Start1, Start2) < Min(End1, End2)
    return Math.max(start, apt.start) < Math.min(end, apt.end);
  });
}

/**
 * Filters and returns doctors eligible for appointment transfer
 */
export function getAvailableDoctorsForTransfer(
  apt: AppointmentType,
  allDoctors: DoctorType[]
): DoctorType[] {
  return allDoctors.filter((doctor) => {
    // 1. Exclude the patient's currently responsible doctor
    if (doctor.id === apt.docId) return false;

    // 2. Exclude doctors who have a time conflict
    const conflicts = hasSchedulingConflict(apt.start, apt.end, doctor.id, allDoctors, apt.id);
    return !conflicts;
  });
}

/**
 * Calculates valid intervals (multiples of 15 mins) for moving an appointment earlier
 */
export function getValidEarlierIntervals(
  apt: AppointmentType,
  allDoctors: DoctorType[]
): number[] {
  const intervals: number[] = [];
  const currentDuration = apt.end - apt.start;
  let currentInterval = 15;

  while (apt.start - currentInterval >= 0) {
    const newStart = apt.start - currentInterval;
    const newEnd = newStart + currentDuration;

    // Validate against conflicts and doctor schedule validity
    if (!hasSchedulingConflict(newStart, newEnd, apt.docId, allDoctors, apt.id)) {
      intervals.push(currentInterval);
    }
    currentInterval += 15;
  }

  return intervals;
}

/**
 * Calculates valid intervals (multiples of 15 mins) for moving an appointment later
 */
export function getValidLaterIntervals(
  apt: AppointmentType,
  allDoctors: DoctorType[]
): number[] {
  const intervals: number[] = [];
  const currentDuration = apt.end - apt.start;
  const maxGridMinutes = TOTAL_SLOTS * ROW_MINUTES;
  let currentInterval = 15;

  while (apt.start + currentInterval + currentDuration <= maxGridMinutes) {
    const newStart = apt.start + currentInterval;
    const newEnd = newStart + currentDuration;

    if (!hasSchedulingConflict(newStart, newEnd, apt.docId, allDoctors, apt.id)) {
      intervals.push(currentInterval);
    }
    currentInterval += 15;
  }

  return intervals;
}   