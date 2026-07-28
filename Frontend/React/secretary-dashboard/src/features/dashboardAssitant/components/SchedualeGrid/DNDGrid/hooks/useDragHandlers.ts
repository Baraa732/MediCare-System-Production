import { useState, useCallback, useMemo, useEffect } from "react";
import {
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
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
} from "@/features/dashboardAssitant/types";
import type {
  OverSlotInfo,
  ToastInfo,
  ActiveDragType,
} from "../types/dragTypes";
import {
  calculatePriorityScore,
  useGlobalConflictStore,
  type ConflictingItem,
} from "@/features/dashboardAssitant/hooks/useGlobalConflictStore";
import { useScheduleContext } from "@/features/dashboardAssitant/context/ScheduleContext";
import {
  isApiAppointmentId,
  useAppointmentActions,
} from "@/features/dashboardAssitant/hooks/useAppointmentActions";
import { normalizeCaughtError } from "@/lib/api/errors";

export function useDragHandlers() {
  const { doctors: scheduleDoctors } = useScheduleContext();
  const { persistGridUpdate, refetch } = useAppointmentActions();

  const [doctors, setDoctors] = useState<DoctorType[]>([]);

  useEffect(() => {
    setDoctors(scheduleDoctors as DoctorType[]);
  }, [scheduleDoctors]);

  const isEditMode = useEditeMode((state) => state.isEditMode);
  const setConflict = useGlobalConflictStore((state) => state.setConflict);
  const setDrawerOpen = useGlobalConflictStore((state) => state.setDrawerOpen);
  const conflictPayload = useGlobalConflictStore(
    (state) => state.conflictPayload,
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<ActiveDragType>(null);
  const [activeData, setActiveData] = useState<DragDataPayload | null>(null);
  const [overSlotInfo, setOverSlotInfo] = useState<OverSlotInfo | null>(null);
  const [snapshotDoctors, setSnapshotDoctors] = useState<DoctorType[] | null>(
    null,
  );

  const [pendingMove, setPendingMove] = useState<{
    payloadData: AppointmentType;
    targetDoctorId: string;
    newStart: number;
    newEnd: number;
  } | null>(null);

  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastInfo, setToastInfo] = useState<ToastInfo>({
    patientName: "",
    newTimeLabel: "",
  });

  const applyLocalUpdate = useCallback((updatedApt: AppointmentType) => {
    setDoctors((prev) =>
      prev.map((doc) => {
        const filteredApts: AppointmentType[] = doc.appointments.filter(
          (a) => a && a.id !== updatedApt.id,
        );
        if (doc.id === updatedApt.docId) {
          filteredApts.push(updatedApt as AppointmentType);
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

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!isEditMode) return;
      const { active } = event;
      const currentData = active.data.current as DragDataPayload | undefined;

      setActiveId(active.id as string);
      setActiveType(
        currentData?.type ?? (active.data.current?.sortable ? "doctor" : null),
      );
      setActiveData(currentData ?? null);
      setSnapshotDoctors(JSON.parse(JSON.stringify(doctors)));
      setIsToastOpen(false);
    },
    [isEditMode, doctors],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (
        !over ||
        !isEditMode ||
        activeType !== "appointment" ||
        !activeData?.appointmentData
      ) {
        return;
      }

      if (over.data.current?.type === "slot") {
        const targetDoctorId = over.data.current.idDoctor;
        const targetSlotIdx = over.data.current.slotIdx;
        const aptData = activeData.appointmentData;

        const duration = aptData.end - aptData.start;
        const targetStart = targetSlotIdx * ROW_MINUTES;
        const targetEnd = targetStart + duration;

        setOverSlotInfo({
          docId: targetDoctorId,
          slotIdx: targetSlotIdx,
          top: targetSlotIdx * SLOT_HEIGHT,
          height: (duration / ROW_MINUTES) * SLOT_HEIGHT,
        });

        const targetDocObj = doctors.find((d) => d.id === targetDoctorId);
        if (targetDocObj) {
          const collisions: AppointmentType[] = (
            targetDocObj.appointments || []
          ).filter(
            (apt) =>
              apt.id !== aptData.id &&
              Math.max(targetStart, apt.start) < Math.min(targetEnd, apt.end),
          );

          if (collisions.length > 0) {
            const conflictingItems: ConflictingItem[] = collisions.map((c) => {
              const overlap =
                Math.min(targetEnd, c.end) - Math.max(targetStart, c.start);
              const { score, severity } = calculatePriorityScore(c, overlap);
              const parts = (c.title || "").split(" - ");
              return {
                appointmentId: c.id,
                patientName: parts[0] || "Unknown Patient",
                doctorName: targetDocObj.name,
                visitType: parts[1] || "Consultation",
                start: c.start,
                end: c.end,
                overlapMinutes: overlap,
                severity,
                priorityScore: score,
                phone: c.patient?.phone ?? "",
              };
            });

            conflictingItems.sort((a, b) => b.priorityScore - a.priorityScore);

            setConflict({
              draggedApt: aptData,
              targetDoctorId,
              targetStart,
              targetEnd,
              conflictingItems,
            });
          } else {
            setConflict(null);
          }
        }
      }
    },
    [isEditMode, activeType, activeData, doctors, setConflict],
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
          return;
        }
      } else {
        applyLocalUpdate(moved);
      }

      setPendingMove(null);
      setConflict(null);
    },
    [applyLocalUpdate, persistGridUpdate, snapshotDoctors],
  );

  const confirmPendingMove = useCallback(() => {
    if (pendingMove) {
      void executeMove(
        pendingMove.payloadData,
        pendingMove.targetDoctorId,
        pendingMove.newStart,
        pendingMove.newEnd,
      );
    }
  }, [pendingMove, executeMove]);

  const cancelPendingMove = useCallback(() => {
    setPendingMove(null);
    setConflict(null);
    setDrawerOpen(false);
  }, [setConflict, setDrawerOpen]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setActiveType(null);
      setActiveData(null);
      setOverSlotInfo(null);

      if (!over || !isEditMode) return;

      if (
        active.data.current?.type === "doctor" ||
        active.data.current?.sortable
      ) {
        if (active.id !== over.id) {
          setDoctors((items) => {
            const oldIndex = items.findIndex((i) => i.id === active.id);
            const newIndex = items.findIndex((i) => i.id === over.id);
            return arrayMove(items, oldIndex, newIndex) as DoctorType[];
          });
        }
        return;
      }

      if (activeType === "appointment" && over.data.current?.type === "slot") {
        const targetDoctorId = over.data.current.idDoctor;
        const targetSlotIdx = over.data.current.slotIdx;
        const payloadData = active.data.current?.appointmentData;

        if (!payloadData) return;

        const duration = payloadData.end - payloadData.start;
        const newStart = targetSlotIdx * ROW_MINUTES;
        const newEnd = newStart + duration;

        if (conflictPayload && conflictPayload.conflictingItems.length > 0) {
          setPendingMove({ payloadData, targetDoctorId, newStart, newEnd });
          setDrawerOpen(true);
          return;
        }

        void executeMove(payloadData, targetDoctorId, newStart, newEnd);
      }
    },
    [isEditMode, activeType, conflictPayload, executeMove, setDrawerOpen],
  );

  const overlayMeta = useMemo(() => {
    const duration = activeData?.appointmentData
      ? activeData.appointmentData.end - activeData.appointmentData.start
      : 0;
    return {
      cardHeight: (duration / ROW_MINUTES) * SLOT_HEIGHT,
      duration,
    };
  }, [activeData]);

  const handleUndoAction = useCallback(() => {
    if (snapshotDoctors) {
      setDoctors(snapshotDoctors);
      setSnapshotDoctors(null);
    }
  }, [snapshotDoctors]);

  const addAppointment = useCallback((_newApt: AppointmentType) => {
    void refetch();
  }, [refetch]);

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
    addAppointment,
    confirmPendingMove,
    cancelPendingMove,
  };
}
