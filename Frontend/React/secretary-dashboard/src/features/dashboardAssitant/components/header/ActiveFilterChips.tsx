import { X } from "lucide-react";
import { useScheduleContext } from "../../context/ScheduleContext";
import { useScheduleGridStore } from "../../hooks/scheduleGridStore";
import {
  FILTER_STATUS_OPTIONS,
  TIME_OF_DAY_OPTIONS,
  countActiveScheduleFilters,
} from "../../utils/scheduleFilters";

export function ActiveFilterChips() {
  const filters = useScheduleGridStore((s) => s.filters);
  const setFilters = useScheduleGridStore((s) => s.setFilters);
  const toggleStatus = useScheduleGridStore((s) => s.toggleStatus);
  const toggleDoctor = useScheduleGridStore((s) => s.toggleDoctor);
  const toggleComplexity = useScheduleGridStore((s) => s.toggleComplexity);
  const resetFilters = useScheduleGridStore((s) => s.resetFilters);
  const setSearchQuery = useScheduleGridStore((s) => s.setSearchQuery);
  const { doctors } = useScheduleContext();

  const active = countActiveScheduleFilters(filters);
  const hasQuery = filters.query.trim().length > 0;
  if (active === 0 && !hasQuery) return null;

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (hasQuery) {
    chips.push({
      key: "q",
      label: `Name/phone: “${filters.query.trim()}”`,
      onRemove: () => setSearchQuery(""),
    });
  }

  for (const status of filters.statuses) {
    const meta = FILTER_STATUS_OPTIONS.find((s) => s.key === status);
    chips.push({
      key: `st-${status}`,
      label: meta?.label ?? status,
      onRemove: () => toggleStatus(status),
    });
  }

  if (filters.timeOfDay !== "any") {
    const meta = TIME_OF_DAY_OPTIONS.find((t) => t.key === filters.timeOfDay);
    chips.push({
      key: "tod",
      label: meta?.label ?? filters.timeOfDay,
      onRemove: () => setFilters({ timeOfDay: "any" }),
    });
  }

  for (const id of filters.doctorIds) {
    const doc = doctors.find((d) => d.id === id);
    chips.push({
      key: `doc-${id}`,
      label: doc?.name ?? "Doctor",
      onRemove: () => toggleDoctor(id),
    });
  }

  if (filters.gender !== "any") {
    chips.push({
      key: "gender",
      label: `Gender: ${filters.gender}`,
      onRemove: () => setFilters({ gender: "any" }),
    });
  }

  if (filters.notes !== "any") {
    chips.push({
      key: "notes",
      label: filters.notes === "with" ? "Has notes" : "No notes",
      onRemove: () => setFilters({ notes: "any" }),
    });
  }

  for (const c of filters.complexities) {
    chips.push({
      key: `cx-${c}`,
      label: c,
      onRemove: () => toggleComplexity(c),
    });
  }

  if (!filters.hideEmptyDoctors) {
    chips.push({
      key: "empty",
      label: "Show empty columns",
      onRemove: () => setFilters({ hideEmptyDoctors: true }),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200/70 bg-white/80 px-4 py-2 backdrop-blur-sm sm:px-6">
      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        Active
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="group inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50/90 px-2.5 py-1 text-[11px] font-semibold text-[#0052cc] transition-colors hover:border-blue-200 hover:bg-blue-100"
        >
          <span className="max-w-[180px] truncate capitalize">{chip.label}</span>
          <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => resetFilters()}
        className="ml-auto text-[11px] font-bold text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
