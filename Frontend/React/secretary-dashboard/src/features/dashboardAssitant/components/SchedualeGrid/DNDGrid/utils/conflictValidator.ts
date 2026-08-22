import { TOTAL_SLOTS, ROW_MINUTES } from "@/features/dashboardAssitant/data/scheduleGrid";
import type { DoctorType, AppointmentType } from "@/features/dashboardAssitant/types";
import { clinicNowGridMinutes } from "@/features/dashboardAssitant/utils/editModeDrag";
import {
  isGridRangeOutsideClinicHours,
} from "@/features/dashboardAssitant/utils/clinicHours";
import { clinicDateKey } from "@/lib/time/clinicTime";
import { gridMinutesFromIso } from "@/lib/time/gridTime";
import type { ClinicHoursDay, ScheduleBlock } from "@/lib/api/schedule";

/** Practical shift steps secretaries actually use (minutes). */
export const LOGICAL_SHIFT_INTERVALS = [15, 30, 45, 60, 90, 120] as const;

export interface FreeInterval {
  start: number;
  end: number;
}

export interface SlotConstraintOptions {
  selectedDate?: Date;
  clinicHours?: ClinicHoursDay[] | null;
  scheduleBlocks?: ScheduleBlock[] | null;
  /** Appointment ids to ignore when testing occupancy. */
  ignoreIds?: Set<string>;
}

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
 * True when [gridStart, gridEnd) overlaps a schedule block for this doctor
 * (or a clinic-wide block with null doctorId) on the selected clinic day.
 */
export function isGridRangeBlockedBySchedule(
  gridStart: number,
  gridEnd: number,
  doctorId: string,
  selectedDate?: Date,
  blocks?: ScheduleBlock[] | null,
): boolean {
  if (!selectedDate || !blocks?.length) return false;
  const dayKey = clinicDateKey(selectedDate);

  for (const block of blocks) {
    if (block.doctorId && block.doctorId !== doctorId) continue;
    const blockDay = clinicDateKey(new Date(block.startsAt));
    if (blockDay !== dayKey) continue;
    const blockStart = gridMinutesFromIso(block.startsAt);
    const blockEnd = gridMinutesFromIso(block.endsAt);
    if (!Number.isFinite(blockStart) || !Number.isFinite(blockEnd)) continue;
    if (Math.max(gridStart, blockStart) < Math.min(gridEnd, blockEnd)) {
      return true;
    }
  }
  return false;
}

/** Combined hard constraints for placing a range on a doctor column. */
export function isRangeUnavailable(
  start: number,
  end: number,
  docId: string,
  allDoctors: DoctorType[],
  options: SlotConstraintOptions = {},
  excludeAptId?: string,
): boolean {
  if (end <= start) return true;
  if (start < 0 || end > TOTAL_SLOTS * ROW_MINUTES) return true;

  if (options.selectedDate) {
    const nowGrid = clinicNowGridMinutes(options.selectedDate);
    if (Number.isFinite(nowGrid) && start < nowGrid) return true;
    if (
      isGridRangeOutsideClinicHours(
        start,
        end,
        options.selectedDate,
        options.clinicHours,
      )
    ) {
      return true;
    }
    if (
      isGridRangeBlockedBySchedule(
        start,
        end,
        docId,
        options.selectedDate,
        options.scheduleBlocks,
      )
    ) {
      return true;
    }
  }

  const ignore = options.ignoreIds;
  const doctor = allDoctors.find((d) => d.id === docId);
  if (!doctor) return true;

  return (doctor.appointments || []).some((apt) => {
    if (excludeAptId && apt.id === excludeAptId) return false;
    if (ignore?.has(apt.id)) return false;
    return Math.max(start, apt.start) < Math.min(end, apt.end);
  });
}

/**
 * Filters and returns doctors eligible for appointment transfer
 */
export function getAvailableDoctorsForTransfer(
  apt: AppointmentType,
  allDoctors: DoctorType[],
  options: SlotConstraintOptions = {},
): DoctorType[] {
  return allDoctors.filter((doctor) => {
    if (doctor.id === apt.docId) return false;
    return !isRangeUnavailable(
      apt.start,
      apt.end,
      doctor.id,
      allDoctors,
      options,
      apt.id,
    );
  });
}

function isStartInPast(start: number, selectedDate?: Date): boolean {
  if (!selectedDate) return false;
  return start < clinicNowGridMinutes(selectedDate);
}

/**
 * Occupied intervals on a doctor after removing ignore ids (sorted).
 */
