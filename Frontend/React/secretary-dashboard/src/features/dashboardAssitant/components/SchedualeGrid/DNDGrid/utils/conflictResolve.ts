import { ROW_MINUTES } from "@/features/dashboardAssitant/data/scheduleGrid";
import type { DoctorType, AppointmentType } from "@/features/dashboardAssitant/types";
import { clinicNowGridMinutes } from "@/features/dashboardAssitant/utils/editModeDrag";
import { normalizeAppointmentStatus } from "@/features/dashboardAssitant/utils/appointmentStatusStyles";
import {
  findLatestEarlierStart,
  isRangeUnavailable,
} from "./conflictValidator";
import type { ClinicHoursDay, ScheduleBlock } from "@/lib/api/schedule";

const SAFETY_BUFFER_MINUTES = 15;

export type ConflictResolutionAction =
  | "None"
  | "Shifted Down"
  | "Shifted Down Chain"
  | "Shifted Earlier"
  | "Transferred Doctor"
  | "Hybrid"
  | "Prompt User Selection"
  | "Cancel Place";

export type ResolutionStepKind =
  | "shift"
  | "shift_earlier"
  | "shift_later"
  | "transfer"
  | "cancel"
  | "place";

export type ResolutionStrategy =
  | "push_earlier"
  | "push_later"
  | "transfer"
  | "hybrid"
  | "cancel_place";

export interface ResolutionStep {
  kind: ResolutionStepKind;
  appointmentId: string;
  patientName: string;
  detail: string;
  fromStart: number;
  fromEnd: number;
  toStart: number;
  toEnd: number;
  fromDocId: string;
  toDocId: string;
  fromDoctorName?: string;
  toDoctorName?: string;
  lockReason?: string;
}

export interface ResolutionPlan {
  id: string;
  strategy: ResolutionStrategy;
  rankScore: number;
  title: string;
  summary: string;
  status: "Resolved" | "Requires Manual Action";
  action: ConflictResolutionAction;
  updatedExistingAppointments: AppointmentType[];
  proposedCancelIds?: string[];
  steps: ResolutionStep[];
}

/** @deprecated Prefer ResolutionPlan — kept for transitional callers. */
export interface MultiResolutionResult {
  status: "Resolved" | "Requires Manual Action";
  action: ConflictResolutionAction;
  message: string;
  updatedExistingAppointments: AppointmentType[];
  proposedCancelIds?: string[];
  steps?: ResolutionStep[];
  plans?: ResolutionPlan[];
  recommendedPlanId?: string | null;
  lockMessages?: string[];
}

