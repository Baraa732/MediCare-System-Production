import { Plus } from "lucide-react";
import { useWizardDrawer } from "../../hooks/useWizardDrawer";
import { SLOT_HEIGHT } from "../../data/scheduleGrid";
import { useHandleDatePicker } from "../../hooks";
import { useScheduleGridStore } from "../../hooks/scheduleGridStore";
import {
  absoluteMinutesFromGridSlot,
  slotRangeDurationMinutes,
} from "@/lib/time/gridTime";
import { isClinicDateBeforeToday } from "../../utils/editModeDrag";
import { isClinicDateClosed } from "../../utils/clinicDayStatus";

interface PersistentSelectionAreaProps {
  hasSelectionInColumn: boolean;
  selectionHeight: number;
  selectionTop: number;
  doctorId: string;
}

export function PersistentSelectionArea({
  hasSelectionInColumn,
  selectionHeight,
  selectionTop,
  doctorId,
}: PersistentSelectionAreaProps): React.ReactNode {
  const selectedDate = useHandleDatePicker((state) => state.date);
  const onOpenNewAppointment = useWizardDrawer(
    (state) => state.onOpenNewAppointment,
  );

  const store = useScheduleGridStore.getState();
  if (
    isClinicDateBeforeToday(selectedDate) ||
    isClinicDateClosed(selectedDate, store.clinicHours, store.scheduleBlocks)
  ) {
    return null;
  }

  const handleTriggerWizardWithSelection = () => {
    const startSlot = Math.round(selectionTop / SLOT_HEIGHT);
    const slotCount = Math.max(1, Math.round(selectionHeight / SLOT_HEIGHT));
    const endSlot = startSlot + slotCount - 1;
    const doctor = useScheduleGridStore
      .getState()
      .doctors.find((d) => d.id === doctorId);

    onOpenNewAppointment({
      doctorId,
      doctorName: doctor?.name,
      timeSlot: absoluteMinutesFromGridSlot(startSlot),
      duration: slotRangeDurationMinutes(startSlot, endSlot),
      date: selectedDate,
      startSlot,
      endSlot,
      fromGridSelection: true,
    });
  };

  return (
    hasSelectionInColumn &&
    selectionHeight > 0 && (
      <div
        style={{
          top: selectionTop + 3,
          height: selectionHeight - 6,
        }}
        className="absolute left-2 right-2 z-20 flex items-center justify-center rounded-xl border border-dashed border-[#0066ff]/60 bg-blue-100/50 shadow-xs transition-all duration-75"
      >
        <button
          onClick={handleTriggerWizardWithSelection}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[#0066ff] px-4 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-[#0052cc] active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 stroke-3" />
        </button>
      </div>
    )
  );
}
