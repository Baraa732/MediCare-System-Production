import { useState, useCallback, useMemo, useEffect } from "react";
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

export function useDragHandlers() {
  const { doctors: scheduleDoctors, selectedDate } = useScheduleContext();
  const { persistGridUpdate } = useAppointmentActions();
  const openWithPendingRequestAtSlot = useWizardDrawer(
    (s) => s.openWithPendingRequestAtSlot,
  );
  const searchQuery = useScheduleGridStore((s) => s.searchQuery);

  const [doctors, setDoctors] = useState<DoctorType[]>([]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    const source = scheduleDoctors as DoctorType[];
    if (!q) {
      setDoctors(source);
      return;
    }
    setDoctors(
      source
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
        ),
    );
  }, [scheduleDoctors, searchQuery]);

  const isEditMode = useEditeMode((state) => state.isEditMode);
  const setConflict = useGlobalConflictStore((state) => state.setConflict);
  const setDrawerOpen = useGlobalConflictStore((state) => state.setDrawerOpen);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<ActiveDragType>(null);
  const [activeData, setActiveData] = useState<DragDataPayload | null>(null);
  const [overSlotInfo, setOverSlotInfo] = useState<OverSlotInfo | null>(null);
  const [snapshotDoctors, setSnapshotDoctors] = useState<DoctorType[] | null>(
    null,
  );

  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastInfo, setToastInfo] = useState<ToastInfo>({
    patientName: "",
    newTimeLabel: "",
  });

  const applyLocalUpdate = useCallback((updatedApt: AppointmentType) => {
    setDoctors((prev) =>
      prev.map((doc) => {
        const filteredApts = doc.appointments.filter(
          (a) => a && a.id !== updatedApt.id,
        );
        if (doc.id === updatedApt.docId) {
          filteredApts.push(updatedApt);
        }
        return { ...doc, appointments: filteredApts };
      }),
    );

    const titleString = updatedApt.title || "Appointment";
    setToastInfo({
      patientName: titleString.split(" - ")[0],
      newTimeLabel: formatMinutesToTime(
        updatedApt.start,
        updatedApt.end - updatedApt.start,
      ),
    });
    setIsToastOpen(true);
  }, []);

  const updateAppointment = useCallback(
    async (updatedApt: AppointmentType) => {
      setSnapshotDoctors(JSON.parse(JSON.stringify(doctors)));
      setIsToastOpen(false);

      if (isApiAppointmentId(updatedApt.id)) {
        try {
          await persistGridUpdate(updatedApt);
          const titleString = updatedApt.title || "Appointment";
          setToastInfo({
            patientName: titleString.split(" - ")[0],
            newTimeLabel: formatMinutesToTime(
              updatedApt.start,
              updatedApt.end - updatedApt.start,
            ),
          });
          setIsToastOpen(true);
          return;
        } catch (err) {
          alert(
            normalizeCaughtError(
              err,
              "Could not save appointment changes. Please try again.",
            ),
          );
          if (snapshotDoctors) {
            setDoctors(snapshotDoctors);
          }
          return;
        }
      }

      applyLocalUpdate(updatedApt);
    },
    [applyLocalUpdate, doctors, persistGridUpdate, snapshotDoctors],
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
      setSnapshotDoctors(JSON.parse(JSON.stringify(doctors)));
      setIsToastOpen(false);
      setConflict(null);
    },
    [isEditMode, doctors, setConflict],
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
    async (
      payloadData: AppointmentType,
      targetDoctorId: string,
      newStart: number,
      newEnd: number,
    ) => {
      const moved: AppointmentType = {
        ...payloadData,
        start: newStart,
        end: newEnd,
        docId: targetDoctorId,
      };

      if (isApiAppointmentId(moved.id)) {
        try {
          await persistGridUpdate(moved);
          const titleString = moved.title || "Appointment";
          setToastInfo({
            patientName: titleString.split(" - ")[0],
            newTimeLabel: formatMinutesToTime(newStart, newEnd - newStart),
          });
          setIsToastOpen(true);
        } catch (err) {
          alert(
            normalizeCaughtError(
              err,
              "Could not move this appointment. Please try again.",
            ),
          );
          if (snapshotDoctors) {
            setDoctors(snapshotDoctors);
          }
        }
      } else {
        applyLocalUpdate(moved);
      }

      setConflict(null);
    },
    [applyLocalUpdate, persistGridUpdate, snapshotDoctors, setConflict],
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

        const duration = payloadData.end - payloadData.start;
        const newStart = targetSlotIdx * ROW_MINUTES;
        const newEnd = newStart + duration;

        if (
          hasSchedulingConflict(
            newStart,
            newEnd,
            targetDoctorId,
            doctors,
            payloadData.id,
          )
        ) {
          const targetDoc = doctors.find((d) => d.id === targetDoctorId);
          const collisions = (targetDoc?.appointments || []).filter(
            (apt) =>
              apt.id !== payloadData.id &&
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

        void executeMove(payloadData, targetDoctorId, newStart, newEnd);
        return;
      }

      if (dragType === "pending_request") {
        const request = active.data.current
          ?.pendingRequestData as PendingRequest | undefined;
        if (!request) return;

        const duration = request.end - request.start || request.duration || 30;
        const newStart = targetSlotIdx * ROW_MINUTES;
        const newEnd = newStart + duration;

        if (
          hasSchedulingConflict(newStart, newEnd, targetDoctorId, doctors)
        ) {
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
    if (snapshotDoctors) {
      setDoctors(snapshotDoctors);
      setSnapshotDoctors(null);
    }
    setIsToastOpen(false);
  }, [snapshotDoctors]);

  const cancelConflict = useCallback(() => {
    setConflict(null);
    if (snapshotDoctors) {
      setDoctors(snapshotDoctors);
      setSnapshotDoctors(null);
    }
  }, [setConflict, snapshotDoctors]);

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
  };
}
