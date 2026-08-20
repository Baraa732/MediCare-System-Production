import { TOTAL_SLOTS, ROW_MINUTES } from "@/features/dashboardAssitant/data/scheduleGrid";
import type { DoctorType, AppointmentType } from "@/features/dashboardAssitant/types";
import { clinicNowGridMinutes } from "@/features/dashboardAssitant/utils/editModeDrag";

/** Practical shift steps secretaries actually use (minutes). */
export const LOGICAL_SHIFT_INTERVALS = [15, 30, 45, 60, 90, 120] as const;

/**
 * Checks if a given time range conflicts with any existing appointment for a specific doctor
 */
export function hasSchedulingConflict(
  start: number,
  end: number,
  docId: string,
  allDoctors: DoctorType[],
  excludeAptId?: string,
): boolean {
  const doctor = allDoctors.find((d) => d.id === docId);
  if (!doctor) return false;

  const appointments = doctor.appointments || [];
  return appointments.some((apt) => {
    if (excludeAptId && apt.id === excludeAptId) return false;
    return Math.max(start, apt.start) < Math.min(end, apt.end);
  });
}

/**
 * Filters and returns doctors eligible for appointment transfer
 */
export function getAvailableDoctorsForTransfer(
  apt: AppointmentType,
  allDoctors: DoctorType[],
): DoctorType[] {
  return allDoctors.filter((doctor) => {
    if (doctor.id === apt.docId) return false;
    return !hasSchedulingConflict(apt.start, apt.end, doctor.id, allDoctors, apt.id);
  });
}

function isStartInPast(start: number, selectedDate?: Date): boolean {
  if (!selectedDate) return false;
  return start < clinicNowGridMinutes(selectedDate);
}

/**
 * Logical earlier shifts that land on a free, not-past slot.
 */
export function getValidEarlierIntervals(
  apt: AppointmentType,
  allDoctors: DoctorType[],
  selectedDate?: Date,
): number[] {
  const duration = apt.end - apt.start;
  return LOGICAL_SHIFT_INTERVALS.filter((mins) => {
    const newStart = apt.start - mins;
    const newEnd = newStart + duration;
    if (newStart < 0) return false;
    if (isStartInPast(newStart, selectedDate)) return false;
    return !hasSchedulingConflict(newStart, newEnd, apt.docId, allDoctors, apt.id);
  });
}

/**
 * Logical later shifts that land on a free, not-past slot within the grid.
 */
export function getValidLaterIntervals(
  apt: AppointmentType,
  allDoctors: DoctorType[],
  selectedDate?: Date,
): number[] {
  const duration = apt.end - apt.start;
  const maxGridMinutes = TOTAL_SLOTS * ROW_MINUTES;
  return LOGICAL_SHIFT_INTERVALS.filter((mins) => {
    const newStart = apt.start + mins;
    const newEnd = newStart + duration;
    if (newEnd > maxGridMinutes) return false;
    if (isStartInPast(newStart, selectedDate)) return false;
    return !hasSchedulingConflict(newStart, newEnd, apt.docId, allDoctors, apt.id);
  });
}
