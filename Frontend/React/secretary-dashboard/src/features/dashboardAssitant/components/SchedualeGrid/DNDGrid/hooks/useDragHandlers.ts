import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SLOT_HEIGHT,
  ROW_MINUTES,
} from "../../../../data/scheduleGrid";
import { useEditeMode } from "../../../../hooks";
import { formatMinutesToTime } from "../utils/timeFormatters";
import type {
  DoctorType,
  DragDataPayload,
  AppointmentType,
  PendingRequest,
} from "@/features/dashboardAssitant/types";
import type {
  OverSlotInfo,
  ToastInfo,
  ActiveDragType,
} from "../types/dragTypes";
import { useGlobalConflictStore } from "@/features/dashboardAssitant/hooks/useGlobalConflictStore";
import { useScheduleContext } from "@/features/dashboardAssitant/context/ScheduleContext";
import {
  isApiAppointmentId,
  useAppointmentActions,
} from "@/features/dashboardAssitant/hooks/useAppointmentActions";
import { normalizeCaughtError } from "@/lib/api/errors";
import { useScheduleGridStore } from "@/features/dashboardAssitant/hooks/scheduleGridStore";
import { hasSchedulingConflict } from "../utils/conflictValidator";
import { resolveAppointmentConflict } from "../utils/conflictResolve";
import { useWizardDrawer } from "@/features/dashboardAssitant/hooks/useWizardDrawer";
import { isGridSlotInPast } from "@/features/dashboardAssitant/utils/editModeDrag";
import { updateAppointmentStatus } from "@/lib/api/appointments";
import { useAuthStore } from "@/stores/authStore";

function patientNameFromTitle(title?: string) {
  if (!title) return "Unknown patient";
  return title.split(" - ")[0]?.trim() || title;
}

function buildConflictItems(
  collisions: AppointmentType[],
  targetStart: number,
  targetEnd: number,
  doctorName: string,
) {
  return collisions.map((c) => ({
    appointmentId: c.id,
    patientName: c.patient?.name || patientNameFromTitle(c.title),
    doctorName,
    start: c.start,
    end: c.end,
    overlapMinutes: Math.max(
      0,
      Math.min(targetEnd, c.end) - Math.max(targetStart, c.start),
    ),
  }));
}

import { filterDoctorsByScheduleFilters } from "@/features/dashboardAssitant/utils/scheduleFilters";
import { clinicNowGridMinutes } from "@/features/dashboardAssitant/utils/editModeDrag";

function cloneDoctors(source: DoctorType[]): DoctorType[] {
  return JSON.parse(JSON.stringify(source)) as DoctorType[];
}

function applyVisibleFilters(
  source: DoctorType[],
  filters: Parameters<typeof filterDoctorsByScheduleFilters>[1],
  selectedDate: Date,
): DoctorType[] {
  return filterDoctorsByScheduleFilters(source, filters, {
    nowGridMinutes: clinicNowGridMinutes(selectedDate),
    selectedDate,
  });
}

function findAppointment(
  doctors: DoctorType[],
  id: string,
): AppointmentType | undefined {
  for (const doc of doctors) {
    const apt = doc.appointments.find((a) => a.id === id);
    if (apt) return apt;
  }
  return undefined;
}

function applyAppointmentToDoctors(
  doctors: DoctorType[],
  updatedApt: AppointmentType,
): DoctorType[] {
  return doctors.map((doc) => {
    const filtered = doc.appointments.filter((a) => a && a.id !== updatedApt.id);
    if (doc.id === updatedApt.docId) {
      filtered.push(updatedApt);
    }
    return { ...doc, appointments: filtered };
  });
}

function removeAppointmentsFromDoctors(
  doctors: DoctorType[],
  removeIds: string[],
): DoctorType[] {
  if (removeIds.length === 0) return doctors;
  const ban = new Set(removeIds);
  return doctors.map((doc) => ({
    ...doc,
    appointments: doc.appointments.filter((a) => !ban.has(a.id)),
  }));
}

function applyResolutionBatch(
  doctors: DoctorType[],
  draggedApt: AppointmentType,
  updatedExisting: AppointmentType[],
  cancelledIds: string[] = [],
): DoctorType[] {
  let next = removeAppointmentsFromDoctors(doctors, cancelledIds);
  for (const apt of updatedExisting) {
    next = applyAppointmentToDoctors(next, apt);
  }
  next = applyAppointmentToDoctors(next, draggedApt);
  return next;
}

