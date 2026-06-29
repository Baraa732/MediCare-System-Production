import { useMemo } from "react";
import { useClinicAdmin } from "@/context/ClinicAdminContext";

export function SidebarQuickStats() {
  const { appointments } = useClinicAdmin();

  const stats = useMemo(() => {
    const pending = appointments.filter((a) => a.status === "REQUESTED").length;
    const confirmed = appointments.filter((a) => a.status === "CONFIRMED").length;
    const completed = appointments.filter((a) => a.status === "COMPLETED").length;

    return [
      { label: "Pending", value: pending },
      { label: "Confirmed", value: confirmed },
      { label: "Done", value: completed },
    ];
  }, [appointments]);

  return (
    <div className="shrink-0 px-4 py-3 border-t border-[#edebe9] bg-[#faf9f8]">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#929296] mb-2">
        30-day snapshot
      </p>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="text-center rounded-sm bg-white border border-[#edebe9] py-2 px-1">
            <p className="text-base font-semibold text-[#1a1b1e] tabular-nums leading-none">{s.value}</p>
            <p className="text-[9px] uppercase tracking-wide text-[#929296] mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
