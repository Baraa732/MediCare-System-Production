import * as React from "react";
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
  type DayPickerProps,
  type Locale,
} from "react-day-picker";
import { format, setMonth, setYear } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react";

type CalendarProps = Extract<DayPickerProps, { mode: "single" }> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  formatters,
  components,
  buttonVariant: _buttonVariant,
  selected,
  onSelect,
  ...props
}: CalendarProps) {
  const [viewMode, setViewMode] = React.useState<"days" | "months">("days");
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    () => (selected instanceof Date ? selected : new Date()),
  );

  React.useEffect(() => {
    if (selected instanceof Date) {
      setCurrentMonth(selected);
    }
  }, [selected]);

  const displayHeaderDate = selected instanceof Date ? selected : currentMonth;
  const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const startYear = 2020;
  const years = Array.from({ length: 16 }, (_, i) => startYear + i);

  const handlePrev = () => {
    if (viewMode === "days") {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    } else {
      setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "days") {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    } else {
      setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1));
    }
  };

  return (
    <div
      className={cn(
        "p-0 bg-white rounded-sm overflow-hidden shadow-sm border border-[#e1dfdd] w-full max-w-[290px] select-none",
        className,
      )}
    >
      <div className="bg-[#0066ff] px-5 py-4 text-white flex flex-col justify-start items-start gap-0.5">
        <span className="text-[11px] opacity-75 font-bold tracking-wider">
          {format(displayHeaderDate, "yyyy")}
        </span>
        <span className="text-lg font-bold">{format(displayHeaderDate, "EEE, MMM d")}</span>
      </div>

      <div className="flex items-center justify-between px-4 pt-3 pb-1 relative z-20">
        <Button
          variant="ghost"
          className="h-8 w-8 p-0 text-[#0066ff] hover:bg-[#ecf3ff] rounded-sm cursor-pointer flex items-center justify-center"
          onClick={handlePrev}
          type="button"
        >
          <ChevronLeftIcon className="h-4 w-4 stroke-[3]" />
        </Button>

        <button
          type="button"
          onClick={() => setViewMode(viewMode === "days" ? "months" : "days")}
          className="flex items-center gap-1 text-xs font-bold text-[#1a1b1e] bg-[#f3f2f1] hover:bg-[#edebe9] px-2.5 py-1.5 rounded-sm transition-all border border-[#e1dfdd]"
        >
          <span>
            {viewMode === "days"
              ? format(currentMonth, "MMMM yyyy")
              : format(currentMonth, "yyyy")}
          </span>
          <ChevronDownIcon
            className={cn(
              "h-3 w-3 text-[#929296] stroke-[2.5] transition-transform",
              viewMode === "months" && "rotate-180",
            )}
          />
        </button>

        <Button
          variant="ghost"
          className="h-8 w-8 p-0 text-[#0066ff] hover:bg-[#ecf3ff] rounded-sm cursor-pointer flex items-center justify-center"
          onClick={handleNext}
          type="button"
        >
          <ChevronRightIcon className="h-4 w-4 stroke-[3]" />
        </Button>
      </div>

      <div className="p-3 pt-0 relative min-h-[240px]">
        {viewMode === "days" && (
          <DayPicker
            {...({
              ...props,
              mode: "single",
              showOutsideDays,
              month: currentMonth,
              onMonthChange: setCurrentMonth,
              selected,
              onSelect,
              locale,
              className: "m-0 p-0",
              classNames: {
                root: "w-full",
                months: "w-full",
                month: "flex w-full flex-col gap-2",
                month_caption: "hidden",
                nav: "hidden",
                month_grid: "w-full border-collapse mt-1",
                weekdays: "flex justify-between mb-1",
                weekday:
                  "w-9 text-[11px] font-bold uppercase tracking-widest text-[#929296] text-center",
                week: "flex w-full justify-between mt-1",
                day: "group/day relative aspect-square h-9 w-9 rounded-full p-0 text-center flex items-center justify-center",
                today:
                  "rounded-full bg-[#ecf3ff] text-[#0066ff] border border-[#c7dcff] font-bold",
                outside: "text-[#929296] opacity-40",
                disabled: "text-[#929296] opacity-50 line-through",
                hidden: "invisible",
                ...classNames,
              },
              components: {
                DayButton: ({ ...dayProps }) => (
                  <CalendarDayButton locale={locale} {...dayProps} />
                ),
                ...components,
              },
            } as React.ComponentProps<typeof DayPicker>)}
          />
        )}

        {viewMode === "months" && (
          <div className="flex gap-2 pt-2 animate-in fade-in duration-200">
            <div className="grid grid-cols-3 gap-x-2 gap-y-3 flex-1">
              {monthsShort.map((monthLabel, index) => {
                const isSelectedMonth = currentMonth.getMonth() === index;
                return (
                  <button
                    key={monthLabel}
                    type="button"
                    onClick={() => {
                      setCurrentMonth(setMonth(currentMonth, index));
                      setViewMode("days");
                    }}
                    className={cn(
                      "h-11 w-11 rounded-full text-xs font-semibold flex items-center justify-center border transition-all cursor-pointer",
                      isSelectedMonth
                        ? "bg-[#0066ff] text-white border-[#0066ff] shadow-sm font-bold"
                        : "bg-white text-[#1a1b1e] border-[#e1dfdd] hover:bg-black/50 hover:text-white hover:scale-105",
                    )}
                  >
                    {monthLabel}
                  </button>
                );
              })}
            </div>

            <div className="w-[75px] border-l border-[#edebe9] pl-1.5 flex flex-col gap-1 max-h-[175px] overflow-y-auto no-scrollbar pr-0.5">
              {years.map((year) => {
                const isSelectedYear = currentMonth.getFullYear() === year;
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setCurrentMonth(setYear(currentMonth, year))}
                    className={cn(
                      "w-full text-left px-2 py-1 rounded-sm text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                      isSelectedYear
                        ? "bg-[#ecf3ff] text-[#0066ff] font-bold border-l-2 border-[#0066ff]"
                        : "text-[#929296] hover:bg-[#f3f2f1] hover:text-[#1a1b1e]",
                    )}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames();
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      className={cn(
        "relative flex aspect-square h-8 w-8 rounded-full items-center justify-center border-0 leading-none font-semibold transition-all cursor-pointer text-center text-[#1a1b1e] text-xs",
        "hover:bg-black/50 hover:text-white hover:scale-105",
        "data-[selected-single=true]:bg-[#0066ff] data-[selected-single=true]:text-white data-[selected-single=true]:font-bold data-[selected-single=true]:shadow-sm data-[selected-single=true]:hover:bg-[#0066ff]",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar };
