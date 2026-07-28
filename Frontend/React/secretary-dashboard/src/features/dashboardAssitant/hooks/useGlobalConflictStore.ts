import { create } from "zustand";
import type { AppointmentType, DoctorType } from "../types";
import { resolveAppointmentConflict } from "../utils/conflictResolve";

export interface ConflictingItem {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  visitType: string;
  start: number;
  end: number;
  overlapMinutes: number;
  severity: "critical" | "warning";
  priorityScore: number; // من 1 إلى 10
  phone: string;
}

export interface ConflictPayload {
  draggedApt: AppointmentType;
  targetDoctorId: string;
  targetStart: number;
  targetEnd: number;
  conflictingItems: ConflictingItem[];
}

interface GlobalConflictStore {
  conflictPayload: ConflictPayload | null;
  isDrawerOpen: boolean;
  setConflict: (payload: ConflictPayload | null) => void;
  setDrawerOpen: (isOpen: boolean) => void;
  clearConflict: () => void;
  // الدالة الجديدة المضافة لحقن الخوارزمية تلقائياً وتحديث أطباء الواجهة
  executeAutoResolution: (
    allDoctors: DoctorType[],
    setDoctorsState: (updatedDoctors: DoctorType[]) => void,
    onSuccessCallback?: (msg: string) => void,
    onManualRequiredCallback?: (msg: string) => void,
  ) => void;
}

// 🧠 مُحرّك حساب الأولويات الطبي (Priority Calculation Model)
export function calculatePriorityScore(
  apt: AppointmentType,
  overlap: number,
): { score: number; severity: "critical" | "warning" } {
  let score = 5; // القيمة الابتدائية

  // 1. حسب نوع الحالة واستعجالها
  if (apt.status === "urgent") score += 3;
  if (apt.status === "in_progress") score += 2;

  // 2. تداخل حرج (أكثر من 15 دقيقة)
  if (overlap > 15) score += 2;

  // 3. تحليل الكلمات الدلالية في العنوان للخطورة الزائدة
  const titleLower = (apt.title || "").toLowerCase();
  if (
    titleLower.includes("elderly") ||
    titleLower.includes("heart") ||
    titleLower.includes("blood")
  ) {
    score += 1;
  }

  const finalScore = Math.min(Math.max(score, 1), 10);
  return {
    score: finalScore,
    severity: finalScore >= 8 ? "critical" : "warning",
  };
}

export const useGlobalConflictStore = create<GlobalConflictStore>(
  (set, get) => ({
    conflictPayload: null,
    isDrawerOpen: false,
    setConflict: (payload) => set({ conflictPayload: payload }),
    setDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),
    clearConflict: () => set({ conflictPayload: null, isDrawerOpen: false }),
    executeAutoResolution: (
  allDoctors: DoctorType[],
  setDoctorsState: (updatedDoctors: DoctorType[]) => void,
  onSuccessCallback?: (msg: string) => void,
  onManualRequiredCallback?: (msg: string) => void,
) => {
  const { conflictPayload } = get();
  if (!conflictPayload || conflictPayload.conflictingItems.length === 0)
    return;

  const draggedApt = conflictPayload.draggedApt;

  const projectedDraggedApt: AppointmentType = {
    ...draggedApt,
    start: conflictPayload.targetStart,
    end: conflictPayload.targetEnd,
    docId: conflictPayload.targetDoctorId,
  };

  const result = resolveAppointmentConflict(projectedDraggedApt, allDoctors);

  if (result.status === "Resolved") {
    const affectedIds = result.updatedExistingAppointments.map((a) => a.id);
    const cancelIds = result.cancelledAppointmentIds || [];

    const updatedDoctors = allDoctors.map((doc) => {
      // 1. تنظيف المصفوفة: إزالة الـ draggedApt، والمواعيد المحدثة، والمواعيد المقرّر حذفها (Exist Cancel)
      const appointments = (doc.appointments || []).filter(
        (a) => a.id !== draggedApt.id && !affectedIds.includes(a.id) && !cancelIds.includes(a.id)
      );

      // 2. تثبيت حجز الـ Drag في مكانه المستهدف بأمان
      if (doc.id === projectedDraggedApt.docId) {
        appointments.push(projectedDraggedApt);
      }

      // 3. إعادة حقن المواعيد المحدثة (المزاحة أو المنقولة) في أطبائها الجدد
      const matchesForThisDoc = result.updatedExistingAppointments.filter((a) => a.docId === doc.id);
      if (matchesForThisDoc.length > 0) {
        appointments.push(...matchesForThisDoc);
      }

      return { ...doc, appointments };
    });

    setDoctorsState(updatedDoctors);
    set({ isDrawerOpen: false, conflictPayload: null });
    if (onSuccessCallback) onSuccessCallback(result.message);

  } else if (result.status === "Cancelled") {
    // في حال رجوع الحالة الإجمالية بالإلغاء للحجز الـ exist المتضارب
    const cancelIds = result.cancelledAppointmentIds || [];
    
    const updatedDoctors = allDoctors.map((doc) => {
      const appointments = (doc.appointments || []).filter((a) => !cancelIds.includes(a.id) && a.id !== draggedApt.id);
      
      if (doc.id === projectedDraggedApt.docId) {
        appointments.push(projectedDraggedApt);
      }
      return { ...doc, appointments };
    });

    setDoctorsState(updatedDoctors);
    set({ isDrawerOpen: false, conflictPayload: null });
    if (onSuccessCallback) onSuccessCallback(result.message);

  } else {
    if (onManualRequiredCallback) onManualRequiredCallback(result.message);
  }
},
  }),
);
