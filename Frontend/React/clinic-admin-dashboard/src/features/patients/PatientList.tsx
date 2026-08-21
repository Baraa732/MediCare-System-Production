import { format, parseISO } from "date-fns";
import { Loader2, Search } from "lucide-react";
import {
  patientDisplayName,
  shortId,
  type PatientRegistryItem,
} from "./patientRegistry";
import { cn } from "@/lib/utils";

type PatientListProps = {
  patients: PatientRegistryItem[];
  selectedId: string | null;
  loading: boolean;
  searching: boolean;
  onSelect: (patient: PatientRegistryItem) => void;
};

export function PatientList({
  patients,
  selectedId,
  loading,
  searching,
  onSelect,
}: PatientListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#929296] text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading patients…
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <Search className="w-8 h-8 text-[#929296] mb-3 opacity-60" />
        <p className="text-sm font-semibold text-[#1a1b1e]">No patients match</p>
        <p className="text-xs text-[#929296] mt-1">
          Try another filter or search by full phone number.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#f3f2f1]">
      {searching && (
        <div className="px-4 py-2 bg-[#ecf3ff]/50 text-xs text-[#0066ff] font-medium flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Searching registry…
        </div>
      )}
      {patients.map((patient) => {
        const isSelected = patient.patientId === selectedId;
        const name = patientDisplayName(patient);

        return (
          <button
            key={patient.patientId}
            type="button"
            onClick={() => onSelect(patient)}
            className={cn(
              "w-full text-left px-4 py-3 transition-colors hover:bg-[#faf9f8] flex items-center gap-3",
              isSelected && "bg-[#ecf3ff]/60 border-l-[3px] border-l-[#0066ff]",
            )}
          >
            <div className="w-9 h-9 rounded-sm bg-[#ecf3ff] text-[#0066ff] font-bold text-xs flex items-center justify-center shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-xs text-[#929296] truncate">
                {patient.phoneNumber ?? `ID ${shortId(patient.patientId)}…`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold tabular-nums">{patient.appointmentCount}</p>
              <p className="text-[10px] text-[#929296]">
                {patient.lastVisit
                  ? format(parseISO(patient.lastVisit), "MMM d")
                  : "New"}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
