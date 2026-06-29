import { useMemo } from "react";
import { Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClinicAdmin } from "@/context/ClinicAdminContext";

export function SidebarQuickStats() {
  const { appointments } = useClinicAdmin();

  const stats = useMemo(() => {
    const total = appointments.length;
    const checkedIn = appointments.filter((a) => a.status === "COMPLETED").length;
    const noShows = appointments.filter((a) => a.status === "NO_SHOW").length;
    const pending = appointments.filter((a) => a.status === "REQUESTED").length;

    return [
      { label: "Total appointments", count: total, icon: Calendar, color: "text-blue-500", bg: "bg-blue-50" },
      { label: "Completed", count: checkedIn, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
      { label: "No-shows", count: noShows, icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
      { label: "Pending", count: pending, icon: Clock, color: "text-amber-500", bg: "bg-amber-50" },
    ];
  }, [appointments]);

  return (
    <div className="p-5 border-b border-[#DBDBDC] flex-1 overflow-y-auto no-scrollbar">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-3.5">
        Quick stats (30d)
      </h4>
      <div className="space-y-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between text-xs font-semibold"
          >
            <div className="flex items-center gap-2 text-neutral-500">
              <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", stat.bg, stat.color)}>
                <stat.icon className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className={cn("font-bold px-2 py-0.5 rounded-full", stat.color)}>
                {stat.count}
              </span>
              <span>{stat.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
