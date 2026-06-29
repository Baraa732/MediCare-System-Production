import { NavLink } from "react-router";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Clock3,
  LayoutDashboard,
  UserSearch,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { useSidebarStore } from "@/stores/sidebarStore";
import { SidebarQuickStats } from "./SidebarQuickStats";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/staff", label: "Staff", icon: Users },
  { to: "/dashboard/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/dashboard/schedule", label: "Schedule", icon: Clock3 },
  { to: "/dashboard/patients", label: "Patients", icon: UserSearch },
  { to: "/dashboard/settings", label: "Clinic settings", icon: Building2 },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

function clinicInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "C";
}

export function Sidebar() {
  const isOpen = useSidebarStore((s) => s.isSidebarOpen);
  const { clinic, loading } = useClinicAdmin();
  const displayName = clinic?.name?.trim() || (loading ? "Loading clinic…" : "Your clinic");

  return (
    <aside
      className={cn(
        "h-full border-r border-neutral-200 bg-white flex flex-col shrink-0 z-20 relative",
        "transition-all duration-300 ease-in-out project-drawer-transition",
        isOpen
          ? "w-[19.2%] min-w-[240px] max-w-[320px] opacity-100 overflow-hidden"
          : "w-0 opacity-0 pointer-events-none border-r-0 overflow-hidden",
      )}
    >
      <div className="h-16 px-5 border-b border-neutral-100 flex items-center">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 shrink-0 rounded-lg bg-[#0066ff] text-white flex items-center justify-center font-black text-base">
            {clinicInitial(displayName)}
          </div>
          <div className="flex flex-col min-w-0">
            <span
              className="text-sm font-bold tracking-tight text-neutral-900 leading-none truncate"
              title={displayName}
            >
              {displayName}
            </span>
            <span className="text-[11px] text-neutral-400 font-medium mt-0.5">
              Clinic admin dashboard
            </span>
          </div>
        </div>
      </div>

      <nav className="p-3 space-y-1 border-b border-neutral-100">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                isActive
                  ? "bg-[#ecf3ff] text-[#0066ff]"
                  : "text-neutral-700 hover:bg-neutral-50",
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <SidebarQuickStats />

      <div className="mt-auto p-4 border-t border-neutral-100 text-xs text-neutral-400">
        Clinic operations & analytics
      </div>
    </aside>
  );
}
