import { useState, useCallback, useMemo } from "react";
import {
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  INITIAL_DOCTORS,
  SLOT_HEIGHT,
  ROW_MINUTES,
  APPOINTMENTS,
} from "../../../../data/scheduleGrid";
import { useEditeMode } from "../../../../hooks";
import { formatMinutesToTime } from "../utils/timeFormatters";
// import { useCurrentTime } from "./useCurrentTime";
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
// 🚀 استيراد مخزن النزاعات لإشعاره فورا حياً

export function useDragHandlers() {
  const [doctors, setDoctors] = useState<DoctorType[]>(() =>
    INITIAL_DOCTORS.map((doc) => ({
      ...doc,
      appointments: APPOINTMENTS.map((apt) => ({
        ...apt,
      })).filter((apt) => apt.docId === doc.id),
    })),
  );

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

  // تخزين موقت للحدث المجرور لتأكيده لاحقاً عبر الـ Drawer
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

  const updateAppointment = useCallback(
    (updatedApt: AppointmentType) => {
      setSnapshotDoctors(JSON.parse(JSON.stringify(doctors)));
      setIsToastOpen(false);

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
    },
    [doctors],
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

        // 🔍 كشف التداخل الحي والخطير أثناء السحب المباشر فوق المواعيد الأخرى
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
                phone: c.patient.phone,
              };
            });

            // فرز الحالات تنازلياً حسب نقاط الأولوية الأعلى أولاً
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
    (
      payloadData: AppointmentType,
      targetDoctorId: string,
      newStart: number,
      newEnd: number,
    ) => {
      setDoctors((prev) =>
        prev.map((doc) => {
          const filteredApts = (doc.appointments || []).filter(
            (a) => a && a.id !== payloadData.id,
          );
          if (doc.id === targetDoctorId) {
            filteredApts.push({
              ...payloadData,
              start: newStart,
              end: newEnd,
              docId: targetDoctorId,
            });
          }
          return { ...doc, appointments: filteredApts };
        }),
      );

      const titleString = payloadData.title || "Appointment";
      setToastInfo({
        patientName: titleString.split(" - ")[0],
        newTimeLabel: formatMinutesToTime(newStart, newEnd - newStart),
      });
      setIsToastOpen(true);
      setPendingMove(null);
      setConflict(null);
    },
    [setConflict],
  );

  const confirmPendingMove = useCallback(() => {
    if (pendingMove) {
      executeMove(
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

        // 🚀 إذا تم إسقاط الموعد ووجد تداخل نشط، افتح الدرج تلقائياً وعلق الإسقاط حتى تأكيد السكرتيرة
        if (conflictPayload && conflictPayload.conflictingItems.length > 0) {
          setPendingMove({ payloadData, targetDoctorId, newStart, newEnd });
          setDrawerOpen(true);
          return;
        }

        // نقل مستقر بدون تعقيدات في حال عدم وجود أي تداخل زمني
        executeMove(payloadData, targetDoctorId, newStart, newEnd);
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

  const addAppointment = useCallback((newApt: AppointmentType) => {
    setDoctors((prevDoctors) =>
      prevDoctors.map((doc) => {
        if (doc.id === newApt.docId) {
          return {
            ...doc,
            appointments: [...(doc.appointments || []), newApt],
          };
        }
        return doc;
      }),
    );
  }, []);

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
