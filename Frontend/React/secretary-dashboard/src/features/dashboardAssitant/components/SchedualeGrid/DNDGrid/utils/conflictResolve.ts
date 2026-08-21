import { TOTAL_SLOTS, ROW_MINUTES } from "@/features/dashboardAssitant/data/scheduleGrid";
import type { DoctorType, AppointmentType } from "@/features/dashboardAssitant/types";
import { clinicNowGridMinutes } from "@/features/dashboardAssitant/utils/editModeDrag";
import { hasSchedulingConflict } from "./conflictValidator";

const MAX_GRID_MINUTES = TOTAL_SLOTS * ROW_MINUTES;
const SAFETY_BUFFER_MINUTES = 15;

export type ConflictResolutionAction =
  | "None"
  | "Shifted Down"
  | "Shifted Down Chain"
  | "Transferred Doctor"
  | "Prompt User Selection";

export interface MultiResolutionResult {
  status: "Resolved" | "Requires Manual Action";
  action: ConflictResolutionAction;
  message: string;
  /** Existing appointments that should be rewritten (shifted / transferred). */
  updatedExistingAppointments: AppointmentType[];
  /** Existing appointments that can only be cleared with explicit secretary confirmation. */
  proposedCancelIds?: string[];
}

export interface ResolveConflictOptions {
  /** Clinic schedule day — used for the 15-minute safety buffer. */
  selectedDate?: Date;
  /** Prefer doctors with the same specialty when transferring. */
  preferSameSpecialty?: boolean;
}

function patientLabel(apt: AppointmentType): string {
  return apt.patient?.name || apt.title?.split(" - ")[0] || "Patient";
}

/**
 * Safety gate: never auto-move an existing appointment that is urgent
 * or starts within the next 15 minutes on the selected clinic day.
 */
