import { Plus } from "lucide-react";
import { useWizardDrawer } from "../../hooks/useWizardDrawer";
import { SLOT_HEIGHT } from "../../data/scheduleGrid";
import { useHandleDatePicker } from "../../hooks";
import { useScheduleGridStore } from "../../hooks/scheduleGridStore";
import {
  absoluteMinutesFromGridSlot,
  slotRangeDurationMinutes,
} from "@/lib/time/gridTime";

interface PersistentSelectionAreaProps {
  hasSelectionInColumn: boolean;
  selectionHeight: number;
  selectionTop: number;
  doctorId: string;     // 👈 نمرر معرّف طبيب العمود هنا
}

export function PersistentSelectionArea({
  hasSelectionInColumn,
  selectionHeight,
  selectionTop,
  doctorId,
}: PersistentSelectionAreaProps): React.ReactNode {
    const selectedDate = useHandleDatePicker((state) => state.date);
  const onOpenNewAppointment = useWizardDrawer((state) => state.onOpenNewAppointment);

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
        className="absolute left-2 right-2 rounded-xl border border-dashed border-[#0066ff]/60 bg-blue-100/50 shadow-xs flex items-center justify-center transition-all duration-75 z-20"
      >
        <button
          onClick={handleTriggerWizardWithSelection}
          className="h-8 px-4 bg-[#0066ff] hover:bg-[#0052cc] active:scale-95 transition-all rounded-lg shadow-sm flex items-center gap-1.5 text-white text-[11px] font-bold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-3" />
        </button>
      </div>
    ) 
  );
}