export function getOccupiedIntervals(
  docId: string,
  allDoctors: DoctorType[],
  ignoreIds?: Set<string>,
): FreeInterval[] {
  const doctor = allDoctors.find((d) => d.id === docId);
  if (!doctor) return [];
  return (doctor.appointments || [])
    .filter((a) => !ignoreIds?.has(a.id))
    .map((a) => ({ start: a.start, end: a.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Free gaps on the 15-min grid for a doctor within [windowStart, windowEnd).
 * Also subtracts schedule blocks and past time / clinic hours via caller window.
 */
export function findFreeIntervals(
  docId: string,
  allDoctors: DoctorType[],
  windowStart: number,
  windowEnd: number,
  ignoreIds?: Set<string>,
  selectedDate?: Date,
  scheduleBlocks?: ScheduleBlock[] | null,
): FreeInterval[] {
  const maxGrid = TOTAL_SLOTS * ROW_MINUTES;
  let lo = Math.max(0, windowStart);
  let hi = Math.min(maxGrid, windowEnd);
  if (selectedDate) {
    const nowGrid = clinicNowGridMinutes(selectedDate);
    if (Number.isFinite(nowGrid)) lo = Math.max(lo, nowGrid);
  }
  if (hi <= lo) return [];

  const occupied = getOccupiedIntervals(docId, allDoctors, ignoreIds);

  // Merge schedule blocks for this day into occupied.
  if (selectedDate && scheduleBlocks?.length) {
    const dayKey = clinicDateKey(selectedDate);
    for (const block of scheduleBlocks) {
      const status = (block.status ?? "APPROVED").toUpperCase();
      if (status !== "APPROVED") continue;
      if (block.doctorId && block.doctorId !== docId) continue;
      if (clinicDateKey(new Date(block.startsAt)) !== dayKey) continue;
      const bs = gridMinutesFromIso(block.startsAt);
      const be = gridMinutesFromIso(block.endsAt);
      if (Number.isFinite(bs) && Number.isFinite(be) && be > bs) {
        occupied.push({ start: bs, end: be });
      }
    }
    occupied.sort((a, b) => a.start - b.start || a.end - b.end);
  }

  const merged: FreeInterval[] = [];
  for (const seg of occupied) {
    if (merged.length === 0) {
      merged.push({ ...seg });
      continue;
    }
    const last = merged[merged.length - 1];
    if (seg.start <= last.end) {
      last.end = Math.max(last.end, seg.end);
    } else {
      merged.push({ ...seg });
    }
  }

  const free: FreeInterval[] = [];
  let cursor = lo;
  for (const seg of merged) {
    if (seg.end <= lo) continue;
    if (seg.start >= hi) break;
    const gapStart = cursor;
    const gapEnd = Math.min(hi, Math.max(lo, seg.start));
    if (gapEnd - gapStart >= ROW_MINUTES) {
      free.push({ start: gapStart, end: gapEnd });
    }
    cursor = Math.max(cursor, seg.end);
  }
  if (hi - cursor >= ROW_MINUTES) {
    free.push({ start: cursor, end: hi });
  }
  return free;
}

/**
 * Latest start time (15-min aligned) for `duration` that fits entirely inside
 * free gaps ending at or before `beforeExclusive`.
 */
export function findLatestEarlierStart(
  duration: number,
  docId: string,
  allDoctors: DoctorType[],
  beforeExclusive: number,
  options: SlotConstraintOptions = {},
  excludeAptId?: string,
): number | null {
  const dur = Math.max(duration, ROW_MINUTES);
  const ignore = new Set(options.ignoreIds ?? []);
  if (excludeAptId) ignore.add(excludeAptId);

  const free = findFreeIntervals(
    docId,
    allDoctors,
    0,
    beforeExclusive,
    ignore,
    options.selectedDate,
    options.scheduleBlocks,
  );

  let best: number | null = null;
  for (const gap of free) {
    const latestStart = gap.end - dur;
    if (latestStart < gap.start) continue;
    // Snap to 15-min grid
    let start =
      Math.floor(latestStart / ROW_MINUTES) * ROW_MINUTES;
    while (start >= gap.start) {
      const end = start + dur;
      if (
        end <= gap.end &&
        end <= beforeExclusive &&
        !isRangeUnavailable(start, end, docId, allDoctors, {
          ...options,
          ignoreIds: ignore,
        }, excludeAptId)
      ) {
        if (best === null || start > best) best = start;
        break;
      }
      start -= ROW_MINUTES;
    }
  }
  return best;
}

/**
 * Logical earlier shifts that land on a free, not-past, in-hours slot.
 */
export function getValidEarlierIntervals(
  apt: AppointmentType,
  allDoctors: DoctorType[],
  selectedDate?: Date,
  clinicHours?: ClinicHoursDay[] | null,
  scheduleBlocks?: ScheduleBlock[] | null,
): number[] {
  const duration = apt.end - apt.start;
  return LOGICAL_SHIFT_INTERVALS.filter((mins) => {
    const newStart = apt.start - mins;
    const newEnd = newStart + duration;
    if (newStart < 0) return false;
    if (isStartInPast(newStart, selectedDate)) return false;
    return !isRangeUnavailable(
      newStart,
      newEnd,
      apt.docId,
      allDoctors,
      { selectedDate, clinicHours, scheduleBlocks },
      apt.id,
    );
  });
}

/**
 * Logical later shifts that land on a free, not-past slot within the grid.
 */
export function getValidLaterIntervals(
  apt: AppointmentType,
  allDoctors: DoctorType[],
  selectedDate?: Date,
  clinicHours?: ClinicHoursDay[] | null,
  scheduleBlocks?: ScheduleBlock[] | null,
): number[] {
  const duration = apt.end - apt.start;
  const maxGridMinutes = TOTAL_SLOTS * ROW_MINUTES;
  return LOGICAL_SHIFT_INTERVALS.filter((mins) => {
    const newStart = apt.start + mins;
    const newEnd = newStart + duration;
    if (newEnd > maxGridMinutes) return false;
    if (isStartInPast(newStart, selectedDate)) return false;
    return !isRangeUnavailable(
      newStart,
      newEnd,
      apt.docId,
      allDoctors,
      { selectedDate, clinicHours, scheduleBlocks },
      apt.id,
    );
  });
}
