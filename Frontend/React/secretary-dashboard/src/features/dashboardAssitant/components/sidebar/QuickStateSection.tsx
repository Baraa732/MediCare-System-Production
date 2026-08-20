import { Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduleContext } from "../../context/ScheduleContext";
import { usePendingRequest } from "../../hooks/usePendingRequest";
import { useScheduleGridStore } from "../../hooks/scheduleGridStore";
import type { QuickStateType } from "../../types";
import type { AppointmentDisplayStatus } from "../../utils/appointmentStatusStyles";

export function QuickStateSection() {
  const { doctors, appointments } = useScheduleContext();
  const pendingRequests = usePendingRequest((state) => state.requests);
  const filters = useScheduleGridStore((s) => s.filters);
  const setFilters = useScheduleGridStore((s) => s.setFilters);
  const setFilterPanelOpen = useScheduleGridStore((s) => s.setFilterPanelOpen);
  const applyPreset = useScheduleGridStore((s) => s.applyPreset);

  const countAppointments = doctors.reduce<number>(
    (acc, doc) => acc + doc.appointments.length,
    0,
  );
  const checkedIn = appointments.filter((apt) => apt.status === "COMPLETED").length;
  const noShows = appointments.filter((apt) => apt.status === "NO_SHOW").length;

  const toggleStatusFilter = (status: AppointmentDisplayStatus) => {
    const onlyThis =
      filters.statuses.length === 1 && filters.statuses[0] === status;
    setFilters({ statuses: onlyThis ? [] : [status] });
    setFilterPanelOpen(true);
  };

  const quickState: (QuickStateType & {
    onClick?: () => void;
    active?: boolean;
  })[] = [
    {
      label: "Total appointments",
      count: countAppointments,
      icon: Calendar,
      color: "text-blue-500",
      bg: "bg-blue-50",
      onClick: () => {
        setFilters({ statuses: [], doctorIds: [], timeOfDay: "any" });
      },
      active: filters.statuses.length === 0 && !filters.query,
    },
    {
      label: "Completed",
      count: checkedIn,
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-50",
      onClick: () => toggleStatusFilter("done"),
      active: filters.statuses.includes("done"),
    },
    {
      label: "No-shows",
      count: noShows,
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-50",
      onClick: () => toggleStatusFilter("no-show"),
      active: filters.statuses.includes("no-show"),
    },
    {
      label: "Pending requests",
      count: pendingRequests.length,
      icon: Clock,
      color: "text-violet-600",
      bg: "bg-violet-50",
      onClick: () => applyPreset("pending"),
      active: filters.statuses.includes("pending_request"),
    },
  ];

  return (
    <div className="border-b border-neutral-200/80 p-5">
      <h4 className="mb-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
        Quick stats · tap to filter
      </h4>
      <div className="space-y-2.5">
        {quickState.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={stat.onClick}
            className={cn(
              "surface-card-hover flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all duration-200",
              stat.active
                ? "border-blue-200 bg-blue-50/80 shadow-sm"
                : "border-neutral-100 bg-neutral-50/60",
            )}
          >
            <div className="flex items-center gap-2 text-neutral-500">
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md",
                  stat.bg,
                  stat.color,
                )}
              >
                <stat.icon className="h-3.5 w-3.5 stroke-[2.5]" />
              </div>
              <span className={cn("rounded-full px-2 py-0.5 font-bold", stat.color)}>
                {stat.count}
              </span>
              <span>{stat.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
