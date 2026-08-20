import { useMemo } from "react";
import {
  Check,
  FileText,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduleContext } from "../../context/ScheduleContext";
import { useScheduleGridStore } from "../../hooks/scheduleGridStore";
import {
  FILTER_PRESETS,
  FILTER_STATUS_OPTIONS,
  TIME_OF_DAY_OPTIONS,
  countActiveScheduleFilters,
  type GenderFilter,
  type NotesFilter,
} from "../../utils/scheduleFilters";
import type { ComplexityType } from "../../CreateAppointmentWizard/useAppointmentWizard";

const COMPLEXITY_OPTIONS: { key: ComplexityType; label: string }[] = [
  { key: "standard", label: "Standard" },
  { key: "complex", label: "Complex" },
  { key: "elderly", label: "Elderly" },
  { key: "urgent", label: "Urgent" },
];

export function AdvancedFilterTrigger() {
  const open = useScheduleGridStore((s) => s.filterPanelOpen);
  const setOpen = useScheduleGridStore((s) => s.setFilterPanelOpen);
  const filters = useScheduleGridStore((s) => s.filters);
  const active = countActiveScheduleFilters(filters);

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "relative flex h-9.5 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-all",
        open || active > 0
          ? "border-[#0066ff]/40 bg-blue-50 text-[#0052cc] shadow-sm"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50",
      )}
      aria-expanded={open}
      aria-label="Advanced filters"
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Filters</span>
      {active > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-[#0066ff] px-1 text-[10px] font-black text-white">
          {active}
        </span>
      ) : (
        <Filter className="h-3.5 w-3.5 opacity-50 sm:hidden" />
      )}
    </button>
  );
}

export function AdvancedFilterPanel() {
  const open = useScheduleGridStore((s) => s.filterPanelOpen);
  const setOpen = useScheduleGridStore((s) => s.setFilterPanelOpen);
  const filters = useScheduleGridStore((s) => s.filters);
  const toggleStatus = useScheduleGridStore((s) => s.toggleStatus);
  const toggleDoctor = useScheduleGridStore((s) => s.toggleDoctor);
  const toggleComplexity = useScheduleGridStore((s) => s.toggleComplexity);
  const setFilters = useScheduleGridStore((s) => s.setFilters);
  const applyPreset = useScheduleGridStore((s) => s.applyPreset);
  const resetFilters = useScheduleGridStore((s) => s.resetFilters);
  const { doctors } = useScheduleContext();
  const active = countActiveScheduleFilters(filters);

  const doctorOptions = useMemo(
    () =>
      doctors.map((d) => ({
        id: d.id,
        name: d.name,
        count: d.appointments.length,
      })),
    [doctors],
  );

  if (!open) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-2 absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)] duration-200">
      <div className="flex items-center justify-between border-b border-neutral-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0066ff] text-white shadow-sm">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900">Advanced filters</p>
            <p className="text-[11px] font-medium text-neutral-500">
              Filter the whole dashboard — grid, doctors, and pending requests
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {active > 0 ? (
            <button
              type="button"
              onClick={() => resetFilters()}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-bold text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close filters"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[min(70vh,520px)] space-y-5 overflow-y-auto p-4">
        {/* Presets */}
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            <Sparkles className="h-3.5 w-3.5" />
            Smart presets
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.description}
                onClick={() => applyPreset(preset.id)}
                className="rounded-full border border-neutral-200 bg-neutral-50/80 px-3 py-1.5 text-[11px] font-semibold text-neutral-700 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-[#0052cc]"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        {/* Status */}
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Status
          </p>
          <div className="flex flex-wrap gap-2">
            {FILTER_STATUS_OPTIONS.map((opt) => {
              const on = filters.statuses.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleStatus(opt.key)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                    on
                      ? "border-[#0066ff]/35 bg-blue-50 text-[#0052cc] shadow-sm"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", opt.swatch)} />
                  {opt.label}
                  {on ? <Check className="h-3 w-3" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* Time of day */}
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Time of day
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIME_OF_DAY_OPTIONS.map((opt) => {
              const on = filters.timeOfDay === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFilters({ timeOfDay: opt.key })}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-all",
                    on
                      ? "border-[#0066ff]/40 bg-blue-50 shadow-sm"
                      : "border-neutral-200 bg-white hover:border-neutral-300",
                  )}
                >
                  <span
                    className={cn(
                      "block text-xs font-bold",
                      on ? "text-[#0052cc]" : "text-neutral-800",
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-medium text-neutral-400">
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Doctors */}
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Doctors
          </p>
          <div className="flex flex-wrap gap-2">
            {doctorOptions.length === 0 ? (
              <p className="text-xs text-neutral-400">No doctors on this day.</p>
            ) : (
              doctorOptions.map((doc) => {
                const on = filters.doctorIds.includes(doc.id);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => toggleDoctor(doc.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                      on
                        ? "border-[#0066ff]/35 bg-blue-50 text-[#0052cc]"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                    )}
                  >
                    <UserRound className="h-3.5 w-3.5 opacity-60" />
                    <span className="max-w-[140px] truncate">{doc.name}</span>
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500">
                      {doc.count}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Patient / notes / complexity */}
        <div className="grid gap-4 sm:grid-cols-3">
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Gender
            </p>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  ["any", "Any"],
                  ["Male", "Male"],
                  ["Female", "Female"],
                ] as const
              ).map(([key, label]) => (
                <SegmentOption
                  key={key}
                  active={filters.gender === key}
                  label={label}
                  onClick={() => setFilters({ gender: key as GenderFilter })}
                />
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Notes
            </p>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  ["any", "Any"],
                  ["with", "Has notes"],
                  ["without", "No notes"],
                ] as const
              ).map(([key, label]) => (
                <SegmentOption
                  key={key}
                  active={filters.notes === key}
                  label={label}
                  icon={key === "with" ? FileText : undefined}
                  onClick={() => setFilters({ notes: key as NotesFilter })}
                />
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Complexity
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COMPLEXITY_OPTIONS.map((opt) => {
                const on = filters.complexities.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleComplexity(opt.key)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-all",
                      on
                        ? "border-[#0066ff]/35 bg-blue-50 text-[#0052cc]"
                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/70 px-3.5 py-3">
          <div>
            <p className="text-xs font-bold text-neutral-800">
              Hide empty doctor columns
            </p>
            <p className="text-[11px] text-neutral-500">
              Only show doctors with matching appointments
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={filters.hideEmptyDoctors}
            onClick={() =>
              setFilters({ hideEmptyDoctors: !filters.hideEmptyDoctors })
            }
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              filters.hideEmptyDoctors ? "bg-[#0066ff]" : "bg-neutral-300",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                filters.hideEmptyDoctors ? "left-[22px]" : "left-0.5",
              )}
            />
          </button>
        </label>
      </div>
    </div>
  );
}

function SegmentOption({
  active,
  label,
  onClick,
  icon: Icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon?: typeof FileText;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-all",
        active
          ? "border-[#0066ff]/35 bg-blue-50 text-[#0052cc]"
          : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
      )}
    >
      {Icon ? <Icon className="h-3 w-3 opacity-70" /> : null}
      {label}
      {active ? <Check className="ml-auto h-3 w-3" /> : null}
    </button>
  );
}
