import type { ExistingBookedProps } from "@/features/dashboardAssitant/types";
import { ROW_MINUTES, SLOT_HEIGHT } from "../../../data/scheduleGrid";
import { useEditeMode, useRedLine } from "../../../hooks";
import { AppointmentCard } from ".";
import { useGlobalConflictStore } from "@/features/dashboardAssitant/hooks/useGlobalConflictStore";
// 🚀 استهلاك متجر التضاربات لمنع تعتيم العناصر المتنازعة

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

  const conflictPayload = useGlobalConflictStore(
    (state) => state.conflictPayload,
  );
  const isTargetColumn = overSlotInfo?.docId === docId;
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

      {columnAppointments
        .filter((apt) => apt && apt.id && Number.isFinite(apt.start) && Number.isFinite(apt.end))
        .map((apt) => {
        const isCardConflicting = conflictPayload?.conflictingItems.some(
          (c) => c.appointmentId === apt.id,
        );
        const shouldDim =
          conflictPayload && isTargetColumn && !isCardConflicting;

        return (
          <div
            key={apt.id}
            className="transition-all duration-200"
            style={{
              opacity: shouldDim ? 0.25 : 1,
              zIndex: shouldDim ? -1 : 60,
            }}
          >
            <AppointmentCard
              apt={apt}
              isEditMode={isEditMode}
              currentMinutesSinceGridStart={currentMinutesSinceGridStart}             />
          </div>
        );
      })}
    </>
  );
}
