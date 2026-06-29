import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useHandleDatePicker,
} from "../../hooks/useHandleDatePicker";

export function DateSwitcher() {
  const handlePreviousDay = useHandleDatePicker(
    (state) => state.handlePreviousDay,
  );
  const handleGoToToday = useHandleDatePicker((state) => state.handleGoToToday);
  const handleNextDay = useHandleDatePicker((state) => state.handleNextDay);
  return (
    <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 p-0.5 rounded-lg">
      <button
        onClick={handlePreviousDay}
        className="p-1 hover:bg-white rounded-md text-neutral-500 transition-all hover:shadow-3xs cursor-pointer"
        title="Previous Day"
      >
        <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
      </button>

      <button
        onClick={handleGoToToday}
        className="text-xs font-bold px-2.5 py-1 hover:bg-white rounded-md text-neutral-700 transition-all hover:shadow-3xs cursor-pointer"
      >
        Today
      </button>

      <button
        onClick={handleNextDay}
        className="p-1 hover:bg-white rounded-md text-neutral-500 transition-all hover:shadow-3xs cursor-pointer"
        title="Next Day"
      >
        <ChevronRight className="w-4 h-4 stroke-[2.5]" />
      </button>
    </div>
  );
}