function isExistAptRestrictedFromMoving(
  existApt: AppointmentType,
  selectedDate?: Date,
): { isManual: boolean; reason: string } {
  const isCriticalCase =
    existApt.status === "urgent" ||
    existApt.status === "URGENT" ||
    existApt.complexity === "urgent";

  if (isCriticalCase) {
    return {
      isManual: true,
      reason: `Existing appointment (${patientLabel(existApt)}) is marked urgent`,
    };
  }

  if (selectedDate) {
    const nowGrid = clinicNowGridMinutes(selectedDate);
    const isWithinBuffer =
      existApt.start >= nowGrid &&
      existApt.start - nowGrid <= SAFETY_BUFFER_MINUTES;
    if (isWithinBuffer) {
      return {
        isManual: true,
        reason: `Existing appointment (${patientLabel(existApt)}) starts within ${SAFETY_BUFFER_MINUTES} minutes`,
      };
    }
  }

  return { isManual: false, reason: "" };
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

/**
 * Expand direct overlaps into a contiguous congestion chain so cascading
 * shift-downs account for appointments packed tightly after the drop.
 */
export function expandConflictChain(
  draggedApt: AppointmentType,
  doctorAppointments: AppointmentType[],
): AppointmentType[] {
  const direct = doctorAppointments.filter((apt) =>
    rangesOverlap(draggedApt.start, draggedApt.end, apt.start, apt.end),
  );
  if (direct.length === 0) return [];

  const chainIds = new Set(direct.map((a) => a.id));
  let windowEnd = Math.max(draggedApt.end, ...direct.map((a) => a.end));
  let changed = true;

  while (changed) {
    changed = false;
    for (const apt of doctorAppointments) {
      if (chainIds.has(apt.id)) continue;
      if (rangesOverlap(draggedApt.start, windowEnd, apt.start, apt.end)) {
        chainIds.add(apt.id);
        windowEnd = Math.max(windowEnd, apt.end);
        changed = true;
      }
    }
  }

  return doctorAppointments
    .filter((a) => chainIds.has(a.id))
    .sort((a, b) => a.start - b.start);
}

function findTransferDoctor(
  apt: AppointmentType,
  allDoctors: DoctorType[],
  excludeDoctorId: string,
  preferSameSpecialty: boolean,
): DoctorType | undefined {
  const candidates = allDoctors.filter(
    (doc) =>
      doc.id !== excludeDoctorId &&
      !hasSchedulingConflict(apt.start, apt.end, doc.id, allDoctors, apt.id),
  );
  if (candidates.length === 0) return undefined;

  if (preferSameSpecialty) {
    const source = allDoctors.find((d) => d.id === apt.docId);
    const same = candidates.find(
      (d) => source?.specialty && d.specialty === source.specialty,
    );
    if (same) return same;
  }
  return candidates[0];
}

function handleSingleConflict(
  draggedApt: AppointmentType,
  aptA: AppointmentType,
  doctorAppointments: AppointmentType[],
  allDoctors: DoctorType[],
  preferSameSpecialty: boolean,
): MultiResolutionResult | null {
  const shiftedStart = draggedApt.end;
  const durationA = aptA.end - aptA.start;
  const shiftedEnd = shiftedStart + durationA;

  const nextApt = doctorAppointments.find(
    (a) => a.start >= aptA.end && a.id !== aptA.id,
  );
  const hasOverlapWithNext = nextApt ? shiftedEnd > nextApt.start : false;

  if (!hasOverlapWithNext && shiftedEnd <= MAX_GRID_MINUTES) {
    return {
      status: "Resolved",
      action: "Shifted Down",
      message: `Moved ${patientLabel(aptA)} down to free the slot.`,
      updatedExistingAppointments: [
        { ...aptA, start: shiftedStart, end: shiftedEnd },
      ],
    };
  }

  if (aptA.refuseTransfer !== true) {
    const alternativeDoctor = findTransferDoctor(
      aptA,
      allDoctors,
      aptA.docId,
      preferSameSpecialty,
    );
    if (alternativeDoctor) {
      return {
        status: "Resolved",
        action: "Transferred Doctor",
        message: `Moved ${patientLabel(aptA)} to ${alternativeDoctor.name}.`,
        updatedExistingAppointments: [{ ...aptA, docId: alternativeDoctor.id }],
      };
    }
  }

  if (aptA.refuseTransfer === true) {
    return {
      status: "Requires Manual Action",
      action: "Prompt User Selection",
      message: `${patientLabel(aptA)} cannot be transferred automatically. Confirm cancel or pick another slot.`,
      updatedExistingAppointments: [],
      proposedCancelIds: [aptA.id],
    };
  }

  return null;
}

function handleMultiConflict(
  draggedApt: AppointmentType,
  affectedChain: AppointmentType[],
  doctorAppointments: AppointmentType[],
  allDoctors: DoctorType[],
  targetDoctorId: string,
  preferSameSpecialty: boolean,
): MultiResolutionResult {
  const updatedExistingAppointments: AppointmentType[] = [];
  const remainingUnresolvedApts: AppointmentType[] = [];

  for (const apt of affectedChain) {
    if (apt.refuseTransfer !== true) {
      const alternativeDoctor = findTransferDoctor(
        apt,
        allDoctors,
        targetDoctorId,
        preferSameSpecialty,
      );
      if (alternativeDoctor) {
        updatedExistingAppointments.push({
          ...apt,
          docId: alternativeDoctor.id,
        });
        continue;
      }
    }
    remainingUnresolvedApts.push(apt);
  }

  if (remainingUnresolvedApts.length > 0) {
    let nextAvailableStart = draggedApt.end;
    const shiftedSubChain: AppointmentType[] = [];
    let canShiftAllRemaining = true;

    for (const apt of remainingUnresolvedApts) {
      const duration = apt.end - apt.start;
      const shiftedEnd = nextAvailableStart + duration;

      if (shiftedEnd > MAX_GRID_MINUTES) {
        canShiftAllRemaining = false;
        break;
      }

      const hasExternalConflict = doctorAppointments.some((otherApt) => {
        if (affectedChain.some((a) => a.id === otherApt.id)) return false;
        if (updatedExistingAppointments.some((a) => a.id === otherApt.id)) {
          return false;
        }
        return rangesOverlap(
          nextAvailableStart,
          shiftedEnd,
          otherApt.start,
          otherApt.end,
        );
      });

      if (hasExternalConflict) {
        canShiftAllRemaining = false;
        break;
      }

      shiftedSubChain.push({
        ...apt,
        start: nextAvailableStart,
        end: shiftedEnd,
      });
      nextAvailableStart = shiftedEnd;
    }

    if (canShiftAllRemaining) {
      updatedExistingAppointments.push(...shiftedSubChain);
      remainingUnresolvedApts.length = 0;
    }
  }

  if (remainingUnresolvedApts.length > 0) {
    const proposedCancelIds = remainingUnresolvedApts
      .filter((apt) => apt.refuseTransfer === true)
      .map((apt) => apt.id);
    const stillBlocked = remainingUnresolvedApts.filter(
      (apt) => apt.refuseTransfer !== true,
    );

    if (stillBlocked.length > 0) {
      return {
        status: "Requires Manual Action",
        action: "Prompt User Selection",
        message:
          "Multiple overlapping visits cannot be auto-resolved. Choose another slot or resolve manually.",
        updatedExistingAppointments: [],
        proposedCancelIds:
          proposedCancelIds.length > 0 ? proposedCancelIds : undefined,
      };
    }

    return {
      status: "Requires Manual Action",
      action: "Prompt User Selection",
      message:
        "Conflicting visits refuse transfer. Confirm cancellation to free the slot, or pick another time.",
      updatedExistingAppointments,
      proposedCancelIds,
    };
  }

  return {
    status: "Resolved",
    action: "Shifted Down Chain",
    message: `Resolved cascade: updated ${updatedExistingAppointments.length} existing appointment${updatedExistingAppointments.length === 1 ? "" : "s"}.`,
    updatedExistingAppointments,
  };
}

/**
 * Main entry: resolve DnD drop conflicts against existing appointments.
 * Never silently deletes — cancellations are proposed for secretary confirmation.
 */
export function resolveAppointmentConflict(
  draggedApt: AppointmentType,
  allDoctors: DoctorType[],
  options: ResolveConflictOptions = {},
): MultiResolutionResult {
  const preferSameSpecialty = options.preferSameSpecialty !== false;
  const targetDoctor = allDoctors.find((d) => d.id === draggedApt.docId);

  if (!targetDoctor) {
    return {
      status: "Requires Manual Action",
      action: "Prompt User Selection",
      message: "Target doctor was not found on the schedule.",
      updatedExistingAppointments: [],
    };
  }

  const doctorAppointments = [...(targetDoctor.appointments || [])]
    .filter((a) => a.id !== draggedApt.id)
    .sort((a, b) => a.start - b.start);

  const affectedChain = expandConflictChain(draggedApt, doctorAppointments);

  if (affectedChain.length === 0) {
    return {
      status: "Resolved",
      action: "None",
      message: "No conflict detected.",
      updatedExistingAppointments: [],
    };
  }

  for (const existApt of affectedChain) {
    const manualCheck = isExistAptRestrictedFromMoving(
      existApt,
      options.selectedDate,
    );
    if (manualCheck.isManual) {
      return {
        status: "Requires Manual Action",
        action: "Prompt User Selection",
        message: `Safety lock: ${manualCheck.reason}. Manual routing required.`,
        updatedExistingAppointments: [],
      };
    }
  }

  if (affectedChain.length === 1) {
    const singleResult = handleSingleConflict(
      draggedApt,
      affectedChain[0],
      doctorAppointments,
      allDoctors,
      preferSameSpecialty,
    );
    if (singleResult) return singleResult;
  }

  return handleMultiConflict(
    draggedApt,
    affectedChain,
    doctorAppointments,
    allDoctors,
    targetDoctor.id,
    preferSameSpecialty,
  );
}
