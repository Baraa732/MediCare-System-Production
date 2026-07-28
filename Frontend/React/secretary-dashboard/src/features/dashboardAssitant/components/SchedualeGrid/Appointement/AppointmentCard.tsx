import {
  ROW_MINUTES,
  SLOT_HEIGHT,
  START_TIME_MINUTES,
} from "@/features/dashboardAssitant/data/scheduleGrid";
import type { AppointmentType } from "@/features/dashboardAssitant/types";
import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import { ContentAppointementCard, SideIconAppointementCard } from ".";
// 🚀 استيراد أيقونات ومخزن النزاع لحقن الهوية البصرية المتوهجة للكرت المتأثر
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useGlobalConflictStore } from "@/features/dashboardAssitant/hooks/useGlobalConflictStore";
import { useWizardDrawer } from "@/features/dashboardAssitant/hooks/useWizardDrawer";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function AppointmentCard({
  apt,
  isEditMode,
  currentMinutesSinceGridStart,
}: {
  apt: AppointmentType;
  isEditMode: boolean;
  currentMinutesSinceGridStart: number;
}) {
  const topOffset = (apt.start / ROW_MINUTES) * SLOT_HEIGHT;
  const cardHeight = ((apt.end - apt.start) / ROW_MINUTES) * SLOT_HEIGHT;

  // الشرط الذكي المعتمد على إحداثيات الخط الأحمر المتزامن الخاص بك
  const isPastAppointment = apt.start <= currentMinutesSinceGridStart;

  // معالجة الأيقونات والوضعية البرمجية الدقيقة للتصميم
  const showLockIcon = isEditMode && isPastAppointment;
  const showGripHandle = isEditMode && !isPastAppointment;
  const isDragDisabled = !isEditMode || isPastAppointment;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: apt.id,
      data: {
        type: "appointment",
        appointmentData: apt,
      },
      disabled: isDragDisabled,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 100,
      }
    : undefined;

  const openWithEditAppointment = useWizardDrawer(
    (state) => state.openWithEditAppointment,
  );
  // 🚀 مراقبة تداخل الكرت الحالي حياً مع عملية السحب النشطة
  const conflictPayload = useGlobalConflictStore(
    (state) => state.conflictPayload,
  );
  const conflictItem = conflictPayload?.conflictingItems.find(
    (c) => c.appointmentId === apt.id,
  );
  const isConflicting = !!conflictItem;

  const startH = Math.floor((START_TIME_MINUTES + apt.start) / 60) % 24;
  const startM = (START_TIME_MINUTES + apt.start) % 60;
  const endH = Math.floor((START_TIME_MINUTES + apt.end) / 60) % 24;
  const endM = (START_TIME_MINUTES + apt.end) % 60;

  const formatTimeLabel = (h: number, m: number) => {
    const displayH = h === 0 || h === 12 ? 12 : h % 12;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${displayH}:${m === 0 ? "00" : m < 10 ? "0" + m : m} ${ampm}`;
  };

  const appointement = { patientName: "Patient", visitType: "Consultation" };
  if (apt.title && apt.title.includes(" - ")) {
    const parts = apt.title.split(" - ");
    appointement.patientName = parts[0].trim();
    appointement.visitType = parts[1].trim();
  } else if (apt.title) {
    appointement.patientName = apt.title;
  }

  if (apt.title && apt.title.includes(" - ")) {
    const parts = apt.title.split(" - ");
    appointement.patientName = parts[0].trim();
    appointement.visitType = parts[1].trim();
  } else if (apt.title) {
    appointement.patientName = apt.title;
  } else {
    appointement.patientName = apt.patient.name || "Patient";
  }

  // States for the Urgent/Critical warning dialog
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const countdownIntervalRef = useRef<number | null>(null);

  // Handle countdown lifecycle when the warning dialog opens
  useEffect(() => {
    if (isWarningOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountdown(5);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current)
              clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }

    return () => {
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
    };
  }, [isWarningOpen]);

  // تفاعل النقر الذكي طبقاً للسيناريوهات الثلاثة المطلوبة
  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isPastAppointment) {
      // السيناريو 1: موعد منتهي -> فتح وضع القراءة فقط فوراً
      openWithEditAppointment(apt, true);
    } else {
      const isUrgentOrCritical =
        apt.complexity === "urgent" ||
        apt.status === "urgent" ||
        (isConflicting && conflictItem?.severity === "critical");

      if (isUrgentOrCritical) {
        setIsWarningOpen(true);
      } else {
        // السيناريو 2: موعد مستقبلي عادي -> فتح وضع التعديل مباشرة
        openWithEditAppointment(apt, false);
      }
    }
  };
  const handleConfirmUrgentEdit = () => {
    setIsWarningOpen(false);
    // Directly open edit drawer now that the warning is acknowledged
    openWithEditAppointment(apt, false);
  };
  return (
    <>
      <div
        ref={setNodeRef}
        {...(!isDragDisabled ? listeners : {})}
        {...attributes}
        onClick={!isEditMode ? handleCardClick : undefined}
        onDoubleClick={(e) => {
          if (isEditMode) {
            e.preventDefault();
            e.stopPropagation();
            // يرسل الحدث مباشرة لمنظم الشبكة المركزي لعرض القائمة المنبثقة
            window.dispatchEvent(
              new CustomEvent("open-appointment-menu", {
                detail: { appointment: apt, x: e.clientX, y: e.clientY },
              }),
            );
          }
        }}
        style={{
          ...style,
          top: topOffset + 3,
          height: cardHeight - 6,
        }}
        className={cn(
          "absolute left-2 right-2 rounded-xl flex transition-all duration-350 ease-in-out shadow-xs group z-10 overflow-hidden select-none border box-border",
          isDragging &&
            "opacity-15 border-dashed bg-neutral-100 border-neutral-300 pointer-events-none",
          showGripHandle &&
            "cursor-grab active:cursor-grabbing hover:shadow-md border-dashed",
          showLockIcon && "opacity-85 border-solid cursor-not-allowed",
          !isEditMode && "cursor-pointer",

          // 🚀 حقن الهوية التحذيرية الملونة المتوهجة للنزاعات الحية (Visual Highlights)
          isConflicting &&
            conflictItem.severity === "critical" &&
            "border-red-500 bg-red-50 text-red-900 ring-2 ring-red-400 z-30 animate-pulse",
          isConflicting &&
            conflictItem.severity !== "critical" &&
            "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400 z-30",

          // الحالات الافتراضية المستقرة
          !isConflicting &&
            apt.status === "confirmed" &&
            "bg-[#E2F1FF] border-blue-200/80 text-[#0055cc]",
          !isConflicting &&
            apt.status === "urgent" &&
            "bg-red-50 border-red-200/80 text-red-700",
          !isConflicting &&
            apt.status === "in_progress" &&
            "bg-purple-50 border-purple-200/80 text-purple-700",
          !isConflicting &&
            apt.status === "late" &&
            "bg-amber-50 border-amber-200/80 text-amber-700",
          !isConflicting &&
            apt.status === "unavailable" &&
            "bg-neutral-50 border-neutral-200 text-neutral-400 line-through opacity-75",

          isConflicting && "-z-10",
        )}
      >
        {/* 🚀 أيقونة تداخل منبثقة ملونة في أعلى الكرت المتأثر */}
        {isConflicting && (
          <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-white border border-amber-300 rounded px-1 text-[9px] font-black text-neutral-800 shadow-sm">
            <AlertTriangle
              className={cn(
                "w-2.5 h-2.5",
                conflictItem.severity === "critical"
                  ? "text-red-500"
                  : "text-amber-500",
              )}
            />
            <span>-{conflictItem.overlapMinutes}m</span>
          </div>
        )}

        {/* المقبض الجانبي المتحرك: يتمدد بـ w-8 في التعديل وينكمش إلى w-0 في العرض العادي */}
        <SideIconAppointementCard
          isEditMode={isEditMode}
          apt={apt}
          showGripHandle={showGripHandle}
          showLockIcon={showLockIcon}
        />

        {/* حاوية المحتوى والمعلومات المكتوبة */}
        <ContentAppointementCard
          apt={apt}
          showLockIcon={showLockIcon}
          showGripHandle={showGripHandle}
          appointement={appointement}
          formatTimeLabel={formatTimeLabel}
          startH={startH}
          startM={startM}
          endH={endH}
          endM={endM}
        />
      </div>
      {/* Warning Dialog for Urgent or Conflict Critical Actions */}
      <Dialog open={isWarningOpen} onOpenChange={setIsWarningOpen}>
        <DialogPortal>
          <DialogOverlay className=" bg-black/60 backdrop-blur-xs" />
          <DialogContent
            className="max-w-md z-100 rounded-2xl p-6 bg-white"
            onClick={(e) => e.stopPropagation()} // Stop bubbling out to scheduling canvas
          >
            <DialogHeader className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
              </div>
              <DialogTitle className="text-lg font-bold text-neutral-900">
                Critical / Urgent Appointment Action Required
              </DialogTitle>
              <DialogDescription className="text-sm text-neutral-500">
                You are about to modify a high-priority, urgent, or critically
                conflicted appointment for{" "}
                <strong className="text-neutral-800">{apt.patient.name}</strong>
                . Please ensure you have reviewed doctor availabilities before
                continuing.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => setIsWarningOpen(false)}
                className="flex-1 rounded-xl text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmUrgentEdit}
                disabled={countdown > 0}
                className={cn(
                  "flex-1 rounded-xl text-xs font-semibold text-white transition-all",
                  countdown > 0
                    ? "bg-red-400 opacity-60 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700",
                )}
              >
                {countdown > 0
                  ? `Confirm (${countdown}s)`
                  : "Confirm & Proceed"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}
