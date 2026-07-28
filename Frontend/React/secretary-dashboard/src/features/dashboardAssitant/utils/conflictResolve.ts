import { hasSchedulingConflict } from "../components/SchedualeGrid/DNDGrid/utils/conflictValidator";
import type { DoctorType, AppointmentType } from "../types";

export interface MultiResolutionResult {
  status: "Resolved" | "Cancelled" | "Requires Manual Action";
  action: "Shifted Down" | "Shifted Down Chain" | "Transferred Doctor" | "Triggered Cancellation Protocol" | "Prompt User Selection";
  message: string;
  updatedExistingAppointments: AppointmentType[]; 
  cancelledAppointmentIds?: string[]; 
}

/**
 * 1️⃣ الدالة المساعدة لفحص شروط التدخل اليدوي الصارمة (Manual Action Restriction)
 * 🔥 يتم تطبيق الفحص هنا بالكامل على الحجز الـ EXISTING المراد تحريكه وليس الـ DRAG.
 */
function isExistAptRestrictedFromMoving(existApt: AppointmentType): { isManual: boolean; reason: string } {
  // a. حالة الـ exist appointment خطرة
  const isCriticalCase = existApt.status === "urgent" || existApt.complexity === "urgent";

  const now = new Date();
  const currentMinutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  
  // ⏱️ حد الأمان المعتمد: 15 دقيقة
  const MINUTES_BUFFER = 15; 

  // b. اقترب موعد الحجز الـ exist بـ 15 دقيقة أو أقل من الوقت الحالي
  const isWithinBuffer = 
    (existApt.start - currentMinutesSinceMidnight <= MINUTES_BUFFER) && 
    (existApt.start >= currentMinutesSinceMidnight);

  // c. حجز مضى (أي أن الحجز الـ exist وقته الأصلي في الجدول قد مضى بالفعل ولا يجوز للخوارزمية زحزحته تلقائياً)
  // const isPastAppointment = existApt.start < currentMinutesSinceMidnight;

  if (isCriticalCase) return { isManual: true, reason: `Existing appointment (${existApt.patient?.name}) is Critical/Urgent` };
  if (isWithinBuffer) return { isManual: true, reason: `Existing appointment (${existApt.patient?.name}) is within 15 mins buffer` };
  // if (isPastAppointment) return { isManual: true, reason: `Existing appointment (${existApt.patient?.name}) belongs to past time` };

  return { isManual: false, reason: "" };
}

/**
 * 2️⃣ الدالة المسؤولة عن معالجة التعارض الفردي (Single Conflict Optimization)
 * الترتيب الصارم: 1. Shift Down للحجز الـ Exist -> 2. Transfer للحجز الـ Exist -> 3. Cancel للحجز الـ Exist المقيد
 */
function handleSingleConflict(
  draggedApt: AppointmentType,
  aptA: AppointmentType, // الحجز الـ exist المتعارض
  doctorAppointments: AppointmentType[],
  allDoctors: DoctorType[]
): MultiResolutionResult | null {
  
  // 1️⃣ أولاً: فحص الـ Shift Down للحجز الـ exist (aptA)
  const shiftedStart = draggedApt.end;
  const durationA = aptA.end - aptA.start;
  const shiftedEnd = shiftedStart + durationA;

  const nextApt = doctorAppointments.find((a) => a.start >= aptA.end && a.id !== aptA.id);
  const hasOverlapWithNext = nextApt ? shiftedEnd > nextApt.start : false;

  if (!hasOverlapWithNext && shiftedEnd <= 1440) {
    return {
      status: "Resolved",
      action: "Shifted Down",
      message: "Conflict mitigated by shifting single existing appointment down.",
      updatedExistingAppointments: [{ ...aptA, start: shiftedStart, end: shiftedEnd }],
    };
  }

  // 2️⃣ ثانياً: فحص الـ Transfer للحجز الـ exist (aptA) لطبيب آخر متفرغ
  const alternativeDoctor = allDoctors.find(
    (doc) =>
      doc.id !== aptA.docId &&
      !hasSchedulingConflict(aptA.start, aptA.end, doc.id, allDoctors, aptA.id)
  );

  if (alternativeDoctor) {
    return {
      status: "Resolved",
      action: "Transferred Doctor",
      message: `Migrated existing appointment to alternative professional: ${alternativeDoctor.name}`,
      updatedExistingAppointments: [{ ...aptA, docId: alternativeDoctor.id }],
    };
  }

  // 3️⃣ ثالثاً: فحص الـ Cancel للحجز الـ exist إذا كان مقيداً ويرفض النقل
  if (aptA.refuseTransfer === true) {
    return {
      status: "Cancelled",
      action: "Triggered Cancellation Protocol",
      message: "Existing appointment restricted doctor assignment. Existing record deleted.",
      updatedExistingAppointments: [],
      cancelledAppointmentIds: [aptA.id] 
    };
  }

  return null; 
}

