import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import {
  ROW_MINUTES,
  SLOT_HEIGHT,
  START_TIME_MINUTES,
} from "../../data/scheduleGrid";
import { useEditeMode, useRedLine } from "../../hooks";
import { useAppointmentDrawer } from "../../hooks/useAppointmentDrawer";
import { GripVertical, Lock } from "lucide-react";

interface ExtendedAppointmentType {
  id: string;
  start: number;
  end: number;
  docId: string;
  status: string;
  title?: string;
  patientName?: string;
  patient?: { name: string };
}

interface ExistingBookedProps {
  columnAppointments: ExtendedAppointmentType[];
  docId: string;
  overSlotInfo?: {
    docId: string;
    slotIdx: number;
    top: number;
    height: number;
  } | null;
}

// مكون كارت الحجز المستقل لحماية قواعد الـ Hooks ومنع الأخطاء البرمجية
function AppointmentCard({
  apt,
  isEditMode,
  currentMinutesSinceGridStart,
}: {
  apt: ExtendedAppointmentType;
  isEditMode: boolean;
  currentMinutesSinceGridStart: number;
}) {
  const openDrawer = useAppointmentDrawer((s) => s.open);
  const topOffset = (apt.start / ROW_MINUTES) * SLOT_HEIGHT;
  const cardHeight = ((apt.end - apt.start) / ROW_MINUTES) * SLOT_HEIGHT;

  // الشرط الذكي المعتمد على إحداثيات الخط الأحمر المتزامن الخاص بك
  const isPastAppointment = apt.start <= currentMinutesSinceGridStart;

  // معالجة الأيقونات والوضعية البرمجية الدقيقة للتصميم
  const showLockIcon = isEditMode && isPastAppointment;
  const showGripHandle = isEditMode && !isPastAppointment;
  const isDragDisabled = !isEditMode || isPastAppointment;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apt.id,
    data: {
      type: "appointment",
      appointmentData: apt,
    },
    disabled: isDragDisabled,
  });

  const startH = Math.floor((START_TIME_MINUTES + apt.start) / 60) % 24;
  const startM = (START_TIME_MINUTES + apt.start) % 60;
  const endH = Math.floor((START_TIME_MINUTES + apt.end) / 60) % 24;
  const endM = (START_TIME_MINUTES + apt.end) % 60;

  const formatTimeLabel = (h: number, m: number) => {
    const displayH = h === 0 || h === 12 ? 12 : h % 12;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${displayH}:${m === 0 ? "00" : m < 10 ? "0" + m : m} ${ampm}`;
  };

  // معالجة النصوص لاستخراج الاسم ونوع الكشف بشكل ديناميكي لتفادي الهاردكود

  const appointement: {
    patientName: string;
    visitType: string;
  } = {
    patientName: "Unknown Patient",
    visitType: "General Consultation",
  };

  if (apt.title && apt.title.includes(" - ")) {
    const parts = apt.title.split(" - ");
    appointement.patientName = parts[0].trim();
    appointement.visitType = parts[1].trim();
  } else if (apt.title) {
    appointement.patientName = apt.title;
  } else {
    appointement.patientName = apt.patientName || apt.patient?.name || "Patient";
  }

  return (
    <div
      ref={setNodeRef}
      {...(!isDragDisabled ? listeners : {})}
      {...attributes}
      onClick={() => {
        if (!isEditMode && !isDragging) openDrawer(apt.id);
      }}
      style={{
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

        // الألوان والخلفيات الأصلية المتوافقة مع الحالات
        apt.status === "confirmed" &&
          "bg-[#E2F1FF] border-blue-200/80 text-[#0055cc]",
        apt.status === "urgent" && "bg-red-50 border-red-200/80 text-red-700",
        apt.status === "in_progress" &&
          "bg-purple-50 border-purple-200/80 text-purple-700",
        apt.status === "late" &&
          "bg-amber-50 border-amber-200/80 text-amber-700",
        apt.status === "unavailable" &&
          "bg-neutral-50 border-neutral-200 text-neutral-400 line-through opacity-75",
      )}
    >
      {/* المقبض الجانبي المتحرك: يتمدد بـ w-8 في التعديل وينكمش إلى w-0 في العرض العادي */}
      <div
        className={cn(
          "flex items-center justify-center shrink-0 border-r transition-all duration-350 ease-in-out bg-black/[0.02]",
          isEditMode
            ? "w-8 opacity-100"
            : "w-0 opacity-0 pointer-events-none border-r-transparent",

          apt.status === "confirmed" && "border-blue-200/50",
          apt.status === "urgent" && "border-red-200/50",
          apt.status === "in_progress" && "border-purple-200/50",
          apt.status === "late" && "border-amber-200/50",
          apt.status === "unavailable" && "border-neutral-200/50",
        )}
      >
        {showGripHandle && (
          <GripVertical
            className={cn(
              "w-4 h-4 shrink-0 text-current opacity-70 group-hover:opacity-100 transition-all duration-350",
              isEditMode ? "scale-100 rotate-0" : "scale-75 -rotate-45",
            )}
          />
        )}
        {showLockIcon && (
          <Lock
            className={cn(
              "w-4 h-4 shrink-0 text-neutral-400 opacity-60 transition-all duration-350",
              isEditMode ? "scale-100" : "scale-75",
            )}
          />
        )}
      </div>

      {/* حاوية المحتوى والمعلومات المكتوبة */}
      <div className="flex-1 p-3 flex flex-col justify-between text-xs min-w-0 transition-all duration-350">
        <div className="flex items-start gap-1.5 min-w-0">
          {/* النقطة الحمراء للمواعيد المستعجلة - تختفي في التعديل لراحة بصرية أفضل */}
          <div
            className={cn(
              "transition-all duration-200 overflow-hidden",
              apt.status === "urgent" && !showLockIcon && !showGripHandle
                ? "w-1.5 opacity-100 mr-1"
                : "w-0 opacity-0 mr-0",
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 block mt-1.5 shrink-0" />
          </div>

          <div className="min-w-0 flex-1">
            <h5 className="font-bold truncate leading-none text-neutral-900 transition-colors text-[13px]">
              {appointement.patientName}
            </h5>
            <p className="text-[11px] font-normal text-neutral-500 mt-1 truncate leading-tight">
              {appointement.visitType}
            </p>
            <p className="text-[10px] font-semibold opacity-75 mt-1.5 leading-none truncate">
              {formatTimeLabel(startH, startM)} - {formatTimeLabel(endH, endM)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExistingBooked({
  columnAppointments,
  docId,
  overSlotInfo,
}: ExistingBookedProps) {
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const timeLineTop = useRedLine((state) => state.timeLineTop);

  // حساب الدقائق المحدثة المأخوذة مباشرة من هوك الخط الزمني الخاص بك لتوحيد دقة البيانات
  const currentMinutesSinceGridStart =
    (timeLineTop / SLOT_HEIGHT) * ROW_MINUTES;

  return (
    <>
      {/* التظليل التوقعي السلس عند تحليق بطاقة السحب فوق خانة طبيب فارغة */}
      {overSlotInfo && overSlotInfo.docId === docId && (
        <div
          className="absolute left-2 right-2 rounded-xl bg-blue-500/5 border-2 border-dashed border-blue-400/30 z-0 pointer-events-none transition-all duration-75"
          style={{
            top: overSlotInfo.top + 3,
            height: overSlotInfo.height - 6,
          }}
        />
      )}

      {columnAppointments.map((apt) => (
        <AppointmentCard
          key={apt.id}
          apt={apt}
          isEditMode={isEditMode}
          currentMinutesSinceGridStart={currentMinutesSinceGridStart}
        />
      ))}
    </>
  );
}
