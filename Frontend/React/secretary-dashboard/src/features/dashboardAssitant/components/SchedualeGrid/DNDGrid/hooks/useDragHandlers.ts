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
import { useWizardDrawer } from "@/features/dashboardAssitant/hooks/useWizardDrawer";

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
    patientName: patientNameFromTitle(c.title),
    doctorName,
    start: c.start,
    end: c.end,
    overlapMinutes: Math.min(targetEnd, c.end) - Math.max(targetStart, c.start),
  }));
}

function cloneDoctors(source: DoctorType[]): DoctorType[] {
  return JSON.parse(JSON.stringify(source)) as DoctorType[];
}

function filterDoctors(source: DoctorType[], searchQuery: string): DoctorType[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return source;
  return source
    .map((doc) => ({
      ...doc,
      appointments: doc.appointments.filter(
        (a) =>
          (a.title ?? "").toLowerCase().includes(q) ||
          (a.patient?.name ?? "").toLowerCase().includes(q) ||
          (a.patient?.phone ?? "").toLowerCase().includes(q),
      ),
    }))
    .filter(
      (doc) =>
        doc.name.toLowerCase().includes(q) ||
        (doc.specialty ?? "").toLowerCase().includes(q) ||
        doc.appointments.length > 0,
    );
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
  const openWithPendingRequestAtSlot = useWizardDrawer(
    (s) => s.openWithPendingRequestAtSlot,
  );
  const searchQuery = useScheduleGridStore((s) => s.searchQuery);
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const onToggleEdit = useEditeMode((state) => state.onToggleEdit);

  const workingDoctorsRef = useRef<DoctorType[]>([]);
  const [doctors, setDoctors] = useState<DoctorType[]>([]);
  const [baselineDoctors, setBaselineDoctors] = useState<DoctorType[] | null>(
    null,
  );
  const [dirtyCount, setDirtyCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setConflict = useGlobalConflictStore((state) => state.setConflict);
  const setDrawerOpen = useGlobalConflictStore((state) => state.setDrawerOpen);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<ActiveDragType>(null);
  const [activeData, setActiveData] = useState<DragDataPayload | null>(null);
  const [overSlotInfo, setOverSlotInfo] = useState<OverSlotInfo | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<DoctorType[] | null>(null);

  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastInfo, setToastInfo] = useState<ToastInfo>({
    patientName: "",
    newTimeLabel: "",
  });

  const refreshDirtyCount = useCallback((working: DoctorType[], baseline: DoctorType[] | null) => {
    if (!baseline) {
      setDirtyCount(0);
      return;
    }
    setDirtyCount(collectDirtyAppointments(working, baseline).length);
  }, []);

  // View mode: follow live schedule. Edit mode: freeze a baseline and edit locally.
  useEffect(() => {
    const source = scheduleDoctors as DoctorType[];
    if (!isEditMode) {
      workingDoctorsRef.current = cloneDoctors(source);
      setBaselineDoctors(null);
      setDirtyCount(0);
      setSaveError(null);
      setDoctors(filterDoctors(workingDoctorsRef.current, searchQuery));
      return;
    }

    if (!baselineDoctors) {
      const snap = cloneDoctors(source);
      workingDoctorsRef.current = snap;
      setBaselineDoctors(snap);
      setDirtyCount(0);
      setDoctors(filterDoctors(snap, searchQuery));
      return;
    }

    setDoctors(filterDoctors(workingDoctorsRef.current, searchQuery));
  }, [isEditMode, scheduleDoctors, searchQuery, baselineDoctors]);

  const stageLocalMove = useCallback(
    (updatedApt: AppointmentType) => {
      const before = cloneDoctors(workingDoctorsRef.current);
      setUndoSnapshot(before);

      const next = applyAppointmentToDoctors(workingDoctorsRef.current, updatedApt);
      workingDoctorsRef.current = next;
      setDoctors(filterDoctors(next, searchQuery));
      refreshDirtyCount(next, baselineDoctors);

      const titleString = updatedApt.title || "Appointment";
      setToastInfo({
        patientName: titleString.split(" - ")[0],
        newTimeLabel: formatMinutesToTime(
          updatedApt.start,
          updatedApt.end - updatedApt.start,
        ),
      });
      setIsToastOpen(true);
      setSaveError(null);
    },
    [baselineDoctors, refreshDirtyCount, searchQuery],
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

      const targetDocObj = doctors.find((d) => d.id === targetDoctorId);
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

        if (
          hasSchedulingConflict(
            newStart,
            newEnd,
            targetDoctorId,
            doctors,
            live.id,
          )
        ) {
          const targetDoc = doctors.find((d) => d.id === targetDoctorId);
          const collisions = (targetDoc?.appointments || []).filter(
            (apt) =>
              apt.id !== live.id &&
              Math.max(newStart, apt.start) < Math.min(newEnd, apt.end),
          );
          setConflict({
            attemptedAction: "move",
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

        if (hasSchedulingConflict(newStart, newEnd, targetDoctorId, doctors)) {
          const targetDoc = doctors.find((d) => d.id === targetDoctorId);
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
      doctors,
      executeMove,
      openWithPendingRequestAtSlot,
      selectedDate,
      setConflict,
      setDrawerOpen,
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
    workingDoctorsRef.current = undoSnapshot;
    setDoctors(filterDoctors(undoSnapshot, searchQuery));
    refreshDirtyCount(undoSnapshot, baselineDoctors);
    setUndoSnapshot(null);
    setIsToastOpen(false);
  }, [undoSnapshot, searchQuery, baselineDoctors, refreshDirtyCount]);

  const cancelConflict = useCallback(() => {
    setConflict(null);
  }, [setConflict]);

  const discardEditChanges = useCallback(() => {
    if (baselineDoctors) {
      workingDoctorsRef.current = cloneDoctors(baselineDoctors);
      setDoctors(filterDoctors(workingDoctorsRef.current, searchQuery));
    }
    setDirtyCount(0);
    setUndoSnapshot(null);
    setSaveError(null);
    setIsToastOpen(false);
    setConflict(null);
  }, [baselineDoctors, searchQuery, setConflict]);

  const saveEditChanges = useCallback(async () => {
    if (!baselineDoctors || dirtyCount === 0) {
      onToggleEdit();
      return;
    }

    const dirty = collectDirtyAppointments(
      workingDoctorsRef.current,
      baselineDoctors,
    );
    setIsSaving(true);
    setSaveError(null);
    try {
      await persistGridUpdates(dirty);
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
  }, [baselineDoctors, dirtyCount, onToggleEdit, persistGridUpdates]);

  const requestExitEditMode = useCallback(() => {
    if (dirtyCount > 0) {
      const leave = window.confirm(
        `You have ${dirtyCount} unsaved change${dirtyCount > 1 ? "s" : ""}. Discard them and exit Edit Mode?`,
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
    dirtyCount,
    isSaving,
    saveError,
    saveEditChanges,
    discardEditChanges,
    requestExitEditMode,
  };
}