/**
 * 3️⃣ الدالة المسؤولة عن معالجة التعارض المتعدد المتسلسل (Multi-Conflict Cascade)
 * الترتيب الصارم: 
 * 1. فحص الـ Transfer لكل المواعيد الـ exist (والذي يقبل ينقل).
 * 2. ما تبقى ولم ينقل، يتم فحص الـ Shift Down له.
 * 3. ما تبقى بعد ذلك ومقيد بالدكتور (refuseTransfer) يتم عمل Cancel له.
 */
function handleMultiConflict(
  draggedApt: AppointmentType,
  affectedChain: AppointmentType[], // الحجوزات الـ exist المتعارضة
  doctorAppointments: AppointmentType[],
  allDoctors: DoctorType[],
  targetDoctorId: string
): MultiResolutionResult {
  
  const updatedExistingAppointments: AppointmentType[] = [];
  const cancelledAppointmentIds: string[] = [];
  const remainingUnresolvedApts: AppointmentType[] = [];

  // 1️⃣ أولاً: التشيك على الـ transfer للكل، والذي يقبل ويوجد له مكان ينقل
  for (const apt of affectedChain) {
    if (apt.refuseTransfer !== true) {
      const alternativeDoctor = allDoctors.find(
        (doc) =>
          doc.id !== targetDoctorId &&
          !hasSchedulingConflict(apt.start, apt.end, doc.id, allDoctors, apt.id)
      );

      if (alternativeDoctor) {
        updatedExistingAppointments.push({ ...apt, docId: alternativeDoctor.id });
        continue; 
      }
    }
    remainingUnresolvedApts.push(apt);
  }

  // 2️⃣ ثانياً: ما تبقى من مواعيد exist، نقوم بفحص الـ shift down عليها
  if (remainingUnresolvedApts.length > 0) {
    let nextAvailableStart = draggedApt.end;
    const shiftedSubChain: AppointmentType[] = [];
    let canShiftAllRemaining = true;

    for (const apt of remainingUnresolvedApts) {
      const duration = apt.end - apt.start;
      const shiftedEnd = nextAvailableStart + duration;

      if (shiftedEnd > 1440) {
        canShiftAllRemaining = false;
        break;
      }

      const hasExternalConflict = doctorAppointments.some((otherApt) => {
        if (affectedChain.some((a) => a.id === otherApt.id)) return false;
        return Math.max(nextAvailableStart, otherApt.start) < Math.min(shiftedEnd, otherApt.end);
      });

      if (hasExternalConflict) {
        canShiftAllRemaining = false;
        break;
      }

      shiftedSubChain.push({ ...apt, start: nextAvailableStart, end: shiftedEnd });
      nextAvailableStart = shiftedEnd;
    }

    if (canShiftAllRemaining) {
      updatedExistingAppointments.push(...shiftedSubChain);
      remainingUnresolvedApts.length = 0; 
    }
  }

  // 3️⃣ ثالثاً: إذا تبقى حجوزات بعد فشل النقل والإزاحة، نشيك على تقييد الحجز للدكتور ثم الـ cancel
  if (remainingUnresolvedApts.length > 0) {
    const activeCancelIds: string[] = [];
    const stillBlockedApts: AppointmentType[] = [];

    for (const apt of remainingUnresolvedApts) {
      if (apt.refuseTransfer === true) {
        activeCancelIds.push(apt.id); // إلغاء الحجز الـ exist المقيد
      } else {
        stillBlockedApts.push(apt);
      }
    }

    if (activeCancelIds.length > 0) {
      cancelledAppointmentIds.push(...activeCancelIds);
    }

    // إذا تبقت حجوزات لا يمكن تحريكها ولم تُحذف، يتم تحويلها لـ Manual Action
    if (stillBlockedApts.length > 0) {
      return {
        status: "Requires Manual Action",
        action: "Prompt User Selection",
        message: "Multi-conflict scheduling congestion. Manual resolution needed for remaining stable elements.",
        updatedExistingAppointments: [],
      };
    }
  }

  if (updatedExistingAppointments.length > 0 || cancelledAppointmentIds.length > 0) {
    return {
      status: "Resolved",
      action: "Shifted Down Chain",
      message: `Resolved multi-conflict cascade cleanly: ${updatedExistingAppointments.length} existing appointments updated, ${cancelledAppointmentIds.length} restricted records cancelled.`,
      updatedExistingAppointments,
      cancelledAppointmentIds,
    };
  }

  return {
    status: "Requires Manual Action",
    action: "Prompt User Selection",
    message: "Cascade boundary exception. Manual routing required.",
    updatedExistingAppointments: [],
  };
}

