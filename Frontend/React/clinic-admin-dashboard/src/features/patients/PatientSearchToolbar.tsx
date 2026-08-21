import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ClinicDoctor } from "@/lib/api/types";
import type { PatientSortKey } from "./patientRegistry";
import { cn } from "@/lib/utils";

type PatientSearchToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  doctorFilter: string;
  onDoctorFilterChange: (value: string) => void;
  visitFilter: "ALL" | "UPCOMING" | "RECENT";
  onVisitFilterChange: (value: "ALL" | "UPCOMING" | "RECENT") => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortKey: PatientSortKey;
  onSortChange: (value: PatientSortKey) => void;
  doctors: ClinicDoctor[];
  resultCount: number;
  isSearching: boolean;
};

const visitChips: { id: "ALL" | "UPCOMING" | "RECENT"; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "UPCOMING", label: "Upcoming" },
  { id: "RECENT", label: "Recent visits" },
];

const selectClass =
  "h-8 px-3 border border-[#e1dfdd] rounded-sm bg-white text-xs font-medium text-[#1a1b1e]";

export function PatientSearchToolbar({
  query,
  onQueryChange,
  doctorFilter,
  onDoctorFilterChange,
  visitFilter,
  onVisitFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortKey,
  onSortChange,
  doctors,
  resultCount,
  isSearching,
}: PatientSearchToolbarProps) {
  const hasFilters =
    query.trim() !== "" ||
    doctorFilter !== "ALL" ||
    visitFilter !== "ALL" ||
    statusFilter !== "ALL";

  const clearFilters = () => {
    onQueryChange("");
    onDoctorFilterChange("ALL");
    onVisitFilterChange("ALL");
    onStatusFilterChange("ALL");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#929296]" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search name, phone, or patient ID…"
            className="pl-9 pr-9 h-9 rounded-sm text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#929296] hover:text-[#1a1b1e]"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSearching && (
            <span className="text-[11px] font-semibold text-[#0066ff] animate-pulse">
              Live search
            </span>
          )}
          <span className="text-xs text-[#929296] tabular-nums">{resultCount} results</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-[#e1dfdd] rounded-sm">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#929296] flex items-center gap-1 mr-1">
          <SlidersHorizontal className="w-3 h-3" /> Filters
        </span>

        <div className="flex gap-1 p-0.5 bg-[#f3f2f1] rounded-sm">
          {visitChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onVisitFilterChange(chip.id)}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors",
                visitFilter === chip.id
                  ? "bg-white text-[#0066ff] shadow-sm"
                  : "text-[#929296] hover:text-[#1a1b1e]",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <select
          value={doctorFilter}
          onChange={(e) => onDoctorFilterChange(e.target.value)}
          className={selectClass}
        >
          <option value="ALL">All doctors</option>
          {doctors.map((d) => (
            <option key={d.userId} value={d.userId}>
              {d.fullName ?? d.firstName ?? (d.userId?.slice(0, 8) || "Doctor")}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className={selectClass}
        >
          <option value="ALL">All statuses</option>
          <option value="REQUESTED">Requested</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_SHOW">No show</option>
        </select>

        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as PatientSortKey)}
          className={selectClass}
        >
          <option value="lastVisit">Sort: last visit</option>
          <option value="appointments">Sort: visit count</option>
          <option value="name">Sort: name</option>
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto text-xs font-semibold text-[#0066ff] hover:underline flex items-center gap-1"
          >
            <Filter className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
