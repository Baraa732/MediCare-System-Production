import { Check, DoorClosed, DoorOpen } from "lucide-react";
import type { ClinicHoursDay } from "@/lib/api/schedule";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { DAY_NAMES, DAY_SHORT, durationHours } from "./scheduleUtils";

type ClinicHoursBoardProps = {
  hours: ClinicHoursDay[];
  selectedDayOfWeek: number;
  dirty: boolean;
  saving: boolean;
  onSelectDay: (dayOfWeek: number) => void;
  onChange: (dayOfWeek: number, patch: Partial<ClinicHoursDay>) => void;
  onSave: () => void;
  onReset?: () => void;
};

export function ClinicHoursBoard({
  hours,
  selectedDayOfWeek,
  dirty,
  saving,
  onSelectDay,
  onChange,
  onSave,
  onReset,
}: ClinicHoursBoardProps) {
  return (
    <section className="pbi-panel">
      <header className="pbi-panel-header">
        <div className="min-w-0">
          <h2 className="pbi-panel-title">Clinic operating hours</h2>
          <p className="pbi-panel-subtitle">
            Primary weekly template — booking and doctor slots respect these windows
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirty && (
            <span className="pbi-status-pill bg-amber-50 text-amber-800 border border-amber-200">
              Unsaved
            </span>
          )}
          {onReset && dirty && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-semibold text-[#929296] hover:text-[#1a1b1e] px-2 py-1.5"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={onSave}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-xs font-semibold transition-colors",
              dirty
                ? "bg-[#0066ff] text-white hover:bg-[#0052cc]"
                : "bg-[#f3f2f1] text-[#929296] cursor-not-allowed",
            )}
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save hours"}
          </button>
        </div>
      </header>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
          {hours.map((day) => {
            const selected = day.dayOfWeek === selectedDayOfWeek;
            const closed = Boolean(day.isClosed);
            const span = closed ? null : durationHours(day.openTime, day.closeTime);

            return (
              <article
                key={day.dayOfWeek}
                className={cn(
                  "rounded-sm border transition-all",
                  selected
                    ? "border-[#0066ff] ring-2 ring-[#0066ff]/15 bg-[#ecf3ff]/40"
                    : "border-[#e1dfdd] bg-white hover:border-[#c7dcff]",
                  closed && !selected && "bg-[#faf9f8]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectDay(day.dayOfWeek)}
                  className="w-full text-left px-3 pt-3 pb-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#929296]">
                        {DAY_SHORT[day.dayOfWeek]}
                      </p>
                      <p
                        className={cn(
                          "text-sm font-semibold mt-0.5",
                          selected ? "text-[#0066ff]" : "text-[#1a1b1e]",
                        )}
                      >
                        {DAY_NAMES[day.dayOfWeek]}
                      </p>
                    </div>
                    {closed ? (
                      <DoorClosed className="w-4 h-4 text-[#929296]" />
                    ) : (
                      <DoorOpen className="w-4 h-4 text-[#0066ff]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#929296] mt-2 tabular-nums">
                    {closed ? "Closed" : `${day.openTime} – ${day.closeTime}`}
                    {!closed && span != null ? ` · ${span}h` : ""}
                  </p>
                </button>

                <div className="px-3 pb-3 space-y-2 border-t border-[#f3f2f1] pt-2.5">
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-xs font-medium text-[#1a1b1e]">
                      {closed ? "Closed" : "Open"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!closed}
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
                  </label>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#929296] mb-1">
                        Open
                      </p>
                      <Input
                        type="time"
                        value={day.openTime}
                        disabled={closed}
                        onChange={(e) => onChange(day.dayOfWeek, { openTime: e.target.value })}
                        className="h-8 text-xs px-1.5"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#929296] mb-1">
                        Close
                      </p>
                      <Input
                        type="time"
                        value={day.closeTime}
                        disabled={closed}
                        onChange={(e) => onChange(day.dayOfWeek, { closeTime: e.target.value })}
                        className="h-8 text-xs px-1.5"
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