function collectDirtyAppointments(
  working: DoctorType[],
  baseline: DoctorType[],
): AppointmentType[] {
  const dirty: AppointmentType[] = [];
  for (const doc of working) {
    for (const apt of doc.appointments) {
      if (!isApiAppointmentId(apt.id)) continue;
      const original = findAppointment(baseline, apt.id);
      if (
        !original ||
        original.docId !== apt.docId ||
        original.start !== apt.start ||
        original.end !== apt.end
      ) {
        dirty.push(apt);
      }
    }
  }
  return dirty;
}

export function useDragHandlers() {
  const { doctors: scheduleDoctors, selectedDate } = useScheduleContext();
  const { persistGridUpdates } = useAppointmentActions();
  const accessToken = useAuthStore((s) => s.accessToken);
  const openWithPendingRequestAtSlot = useWizardDrawer(
    (s) => s.openWithPendingRequestAtSlot,
  );
  const filters = useScheduleGridStore((s) => s.filters);
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const onToggleEdit = useEditeMode((state) => state.onToggleEdit);

  const workingDoctorsRef = useRef<DoctorType[]>([]);
  const cancelledIdsRef = useRef<string[]>([]);
  const [doctors, setDoctors] = useState<DoctorType[]>([]);
  const [baselineDoctors, setBaselineDoctors] = useState<DoctorType[] | null>(
    null,
  );
  const [dirtyCount, setDirtyCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setConflict = useGlobalConflictStore((state) => state.setConflict);
  const setDrawerOpen = useGlobalConflictStore((state) => state.setDrawerOpen);
  const clearConflict = useGlobalConflictStore((state) => state.clearConflict);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<ActiveDragType>(null);
  const [activeData, setActiveData] = useState<DragDataPayload | null>(null);
  const [overSlotInfo, setOverSlotInfo] = useState<OverSlotInfo | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<{
    doctors: DoctorType[];
    cancelledIds: string[];
  } | null>(null);

  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastInfo, setToastInfo] = useState<ToastInfo>({
    patientName: "",
    newTimeLabel: "",
  });

  const refreshDirtyCount = useCallback(
    (working: DoctorType[], baseline: DoctorType[] | null) => {
      if (!baseline) {
        setDirtyCount(0);
        return;
      }
      const moved = collectDirtyAppointments(working, baseline).length;
      setDirtyCount(moved + cancelledIdsRef.current.length);
    },
    [],
  );

  // View mode: follow live schedule. Edit mode: freeze a baseline and edit locally.
  useEffect(() => {
    const source = scheduleDoctors as DoctorType[];
    if (!isEditMode) {
      workingDoctorsRef.current = cloneDoctors(source);
      cancelledIdsRef.current = [];
      setBaselineDoctors(null);
      setDirtyCount(0);
      setSaveError(null);
      setDoctors(applyVisibleFilters(workingDoctorsRef.current, filters, selectedDate));
      return;
    }

    if (!baselineDoctors) {
      const snap = cloneDoctors(source);
      workingDoctorsRef.current = snap;
      cancelledIdsRef.current = [];
      setBaselineDoctors(snap);
      setDirtyCount(0);
      setDoctors(applyVisibleFilters(snap, filters, selectedDate));
      return;
    }

    setDoctors(applyVisibleFilters(workingDoctorsRef.current, filters, selectedDate));
  }, [isEditMode, scheduleDoctors, filters, baselineDoctors, selectedDate]);

  const stageLocalBoard = useCallback(
    (
      nextWorking: DoctorType[],
      toast: { patientName: string; newTimeLabel: string },
      previousCancelledIds?: string[],
    ) => {
      setUndoSnapshot({
        doctors: cloneDoctors(workingDoctorsRef.current),
        cancelledIds: previousCancelledIds ?? [...cancelledIdsRef.current],
      });
      workingDoctorsRef.current = nextWorking;
      setDoctors(applyVisibleFilters(nextWorking, filters, selectedDate));
      refreshDirtyCount(nextWorking, baselineDoctors);
      setToastInfo(toast);
      setIsToastOpen(true);
      setSaveError(null);
      clearConflict();
    },
    [baselineDoctors, refreshDirtyCount, filters, selectedDate, clearConflict],
  );

  const stageLocalMove = useCallback(
    (updatedApt: AppointmentType) => {
      const next = applyAppointmentToDoctors(
        workingDoctorsRef.current,
        updatedApt,
      );
      const titleString = updatedApt.title || "Appointment";
      stageLocalBoard(next, {
        patientName: titleString.split(" - ")[0],
        newTimeLabel: formatMinutesToTime(
          updatedApt.start,
          updatedApt.end - updatedApt.start,
        ),
      });
    },
    [stageLocalBoard],
  );

  const applyConflictResolution = useCallback(
    (
      pendingDrag: AppointmentType,
      resolution: {
        updatedExistingAppointments: AppointmentType[];
        cancelledIds?: string[];
        message: string;
      },
    ) => {
      const previousCancelled = [...cancelledIdsRef.current];
      const cancelledIds = resolution.cancelledIds ?? [];
      if (cancelledIds.length > 0) {
        cancelledIdsRef.current = [
          ...new Set([...cancelledIdsRef.current, ...cancelledIds]),
        ];
      }
      const next = applyResolutionBatch(
        workingDoctorsRef.current,
        pendingDrag,
        resolution.updatedExistingAppointments,
        cancelledIds,
      );
      stageLocalBoard(
        next,
        {
          patientName: patientNameFromTitle(pendingDrag.title),
          newTimeLabel: `${formatMinutesToTime(
            pendingDrag.start,
            pendingDrag.end - pendingDrag.start,
          )} · ${resolution.message}`,
        },
        previousCancelled,
      );
    },
    [stageLocalBoard],
  );

  const updateAppointment = useCallback(
    (updatedApt: AppointmentType) => {
      stageLocalMove(updatedApt);
    },
    [stageLocalMove],
  );

  const getDragDuration = useCallback(
    (type: ActiveDragType, data: DragDataPayload | null) => {
      if (type === "appointment" && data?.appointmentData) {
        return data.appointmentData.end - data.appointmentData.start;
      }
      if (type === "pending_request" && data?.pendingRequestData) {
        const req = data.pendingRequestData;
        return req.end - req.start || req.duration || 30;
      }
      return 0;
    },
    [],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!isEditMode) return;
      const { active } = event;
      const currentData = active.data.current as DragDataPayload | undefined;
      if (!currentData?.type) return;

      setActiveId(active.id as string);
      setActiveType(currentData.type);
      setActiveData(currentData);
      setIsToastOpen(false);
      setConflict(null);
    },
    [isEditMode, setConflict],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (
        !over ||
        !isEditMode ||
        (activeType !== "appointment" && activeType !== "pending_request")
      ) {
        return;
      }

      if (over.data.current?.type !== "slot") return;

      const targetDoctorId = over.data.current.idDoctor as string;
      const targetSlotIdx = over.data.current.slotIdx as number;
      const duration = getDragDuration(activeType, activeData);
      if (duration <= 0) return;

      const targetStart = targetSlotIdx * ROW_MINUTES;
      const targetEnd = targetStart + duration;

      setOverSlotInfo({
        docId: targetDoctorId,
        slotIdx: targetSlotIdx,
        top: targetSlotIdx * SLOT_HEIGHT,
        height: (duration / ROW_MINUTES) * SLOT_HEIGHT,
      });

      const targetDocObj =
        workingDoctorsRef.current.find((d) => d.id === targetDoctorId) ??
        doctors.find((d) => d.id === targetDoctorId);
      if (!targetDocObj) return;

      const excludeId =
        activeType === "appointment"
          ? activeData?.appointmentData?.id
          : undefined;

      const collisions = (targetDocObj.appointments || []).filter(
        (apt) =>
          apt.id !== excludeId &&
          Math.max(targetStart, apt.start) < Math.min(targetEnd, apt.end),
      );

      if (collisions.length > 0) {
        setConflict({
          attemptedAction: activeType === "pending_request" ? "assign" : "move",
          conflictingItems: buildConflictItems(
            collisions,
            targetStart,
            targetEnd,
            targetDocObj.name,
          ),
        });
      } else {
        setConflict(null);
      }
    },
    [
      isEditMode,
      activeType,
      activeData,
      doctors,
      setConflict,
      getDragDuration,
    ],
  );

  const executeMove = useCallback(
    (
      payloadData: AppointmentType,
      targetDoctorId: string,
      newStart: number,
      newEnd: number,
    ) => {
      if (
        payloadData.docId === targetDoctorId &&
        payloadData.start === newStart &&
        payloadData.end === newEnd
      ) {
        setConflict(null);
        return;
      }

      stageLocalMove({
        ...payloadData,
        start: newStart,
        end: newEnd,
        docId: targetDoctorId,
      });
      setConflict(null);
    },
    [stageLocalMove, setConflict],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setActiveType(null);
      setActiveData(null);
      setOverSlotInfo(null);

      if (!over || !isEditMode || over.data.current?.type !== "slot") return;

      const targetDoctorId = over.data.current.idDoctor as string;
      const targetSlotIdx = over.data.current.slotIdx as number;
      const newStart = targetSlotIdx * ROW_MINUTES;

      if (isGridSlotInPast(newStart, selectedDate)) {
        setConflict({
          attemptedAction: "move",
          conflictingItems: [
            {
              appointmentId: "past-slot",
              patientName: "Past time",
              doctorName: "Schedule",
              start: newStart,
              end: newStart + ROW_MINUTES,
              overlapMinutes: 0,
            },
          ],
        });
        setDrawerOpen(true);
        return;
      }

      const dragType = active.data.current?.type as ActiveDragType;

      if (dragType === "appointment") {
        const payloadData = active.data.current
          ?.appointmentData as AppointmentType | undefined;
        if (!payloadData) return;

        // Always use latest working copy position (accurate after prior local moves).
        const live =
          findAppointment(workingDoctorsRef.current, payloadData.id) ??
          payloadData;

        const duration = live.end - live.start;
        const newStart = targetSlotIdx * ROW_MINUTES;
        const newEnd = newStart + duration;
        const board = workingDoctorsRef.current;

        if (
          hasSchedulingConflict(
            newStart,
            newEnd,
            targetDoctorId,
            board,
            live.id,
          )
        ) {
          const pendingDrag: AppointmentType = {
            ...live,
            start: newStart,
            end: newEnd,
            docId: targetDoctorId,
          };
          const resolution = resolveAppointmentConflict(pendingDrag, board, {
            selectedDate,
            preferSameSpecialty: true,
          });

          if (
            resolution.status === "Resolved" &&
            resolution.action !== "None"
          ) {
            applyConflictResolution(pendingDrag, {
              updatedExistingAppointments:
                resolution.updatedExistingAppointments,
              message: resolution.message,
            });
            return;
          }

          const targetDoc = board.find((d) => d.id === targetDoctorId);
          const collisions = (targetDoc?.appointments || []).filter(
            (apt) =>
              apt.id !== live.id &&
              Math.max(newStart, apt.start) < Math.min(newEnd, apt.end),
          );
          // Prefer expanded chain for richer drawer context when available.
          const chainIds = new Set(
            (resolution.steps ?? []).map((s) => s.appointmentId),
          );
          const drawerItems =
            chainIds.size > 0
              ? (targetDoc?.appointments || []).filter((a) => chainIds.has(a.id))
              : collisions;

          setConflict({
            attemptedAction: "move",
            conflictingItems: buildConflictItems(
              drawerItems.length > 0 ? drawerItems : collisions,
              newStart,
              newEnd,
              targetDoc?.name ?? "Doctor",
            ),
            pendingDrag,
            resolution,
          });
          setDrawerOpen(true);
          return;
        }

        executeMove(live, targetDoctorId, newStart, newEnd);
        return;
      }

      if (dragType === "pending_request") {
        const request = active.data.current
          ?.pendingRequestData as PendingRequest | undefined;
        if (!request) return;

        const duration = request.end - request.start || request.duration || 30;
        const newStart = targetSlotIdx * ROW_MINUTES;
        const newEnd = newStart + duration;
        const board = workingDoctorsRef.current;

        if (hasSchedulingConflict(newStart, newEnd, targetDoctorId, board)) {
          const targetDoc = board.find((d) => d.id === targetDoctorId);
          const collisions = (targetDoc?.appointments || []).filter(
            (apt) =>
              Math.max(newStart, apt.start) < Math.min(newEnd, apt.end),
          );
          setConflict({
            attemptedAction: "assign",
            conflictingItems: buildConflictItems(
              collisions,
              newStart,
              newEnd,
              targetDoc?.name ?? "Doctor",
            ),
          });
          setDrawerOpen(true);
          return;
        }

        openWithPendingRequestAtSlot(
          {
            ...request,
            docId: targetDoctorId,
            start: newStart,
            end: newEnd,
          },
          selectedDate,
        );
        setConflict(null);
      }
    },
    [
      isEditMode,
      executeMove,
      openWithPendingRequestAtSlot,
      selectedDate,
      setConflict,
      setDrawerOpen,
      applyConflictResolution,
    ],
  );

  const overlayMeta = useMemo(() => {
    const duration = getDragDuration(activeType, activeData);
    return {
      cardHeight: (duration / ROW_MINUTES) * SLOT_HEIGHT,
      duration,
    };
  }, [activeData, activeType, getDragDuration]);

  const handleUndoAction = useCallback(() => {
    if (!undoSnapshot) return;
    workingDoctorsRef.current = undoSnapshot.doctors;
    cancelledIdsRef.current = undoSnapshot.cancelledIds;
    setDoctors(
      applyVisibleFilters(undoSnapshot.doctors, filters, selectedDate),
    );
    refreshDirtyCount(undoSnapshot.doctors, baselineDoctors);
    setUndoSnapshot(null);
    setIsToastOpen(false);
  }, [undoSnapshot, filters, baselineDoctors, refreshDirtyCount, selectedDate]);

  const cancelConflict = useCallback(() => {
    clearConflict();
  }, [clearConflict]);

  const confirmConflictResolution = useCallback(
    (withCancellations: boolean) => {
      const payload = useGlobalConflictStore.getState().conflictPayload;
      if (!payload?.pendingDrag || !payload.resolution) return;

      const resolution = payload.resolution;

      if (withCancellations) {
        const cancelledIds = resolution.proposedCancelIds ?? [];
        if (cancelledIds.length === 0) return;
        applyConflictResolution(payload.pendingDrag, {
          updatedExistingAppointments: [],
          cancelledIds,
          message: resolution.message,
        });
        return;
      }

      // Only apply non-cancel plans that fully resolve.
      if (
        resolution.status !== "Resolved" ||
        resolution.updatedExistingAppointments.length === 0
      ) {
        return;
      }

      applyConflictResolution(payload.pendingDrag, {
        updatedExistingAppointments: resolution.updatedExistingAppointments,
        cancelledIds: [],
        message: resolution.message,
      });
    },
    [applyConflictResolution],
  );

  const discardEditChanges = useCallback(() => {
    if (baselineDoctors) {
      workingDoctorsRef.current = cloneDoctors(baselineDoctors);
      setDoctors(applyVisibleFilters(workingDoctorsRef.current, filters, selectedDate));
    }
    cancelledIdsRef.current = [];
    setDirtyCount(0);
    setUndoSnapshot(null);
    setSaveError(null);
    setIsToastOpen(false);
    clearConflict();
  }, [baselineDoctors, filters, clearConflict, selectedDate]);

  const saveEditChanges = useCallback(async () => {
    const toCancel = [...cancelledIdsRef.current].filter(isApiAppointmentId);
    if (!baselineDoctors && toCancel.length === 0) {
      onToggleEdit();
      return;
    }

    const dirty = baselineDoctors
      ? collectDirtyAppointments(workingDoctorsRef.current, baselineDoctors)
      : [];

    if (dirty.length === 0 && toCancel.length === 0) {
      onToggleEdit();
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      if (dirty.length > 0) {
        await persistGridUpdates(dirty);
      }
      if (accessToken) {
        for (const id of toCancel) {
          await updateAppointmentStatus(
            id,
            {
              status: "CANCELLED",
              cancellationReason: "Cancelled to resolve schedule conflict",
            },
            accessToken,
          );
        }
      }
      if (toCancel.length > 0 && dirty.length === 0) {
        await persistGridUpdates([]);
      }
      cancelledIdsRef.current = [];
      setBaselineDoctors(null);
      setDirtyCount(0);
      setUndoSnapshot(null);
      setIsToastOpen(false);
      onToggleEdit();
    } catch (err) {
      setSaveError(
        normalizeCaughtError(
          err,
          "Could not save schedule changes. Please try again.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }, [baselineDoctors, onToggleEdit, persistGridUpdates, accessToken]);

  const requestExitEditMode = useCallback(() => {
    if (dirtyCount > 0 || cancelledIdsRef.current.length > 0) {
      const leave = window.confirm(
        `You have unsaved schedule changes. Discard them and exit Edit Mode?`,
      );
      if (!leave) return;
      discardEditChanges();
    }
    if (isEditMode) onToggleEdit();
  }, [dirtyCount, discardEditChanges, isEditMode, onToggleEdit]);

  return {
    doctors,
    setDoctors,
    activeId,
    activeType,
    activeData,
    overSlotInfo,
    isToastOpen,
    toastInfo,
    overlayMeta,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleUndoAction,
    closeToast: () => setIsToastOpen(false),
    updateAppointment,
    cancelConflict,
    confirmConflictResolution,
    dirtyCount,
    isSaving,
    saveError,
    saveEditChanges,
    discardEditChanges,
    requestExitEditMode,
  };
}
