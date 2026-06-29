import { Plus } from "lucide-react";
import { useHandleSelection } from "../../hooks";

export function PersistentSelectionArea({
  hasSelectionInColumn,
  selectionHeight,
  selectionTop,
  doctorName,
}: {
  hasSelectionInColumn: boolean;
  selectionHeight: number;
  selectionTop: number;
  doctorName?: string;
}): React.ReactNode {
  const handleCreateAppointment = useHandleSelection(
    (state) => state.handleCreateAppointment,
  );
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
          onClick={(e) => handleCreateAppointment(e, doctorName)}
          className="h-8 px-4 bg-[#0066ff] hover:bg-[#0052cc] active:scale-95 transition-all rounded-lg shadow-sm flex items-center gap-1.5 text-white text-[11px] font-bold cursor-pointer"
        >
          {/* <Plus className="w-3.5 h-3.5 stroke-[3]" /> */}
          <Plus className="w-3.5 h-3.5 stroke-3" />
          <span>New Appointment</span>
        </button>
      </div>
    )
  );
}