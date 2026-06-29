import { addDays, format, isSameDay, startOfToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type ScheduleDatePickerProps = {
  selected: Date;
  onSelect: (date: Date) => void;
  /** Weekdays (0=Sun … 6=Sat) that have doctor availability */
  activeWeekdays?: Set<number>;
};

export function ScheduleDatePicker({
  selected,
  onSelect,
  activeWeekdays,
}: ScheduleDatePickerProps) {
  const today = startOfToday();

  const goPrev = () => onSelect(addDays(selected, -1));
  const goNext = () => onSelect(addDays(selected, 1));
  const goToday = () => onSelect(today);

  return (
    <div className="space-y-3">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={(date) => date && onSelect(date)}
        className="max-w-none w-full shadow-none"
        modifiers={{
          hasAvailability: (date) => activeWeekdays?.has(date.getDay()) ?? false,
        }}
        modifiersClassNames={{
          hasAvailability:
            "after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-[#0066ff]",
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-[#faf9f8] border border-[#e1dfdd] p-0.5 rounded-sm">
          <button
            type="button"
            onClick={goPrev}
            className="p-1.5 hover:bg-white rounded-sm text-[#929296] transition-colors cursor-pointer"
            title="Previous day"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-sm transition-colors cursor-pointer",
              isSameDay(selected, today)
                ? "bg-[#0066ff] text-white"
                : "hover:bg-white text-[#1a1b1e]",
            )}
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            className="p-1.5 hover:bg-white rounded-sm text-[#929296] transition-colors cursor-pointer"
            title="Next day"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
        <p className="text-xs text-[#929296] font-medium truncate">
          {format(selected, "MMM d, yyyy")}
        </p>
      </div>
    </div>
  );
}