/**
 * 🚀 نقطة الدخول الرئيسية لنظام حل النزاعات (Main Entry Point)
 */
export function resolveAppointmentConflict(
  draggedApt: AppointmentType, 
  allDoctors: DoctorType[],
): MultiResolutionResult {

  const targetDoctor = allDoctors.find((d) => d.id === draggedApt.docId);
  if (!targetDoctor) {
    return {
      status: "Requires Manual Action",
      action: "Prompt User Selection",
      message: "Target doctor resources not found.",
      updatedExistingAppointments: [],
    };
  }

  // ترتيب مواعيد الدكتور المستهدف تصاعدياً مع استبعاد الـ Drag بوضعيته القديمة
  const doctorAppointments = [...(targetDoctor.appointments || [])]
    .filter((a) => a.id !== draggedApt.id)
    .sort((a, b) => a.start - b.start);

  // اكتشاف المواعيد المتعارضة (Exist Appointments) مباشرة في نفس مكان إسقاط الـ Drag
  const directConflictingApts = doctorAppointments.filter(
    (apt) => Math.max(draggedApt.start, apt.start) < Math.min(draggedApt.end, apt.end)
  );

  // إذا لم يكن هناك أي تداخل، يستقر الـ Drag بسلام
  if (directConflictingApts.length === 0) {
    return {
      status: "Resolved",
      action: "Prompt User Selection",
      message: "No actual conflict detected.",
      updatedExistingAppointments: [],
    };
  }

  // 🔥 [إصلاح التعديل الرابع الجوهري]: التحقق من قيود الـ Manual Action على الـ Exist Appointments المتأثرة فقط وليس الـ Drag
  for (const existApt of directConflictingApts) {
    const manualCheck = isExistAptRestrictedFromMoving(existApt);
    if (manualCheck.isManual) {
      return {
        status: "Requires Manual Action",
        action: "Prompt User Selection",
        message: `System safety bypass: ${manualCheck.reason}. Manual routing enforced.`,
        updatedExistingAppointments: [],
      };
    }
  }

  // ⚡ [السيناريو الأول]: معالجة التعارض الفردي (Single Conflict)
  if (directConflictingApts.length === 1) {
    const singleResult = handleSingleConflict(draggedApt, directConflictingApts[0], doctorAppointments, allDoctors);
    if (singleResult) return singleResult;
  }

  // ⚡ [السيناريو الثاني]: معالجة التعارض المتعدد (Multi-Conflict)
  return handleMultiConflict(draggedApt, directConflictingApts, doctorAppointments, allDoctors, targetDoctor.id);
}