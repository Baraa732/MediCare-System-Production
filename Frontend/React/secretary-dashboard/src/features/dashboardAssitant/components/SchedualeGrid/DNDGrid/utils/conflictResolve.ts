import { TOTAL_SLOTS, ROW_MINUTES } from "@/features/dashboardAssitant/data/scheduleGrid";
import type { DoctorType, AppointmentType } from "@/features/dashboardAssitant/types";
import { clinicNowGridMinutes } from "@/features/dashboardAssitant/utils/editModeDrag";
import { normalizeAppointmentStatus } from "@/features/dashboardAssitant/utils/appointmentStatusStyles";
import { hasSchedulingConflict } from "./conflictValidator";

const MAX_GRID_MINUTES = TOTAL_SLOTS * ROW_MINUTES;
const SAFETY_BUFFER_MINUTES = 15;

export type ConflictResolutionAction =
  | "None"
  | "Shifted Down"
  | "Shifted Down Chain"
  | "Transferred Doctor"
  | "Prompt User Selection";

export type ResolutionStepKind = "shift" | "transfer" | "cancel";

export interface ResolutionStep {
  kind: ResolutionStepKind;
  appointmentId: string;
  patientName: string;
  detail: string;
}

export interface MultiResolutionResult {
  status: "Resolved" | "Requires Manual Action";
  action: ConflictResolutionAction;
  message: string;
  updatedExistingAppointments: AppointmentType[];
  proposedCancelIds?: string[];
  steps?: ResolutionStep[];
}

export interface ResolveConflictOptions {
  selectedDate?: Date;
  preferSameSpecialty?: boolean;
}