export interface ResolveConflictOptions {
  selectedDate?: Date;
  preferSameSpecialty?: boolean;
  clinicHours?: ClinicHoursDay[] | null;
  scheduleBlocks?: ScheduleBlock[] | null;
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

function applyPlacedToBoard(
  allDoctors: DoctorType[],
  placed: AppointmentType[],
): DoctorType[] {
  let next = allDoctors;
  for (const apt of placed) {
    const ban = new Set([apt.id]);
    next = boardWithoutIds(next, ban);
    next = next.map((doc) =>
      doc.id === apt.docId
        ? { ...doc, appointments: [...(doc.appointments || []), apt] }
        : doc,
    );
  }
  return next;
}

function slotOptions(options: ResolveConflictOptions, ignoreIds?: Set<string>) {
  return {
    selectedDate: options.selectedDate,
    clinicHours: options.clinicHours,
    scheduleBlocks: options.scheduleBlocks,
    ignoreIds,
  };
}

function canPlace(
  apt: AppointmentType,
  start: number,
  end: number,
  docId: string,
  allDoctors: DoctorType[],
  ignoreIds: Set<string>,
  options: ResolveConflictOptions,
): boolean {
  return !isRangeUnavailable(
    start,
    end,
    docId,
    allDoctors,
    slotOptions(options, ignoreIds),
    apt.id,
  );
}

function findTransferDoctor(
  apt: AppointmentType,
  allDoctors: DoctorType[],
  excludeDoctorIds: string[],
  preferSameSpecialty: boolean,
  options: ResolveConflictOptions,
): DoctorType | undefined {
  const banned = new Set(excludeDoctorIds);
  const candidates = allDoctors.filter(
    (doc) =>
      !banned.has(doc.id) &&
      canPlace(
        apt,
        apt.start,
        apt.end,
        doc.id,
        allDoctors,
        new Set([apt.id]),
        options,
      ),
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

function tryShiftLaterChain(
  draggedApt: AppointmentType,
  chain: AppointmentType[],
  allDoctors: DoctorType[],
  options: ResolveConflictOptions,
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
      !canPlace(
        apt,
        shiftedStart,
        shiftedEnd,
        draggedApt.docId,
        allDoctors,
        ignore,
        options,
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

/**
 * Pack conflicting visits into free gaps entirely before the drop window.
 * Rightmost-first into latest earlier slots (minimize total shift when possible).
 */
function tryPushEarlierChain(
  draggedApt: AppointmentType,
  chain: AppointmentType[],
  allDoctors: DoctorType[],
  options: ResolveConflictOptions,
): AppointmentType[] | null {
  const ignoreBase = new Set<string>([
    draggedApt.id,
    ...chain.map((a) => a.id),
  ]);
  // Board without chain + with dragged occupying the drop slot.
  let board = boardWithoutIds(allDoctors, ignoreBase);
  board = applyPlacedToBoard(board, [draggedApt]);

  const sorted = [...chain].sort((a, b) => b.start - a.start);
  const placed: AppointmentType[] = [];

  for (const apt of sorted) {
    const duration = Math.max(apt.end - apt.start, ROW_MINUTES);
    const ignore = new Set(ignoreBase);
    for (const p of placed) ignore.add(p.id);

    const start = findLatestEarlierStart(
      duration,
      draggedApt.docId,
      board,
      draggedApt.start,
      slotOptions(options, ignore),
      apt.id,
    );
    if (start === null) return null;

    const updated: AppointmentType = {
      ...apt,
      start,
      end: start + duration,
      docId: draggedApt.docId,
    };
    placed.push(updated);
    board = applyPlacedToBoard(board, [updated]);
  }

  return placed;
}

function makeStep(
  kind: ResolutionStepKind,
  apt: AppointmentType,
  to: AppointmentType,
  detail: string,
  doctorNames?: { from?: string; to?: string },
): ResolutionStep {
  return {
    kind,
    appointmentId: apt.id,
    patientName: patientLabel(apt),
    detail,
    fromStart: apt.start,
    fromEnd: apt.end,
    toStart: to.start,
    toEnd: to.end,
    fromDocId: apt.docId,
    toDocId: to.docId,
    fromDoctorName: doctorNames?.from,
    toDoctorName: doctorNames?.to,
  };
}

function scorePlan(
  strategy: ResolutionStrategy,
  originals: AppointmentType[],
  updated: AppointmentType[],
  cancelCount: number,
): number {
  const byId = new Map(originals.map((a) => [a.id, a]));
  let minutesMoved = 0;
  let transfers = 0;
  for (const u of updated) {
    const o = byId.get(u.id);
    if (!o) continue;
    minutesMoved += Math.abs(u.start - o.start);
    if (u.docId !== o.docId) transfers += 1;
  }
  let score =
    minutesMoved + transfers * 100 + cancelCount * 1000;
  // Prefer earlier packing and same-doctor when scores are close.
  if (strategy === "push_earlier") score -= 5;
  if (strategy === "push_later") score -= 2;
  if (strategy === "transfer") score += 1;
  if (strategy === "cancel_place") score += 50;
  return score;
}

function planFromUpdates(
  id: string,
  strategy: ResolutionStrategy,
  title: string,
  summary: string,
  action: ConflictResolutionAction,
  chain: AppointmentType[],
  updated: AppointmentType[],
  steps: ResolutionStep[],
  cancelIds?: string[],
): ResolutionPlan {
  return {
    id,
    strategy,
    rankScore: scorePlan(strategy, chain, updated, cancelIds?.length ?? 0),
    title,
    summary,
    status: "Resolved",
    action,
    updatedExistingAppointments: updated,
    proposedCancelIds: cancelIds,
    steps,
  };
}

function buildTransferPlan(
  draggedApt: AppointmentType,
  chain: AppointmentType[],
  allDoctors: DoctorType[],
  preferSameSpecialty: boolean,
  options: ResolveConflictOptions,
): ResolutionPlan | null {
  const transferable = chain.filter((a) => a.refuseTransfer !== true);
  if (transferable.length !== chain.length) return null;

  const transfers: AppointmentType[] = [];
  const steps: ResolutionStep[] = [];
  let board = allDoctors;

  for (const apt of chain) {
    const alt = findTransferDoctor(
      apt,
      applyTransfersToBoard(board, transfers),
      [draggedApt.docId, apt.docId],
      preferSameSpecialty,
      options,
    );
    if (!alt) return null;
    const updated = { ...apt, docId: alt.id };
    transfers.push(updated);
    const fromDoc = allDoctors.find((d) => d.id === apt.docId);
    steps.push(
      makeStep(
        "transfer",
        apt,
        updated,
        `Transfer to ${alt.name}`,
        { from: fromDoc?.name, to: alt.name },
      ),
    );
  }

  return planFromUpdates(
    "transfer",
    "transfer",
    "Transfer overlapping visits",
    `Move ${transfers.length} visit${transfers.length === 1 ? "" : "s"} to other doctor${transfers.length === 1 ? "" : "s"} at the same time.`,
    "Transferred Doctor",
    chain,
    transfers,
    steps,
  );
}

function buildHybridPlan(
  draggedApt: AppointmentType,
  chain: AppointmentType[],
  allDoctors: DoctorType[],
  preferSameSpecialty: boolean,
  options: ResolveConflictOptions,
): ResolutionPlan | null {
  const transfers: AppointmentType[] = [];
  const transferSteps: ResolutionStep[] = [];
  const remaining: AppointmentType[] = [];

  for (const apt of chain) {
    if (apt.refuseTransfer === true) {
      remaining.push(apt);
      continue;
    }
    const alt = findTransferDoctor(
      apt,
      applyTransfersToBoard(allDoctors, transfers),
      [draggedApt.docId],
      preferSameSpecialty,
      options,
    );
    if (alt) {
      const updated = { ...apt, docId: alt.id };
      transfers.push(updated);
      const fromDoc = allDoctors.find((d) => d.id === apt.docId);
      transferSteps.push(
        makeStep(
          "transfer",
          apt,
          updated,
          `Transfer to ${alt.name}`,
          { from: fromDoc?.name, to: alt.name },
        ),
      );
    } else {
      remaining.push(apt);
    }
  }

  if (transfers.length === 0 || remaining.length === 0) return null;

  const boardAfter = applyTransfersToBoard(allDoctors, transfers);
  const earlier = tryPushEarlierChain(
    draggedApt,
    remaining,
    boardAfter,
    options,
  );
  if (earlier) {
    const steps = [
      ...transferSteps,
      ...earlier.map((u) => {
        const o = remaining.find((r) => r.id === u.id)!;
        return makeStep(
          "shift_earlier",
          o,
          u,
          `Push earlier to free the drop`,
        );
      }),
    ];
    return planFromUpdates(
      "hybrid_earlier",
      "hybrid",
      "Transfer some + push others earlier",
      `Transfer ${transfers.length}, push ${earlier.length} earlier.`,
      "Hybrid",
      chain,
      [...transfers, ...earlier],
      steps,
    );
  }

  const later = tryShiftLaterChain(
    draggedApt,
    remaining,
    boardAfter,
    options,
  );
  if (later) {
    const steps = [
      ...transferSteps,
      ...later.map((u) => {
        const o = remaining.find((r) => r.id === u.id)!;
        return makeStep(
          "shift_later",
          o,
          u,
          `Push later after your drop`,
        );
      }),
    ];
    return planFromUpdates(
      "hybrid_later",
      "hybrid",
      "Transfer some + push others later",
      `Transfer ${transfers.length}, push ${later.length} later.`,
      "Hybrid",
      chain,
      [...transfers, ...later],
      steps,
    );
  }

  return null;
}

function buildCancelPlan(chain: AppointmentType[]): ResolutionPlan {
  const steps: ResolutionStep[] = chain.map((apt) => ({
    kind: "cancel" as const,
    appointmentId: apt.id,
    patientName: patientLabel(apt),
    detail: "Cancel this visit to free the slot",
    fromStart: apt.start,
    fromEnd: apt.end,
    toStart: apt.start,
    toEnd: apt.end,
    fromDocId: apt.docId,
    toDocId: apt.docId,
  }));

  return {
    id: "cancel_place",
    strategy: "cancel_place",
    rankScore: scorePlan("cancel_place", chain, [], chain.length),
    title: `Cancel ${chain.length} overlapping visit${chain.length === 1 ? "" : "s"}`,
    summary:
      "Place yours and mark conflicts cancelled. Patients are notified when you Save.",
    status: "Requires Manual Action",
    action: "Cancel Place",
    updatedExistingAppointments: [],
    proposedCancelIds: chain.map((a) => a.id),
    steps,
  };
}

export interface ConflictPlansResult {
  plans: ResolutionPlan[];
  recommendedPlanId: string | null;
  lockMessages: string[];
  affectedChain: AppointmentType[];
}

/**
 * Build ranked atomic resolution plans. Secretary must pick one — nothing auto-applies.
 */
export function buildConflictResolutionPlans(
  draggedApt: AppointmentType,
  allDoctors: DoctorType[],
  options: ResolveConflictOptions = {},
): ConflictPlansResult {
  const preferSameSpecialty = options.preferSameSpecialty !== false;
  const targetDoctor = allDoctors.find((d) => d.id === draggedApt.docId);
  const empty: ConflictPlansResult = {
    plans: [],
    recommendedPlanId: null,
    lockMessages: [],
    affectedChain: [],
  };

  if (!targetDoctor || draggedApt.end <= draggedApt.start) {
    return empty;
  }

  const doctorAppointments = [...(targetDoctor.appointments || [])]
    .filter((a) => a.id !== draggedApt.id && !isTerminalAppointment(a))
    .sort((a, b) => a.start - b.start);

  const affectedChain = expandConflictChain(draggedApt, doctorAppointments);
  if (affectedChain.length === 0) {
    return empty;
  }

  const lockMessages: string[] = [];
  let hardLocked = false;
  for (const existApt of affectedChain) {
    const manualCheck = isExistAptRestrictedFromMoving(
      existApt,
      options.selectedDate,
    );
    if (manualCheck.isManual) {
      lockMessages.push(manualCheck.reason);
      hardLocked = true;
    }
  }

  const plans: ResolutionPlan[] = [];

  if (!hardLocked) {
    const earlier = tryPushEarlierChain(
      draggedApt,
      affectedChain,
      allDoctors,
      options,
    );
    if (earlier) {
      plans.push(
        planFromUpdates(
          "push_earlier",
          "push_earlier",
          "Push overlapping visits earlier",
          `Use free slot${earlier.length === 1 ? "" : "s"} before your drop to free the time.`,
          "Shifted Earlier",
          affectedChain,
          earlier,
          earlier.map((u) => {
            const o = affectedChain.find((c) => c.id === u.id)!;
            return makeStep(
              "shift_earlier",
              o,
              u,
              "Push earlier into a free gap",
            );
          }),
        ),
      );
    }

    const later = tryShiftLaterChain(
      draggedApt,
      affectedChain,
      allDoctors,
      options,
    );
    if (later) {
      plans.push(
        planFromUpdates(
          "push_later",
          "push_later",
          "Push overlapping visits later",
          `Shift ${later.length} visit${later.length === 1 ? "" : "s"} to start after your drop.`,
          later.length > 1 ? "Shifted Down Chain" : "Shifted Down",
          affectedChain,
          later,
          later.map((u) => {
            const o = affectedChain.find((c) => c.id === u.id)!;
            return makeStep(
              "shift_later",
              o,
              u,
              "Push later after your drop",
            );
          }),
        ),
      );
    }

    const transfer = buildTransferPlan(
      draggedApt,
      affectedChain,
      allDoctors,
      preferSameSpecialty,
      options,
    );
    if (transfer) plans.push(transfer);

    const hybrid = buildHybridPlan(
      draggedApt,
      affectedChain,
      allDoctors,
      preferSameSpecialty,
      options,
    );
    if (hybrid) plans.push(hybrid);
  }

  // Cancel is always available when there are overlaps (secretary choice).
  plans.push(buildCancelPlan(affectedChain));

  plans.sort((a, b) => a.rankScore - b.rankScore);

  const recommended =
    plans.find((p) => p.strategy !== "cancel_place" && p.status === "Resolved")
      ?.id ?? plans[0]?.id ?? null;

  return {
    plans,
    recommendedPlanId: recommended,
    lockMessages,
    affectedChain,
  };
}

/**
 * Resolve DnD drop conflicts. Returns recommended plan + full plans list.
 * Plans are atomic; cancellations need secretary confirmation.
 */
export function resolveAppointmentConflict(
  draggedApt: AppointmentType,
  allDoctors: DoctorType[],
  options: ResolveConflictOptions = {},
): MultiResolutionResult {
  const result = buildConflictResolutionPlans(draggedApt, allDoctors, options);

  if (result.affectedChain.length === 0) {
    return {
      status: "Resolved",
      action: "None",
      message: "No conflict detected.",
      updatedExistingAppointments: [],
      plans: [],
      recommendedPlanId: null,
      lockMessages: [],
    };
  }

  const recommended =
    result.plans.find((p) => p.id === result.recommendedPlanId) ??
    result.plans[0];

  if (!recommended) {
    return {
      status: "Requires Manual Action",
      action: "Prompt User Selection",
      message: "No resolution plan available.",
      updatedExistingAppointments: [],
      plans: [],
      recommendedPlanId: null,
      lockMessages: result.lockMessages,
    };
  }

  const message =
    result.lockMessages.length > 0
      ? `Safety lock: ${result.lockMessages[0]}. Choose cancel or another slot.`
      : recommended.summary;

  return {
    status: recommended.status,
    action: recommended.action,
    message,
    updatedExistingAppointments: recommended.updatedExistingAppointments,
    proposedCancelIds: recommended.proposedCancelIds,
    steps: recommended.steps,
    plans: result.plans,
    recommendedPlanId: result.recommendedPlanId,
    lockMessages: result.lockMessages,
  };
}
