import type { ExistingBookedProps } from "@/features/dashboardAssitant/types";
import { useEditeMode } from "../../../hooks";
import { AppointmentCard } from ".";
import { useGlobalConflictStore } from "@/features/dashboardAssitant/hooks/useGlobalConflictStore";
import { useScheduleContext } from "@/features/dashboardAssitant/context/ScheduleContext";
import { clinicNowGridMinutes } from "@/features/dashboardAssitant/utils/editModeDrag";

export function ExistingBooked({
  columnAppointments,
  docId,
  overSlotInfo,
}: ExistingBookedProps) {
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const selectedDate = useScheduleContext().selectedDate;
  const currentMinutesSinceGridStart = clinicNowGridMinutes(selectedDate);

  const conflictPayload = useGlobalConflictStore(
    (state) => state.conflictPayload,
  );
  const isTargetColumn = overSlotInfo?.docId === docId;
  return (
    <>
      {overSlotInfo && overSlotInfo.docId === docId && (
        <div
          className="pointer-events-none absolute right-2 left-2 z-0 rounded-xl border-2 border-dashed border-blue-400/40 bg-blue-500/5 transition-all duration-75"
          style={{
            top: overSlotInfo.top + 3,
            height: overSlotInfo.height - 6,
          }}
        />
      )}

      {columnAppointments
        .filter(
          (apt) =>
            apt && apt.id && Number.isFinite(apt.start) && Number.isFinite(apt.end),
        )
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
                zIndex: shouldDim ? 10 : 60,
              }}
            >
              <AppointmentCard
                apt={apt}
                isEditMode={isEditMode}
                currentMinutesSinceGridStart={currentMinutesSinceGridStart}
              />
            </div>
          );
        })}
    </>
  );
}