function patientLabel(apt: AppointmentType): string {
  return apt.patient?.name || apt.title?.split(" - ")[0]?.trim() || "Patient";
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

function isUrgentAppointment(apt: AppointmentType): boolean {
  if (apt.complexity === "urgent") return true;
  const raw = (apt.status || "").toLowerCase();
  return raw === "urgent" || raw === "critical";
}

function isTerminalAppointment(apt: AppointmentType): boolean {
  const display = normalizeAppointmentStatus(apt.status);
  return (
    display === "cancelled" ||
    display === "done" ||
    display === "no-show" ||
    display === "unavailable"
  );
}

function isExistAptRestrictedFromMoving(
  existApt: AppointmentType,
  selectedDate?: Date,
): { isManual: boolean; reason: string } {
  if (isUrgentAppointment(existApt)) {
    return {
      isManual: true,
      reason: `${patientLabel(existApt)} is marked urgent`,
    };
  }

  if (selectedDate) {
    const nowGrid = clinicNowGridMinutes(selectedDate);
    if (Number.isFinite(nowGrid)) {
      const isWithinBuffer =
        existApt.start >= nowGrid &&
        existApt.start - nowGrid <= SAFETY_BUFFER_MINUTES;
      if (isWithinBuffer) {
        return {
          isManual: true,
          reason: `${patientLabel(existApt)} starts within ${SAFETY_BUFFER_MINUTES} minutes`,
        };
      }
    }
  }

  return { isManual: false, reason: "" };
}

export function expandConflictChain(
  draggedApt: AppointmentType,
  doctorAppointments: AppointmentType[],
): AppointmentType[] {
  const active = doctorAppointments.filter((a) => !isTerminalAppointment(a));
  const direct = active.filter((apt) =>
    rangesOverlap(draggedApt.start, draggedApt.end, apt.start, apt.end),
  );
  if (direct.length === 0) return [];

  const chainIds = new Set(direct.map((a) => a.id));
  let windowEnd = Math.max(draggedApt.end, ...direct.map((a) => a.end));
  let changed = true;

  while (changed) {
    changed = false;
    for (const apt of active) {
      if (chainIds.has(apt.id)) continue;
      if (rangesOverlap(draggedApt.start, windowEnd, apt.start, apt.end)) {
        chainIds.add(apt.id);
        windowEnd = Math.max(windowEnd, apt.end);
        changed = true;
      }
    }
  }

  return active
    .filter((a) => chainIds.has(a.id))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function boardWithoutIds(
  allDoctors: DoctorType[],
  removeIds: Set<string>,
): DoctorType[] {
  return allDoctors.map((doc) => ({
    ...doc,
    appointments: (doc.appointments || []).filter((a) => !removeIds.has(a.id)),
  }));
}

function applyTransfersToBoard(
  allDoctors: DoctorType[],
  transfers: AppointmentType[],
): DoctorType[] {
  if (transfers.length === 0) return allDoctors;
  const byId = new Map(transfers.map((t) => [t.id, t]));
  return allDoctors.map((doc) => {
    const without = (doc.appointments || []).filter((a) => !byId.has(a.id));
    const incoming = transfers.filter((t) => t.docId === doc.id);
    return { ...doc, appointments: [...without, ...incoming] };
  });
}

function findTransferDoctor(
  apt: AppointmentType,
  allDoctors: DoctorType[],
  excludeDoctorIds: string[],
  preferSameSpecialty: boolean,
): DoctorType | undefined {
  const banned = new Set(excludeDoctorIds);
  const candidates = allDoctors.filter(
    (doc) =>
      !banned.has(doc.id) &&
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

function canShiftAppointment(
  apt: AppointmentType,
  shiftedStart: number,
  shiftedEnd: number,
  targetDoctorId: string,
  allDoctors: DoctorType[],
  ignoreIds: Set<string>,
  selectedDate?: Date,
): boolean {
  if (shiftedEnd > MAX_GRID_MINUTES || shiftedStart < 0) return false;
  if (selectedDate) {
    const nowGrid = clinicNowGridMinutes(selectedDate);
    if (Number.isFinite(nowGrid) && shiftedStart < nowGrid) return false;
  }
  const simulated = boardWithoutIds(allDoctors, ignoreIds);
  return !hasSchedulingConflict(
    shiftedStart,
    shiftedEnd,
    targetDoctorId,
    simulated,
    apt.id,
  );
}

function tryShiftChain(
  draggedApt: AppointmentType,
  chain: AppointmentType[],
  allDoctors: DoctorType[],
  selectedDate?: Date,
): AppointmentType[] | null {
  const sorted = [...chain].sort((a, b) => a.start - b.start);
  let cursor = draggedApt.end;
  const shifted: AppointmentType[] = [];
  const ignore = new Set<string>([draggedApt.id, ...sorted.map((a) => a.id)]);

  for (const apt of sorted) {
    const duration = Math.max(apt.end - apt.start, ROW_MINUTES);
    const shiftedStart = cursor;
    const shiftedEnd = shiftedStart + duration;
    if (
      !canShiftAppointment(
        apt,
        shiftedStart,
        shiftedEnd,
        draggedApt.docId,
        allDoctors,
        ignore,
        selectedDate,
      )
    ) {
      return null;
    }
    shifted.push({
      ...apt,
      start: shiftedStart,
      end: shiftedEnd,
      docId: draggedApt.docId,
    });
    cursor = shiftedEnd;
  }
  return shifted;
}

function handleSingleConflict(
  draggedApt: AppointmentType,
  aptA: AppointmentType,
  allDoctors: DoctorType[],
  preferSameSpecialty: boolean,
  selectedDate?: Date,
): MultiResolutionResult {
  const durationA = Math.max(aptA.end - aptA.start, ROW_MINUTES);
  const shiftedStart = draggedApt.end;
  const shiftedEnd = shiftedStart + durationA;
  const ignore = new Set<string>([draggedApt.id, aptA.id]);

  if (
    canShiftAppointment(
      aptA,
      shiftedStart,
      shiftedEnd,
      draggedApt.docId,
      allDoctors,
      ignore,
      selectedDate,
    )
  ) {
    const updated = {
      ...aptA,
      start: shiftedStart,
      end: shiftedEnd,
      docId: draggedApt.docId,
    };
    return {
      status: "Resolved",
      action: "Shifted Down",
      message: `Moved ${patientLabel(aptA)} later to free the slot.`,
      updatedExistingAppointments: [updated],
      steps: [
        {
          kind: "shift",
          appointmentId: aptA.id,
          patientName: patientLabel(aptA),
          detail: "Shift later to free the dropped time",
        },
      ],
    };
  }

  if (aptA.refuseTransfer !== true) {
    const alternativeDoctor = findTransferDoctor(
      aptA,
      allDoctors,
      [draggedApt.docId, aptA.docId],
      preferSameSpecialty,
    );
    if (alternativeDoctor) {
      return {
        status: "Resolved",
        action: "Transferred Doctor",
        message: `Moved ${patientLabel(aptA)} to ${alternativeDoctor.name}.`,
        updatedExistingAppointments: [{ ...aptA, docId: alternativeDoctor.id }],
        steps: [
          {
            kind: "transfer",
            appointmentId: aptA.id,
            patientName: patientLabel(aptA),
            detail: `Transfer to ${alternativeDoctor.name}`,
          },
        ],
      };
    }
  }

  if (aptA.refuseTransfer === true) {
    return {
      status: "Requires Manual Action",
      action: "Prompt User Selection",
      message: `${patientLabel(aptA)} is locked to this doctor. Confirm cancel to place yours, or pick another slot.`,
      updatedExistingAppointments: [],
      proposedCancelIds: [aptA.id],
      steps: [
        {
          kind: "cancel",
          appointmentId: aptA.id,
          patientName: patientLabel(aptA),
          detail: "Requires confirmed cancellation",
        },
      ],
    };
  }

  return {
    status: "Requires Manual Action",
    action: "Prompt User Selection",
    message:
      "No safe shift or transfer is available. Pick another slot or resolve manually.",
    updatedExistingAppointments: [],
  };
}

function handleMultiConflict(
  draggedApt: AppointmentType,
  affectedChain: AppointmentType[],
  allDoctors: DoctorType[],
  preferSameSpecialty: boolean,
  selectedDate?: Date,
): MultiResolutionResult {
  const fullShift = tryShiftChain(
    draggedApt,
    affectedChain,
    allDoctors,
    selectedDate,
  );
  if (fullShift) {
    return {
      status: "Resolved",
      action: "Shifted Down Chain",
      message: `Shifted ${fullShift.length} overlapping visit${fullShift.length === 1 ? "" : "s"} later.`,
      updatedExistingAppointments: fullShift,
      steps: fullShift.map((apt) => ({
        kind: "shift" as const,
        appointmentId: apt.id,
        patientName: patientLabel(apt),
        detail: "Shift later in cascade",
      })),
    };
  }

  const transfers: AppointmentType[] = [];
  const transferSteps: ResolutionStep[] = [];
  const remaining: AppointmentType[] = [];

  for (const apt of affectedChain) {
    if (apt.refuseTransfer === true) {
      remaining.push(apt);
      continue;
    }

    const alt = findTransferDoctor(
      apt,
      applyTransfersToBoard(allDoctors, transfers),
      [draggedApt.docId],
      preferSameSpecialty,
    );

    if (alt) {
      transfers.push({ ...apt, docId: alt.id });
      transferSteps.push({
        kind: "transfer",
        appointmentId: apt.id,
        patientName: patientLabel(apt),
        detail: `Transfer to ${alt.name}`,
      });
    } else {
      remaining.push(apt);
    }
  }

  if (remaining.length === 0) {
    return {
      status: "Resolved",
      action: "Transferred Doctor",
      message: `Transferred ${transfers.length} overlapping visit${transfers.length === 1 ? "" : "s"}.`,
      updatedExistingAppointments: transfers,
      steps: transferSteps,
    };
  }

  const boardAfterTransfers = applyTransfersToBoard(allDoctors, transfers);
  const shiftedRemaining = tryShiftChain(
    draggedApt,
    remaining,
    boardAfterTransfers,
    selectedDate,
  );

  if (shiftedRemaining) {
    return {
      status: "Resolved",
      action: "Shifted Down Chain",
      message: `Transferred ${transfers.length} and shifted ${shiftedRemaining.length} visit${shiftedRemaining.length === 1 ? "" : "s"}.`,
      updatedExistingAppointments: [...transfers, ...shiftedRemaining],
      steps: [
        ...transferSteps,
        ...shiftedRemaining.map((apt) => ({
          kind: "shift" as const,
          appointmentId: apt.id,
          patientName: patientLabel(apt),
          detail: "Shift later after transfers",
        })),
      ],
    };
  }

  const allRefuse = remaining.every((a) => a.refuseTransfer === true);
  if (allRefuse && remaining.length === affectedChain.length) {
    return {
      status: "Requires Manual Action",
      action: "Prompt User Selection",
      message:
        "Overlapping visits are locked to this doctor. Confirm cancel to place yours, or pick another slot.",
      updatedExistingAppointments: [],
      proposedCancelIds: remaining.map((a) => a.id),
      steps: remaining.map((apt) => ({
        kind: "cancel" as const,
        appointmentId: apt.id,
        patientName: patientLabel(apt),
        detail: "Locked — cancellation confirmation required",
      })),
    };
  }

  return {
    status: "Requires Manual Action",
    action: "Prompt User Selection",
    message:
      "No fully safe auto-fix. Pick another slot, or move conflicting visits manually.",
    updatedExistingAppointments: [],
    steps: affectedChain.map((apt) => ({
      kind: "cancel" as const,
      appointmentId: apt.id,
      patientName: patientLabel(apt),
      detail: "Needs manual routing",
    })),
  };
}

/**
 * Resolve DnD drop conflicts. Plans are atomic: fully resolve, or require manual action.
 * Never silently deletes — cancellations need secretary confirmation.
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

  if (draggedApt.end <= draggedApt.start) {
    return {
      status: "Requires Manual Action",
      action: "Prompt User Selection",
      message: "Invalid appointment duration for this drop.",
      updatedExistingAppointments: [],
    };
  }

  const doctorAppointments = [...(targetDoctor.appointments || [])]
    .filter((a) => a.id !== draggedApt.id && !isTerminalAppointment(a))
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
        steps: [
          {
            kind: "cancel",
            appointmentId: existApt.id,
            patientName: patientLabel(existApt),
            detail: manualCheck.reason,
          },
        ],
      };
    }
  }

  if (affectedChain.length === 1) {
    return handleSingleConflict(
      draggedApt,
      affectedChain[0],
      allDoctors,
      preferSameSpecialty,
      options.selectedDate,
    );
  }

  return handleMultiConflict(
    draggedApt,
    affectedChain,
    allDoctors,
    preferSameSpecialty,
    options.selectedDate,
  );
}
