import type { ClinicHoursDay } from "@/lib/api/schedule";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DAY_SHORT } from "./scheduleUtils";

type WeeklyHoursStripProps = {
  hours: ClinicHoursDay[];
  selectedDayOfWeek: number;
  dirty: boolean;
  onSelectDay: (dayOfWeek: number) => void;
  onChange: (dayOfWeek: number, patch: Partial<ClinicHoursDay>) => void;
};

export function WeeklyHoursStrip({
  hours,
  selectedDayOfWeek,
  dirty,
  onSelectDay,
  onChange,
}: WeeklyHoursStripProps) {
  return (
    <section className="pbi-panel">
      <header className="pbi-panel-header">
        <div className="min-w-0">
          <h2 className="pbi-panel-title">Weekly clinic hours</h2>
          <p className="pbi-panel-subtitle">
            Open windows shape the calendar background — save when you change them
          </p>
        </div>
        {dirty && (
          <span className="pbi-status-pill bg-amber-50 text-amber-800 border border-amber-200">
            Unsaved
          </span>
        )}
      </header>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[720px] divide-x divide-[#edebe9]">
          {hours.map((day) => {
            const selected = day.dayOfWeek === selectedDayOfWeek;
            const closed = Boolean(day.isClosed);
            return (
              <div
                key={day.dayOfWeek}
                className={cn(
                  "p-2.5 space-y-2 transition-colors",
                  selected && "bg-[#ecf3ff]/50",
                  closed && !selected && "bg-[#faf9f8]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectDay(day.dayOfWeek)}
                  className={cn(
                    "w-full text-left text-xs font-semibold",
                    selected ? "text-[#0066ff]" : "text-[#1a1b1e]",
                  )}
                >
                  {DAY_SHORT[day.dayOfWeek]}
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!closed}
                  aria-label={`${DAY_SHORT[day.dayOfWeek]} open`}
                  onClick={() => onChange(day.dayOfWeek, { isClosed: !closed })}
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    closed ? "bg-[#d2d0ce]" : "bg-[#0066ff]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                      !closed && "translate-x-4",
                    )}
                  />
                </button>
                <p className="text-[10px] font-medium text-[#929296]">
                  {closed ? "Closed" : "Open"}
                </p>
                <Input
                  type="time"
                  value={day.openTime}
                  disabled={closed}
                  onChange={(e) => onChange(day.dayOfWeek, { openTime: e.target.value })}
                  className="h-7 text-[11px] px-1"
                />
                <Input
                  type="time"
                  value={day.closeTime}
                  disabled={closed}
                  onChange={(e) => onChange(day.dayOfWeek, { closeTime: e.target.value })}
                  className="h-7 text-[11px] px-1"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
