import { NavLink } from "react-router";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  LineChart,
  UserSearch,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { useSidebarStore } from "@/stores/sidebarStore";
import { resolveAssetUrl } from "@/lib/resolveAssetUrl";
import { SidebarQuickStats } from "./SidebarQuickStats";

const navSections = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/dashboard/appointments", label: "Appointments", icon: CalendarDays, end: false },
      { to: "/dashboard/schedule", label: "Schedule", icon: Clock3, end: false },
      { to: "/dashboard/patients", label: "Patients", icon: UserSearch, end: false },
      { to: "/dashboard/staff", label: "Staff", icon: Users, end: false },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/dashboard/analytics", label: "Analytics", icon: LineChart, end: false },
    ],
  },
  {
    label: "Clinic",
    items: [
      { to: "/dashboard/settings", label: "Settings", icon: Building2, end: false },
    ],
  },
];

function clinicInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "C";
}

export function Sidebar() {
  const mode = useSidebarStore((s) => s.mode);
  const toggleSidebar = useSidebarStore((s) => s.toggleSidebar);
  const isCollapsed = mode === "collapsed";
  const { clinic, loading } = useClinicAdmin();
  const displayName = clinic?.name?.trim() || (loading ? "Loading…" : "Your clinic");
  const logoUrl = resolveAssetUrl(clinic?.logoUrl);

  return (
    <aside
      className={cn(
        "h-full bg-white border-r border-[#e1dfdd] flex flex-col shrink-0 z-20 sidebar-shell",
        isCollapsed ? "sidebar-collapsed w-[64px]" : "sidebar-expanded w-[248px]",
      )}
    >
      <div
        className={cn(
          "h-14 border-b border-[#edebe9] flex items-center shrink-0 transition-all",
          isCollapsed ? "px-2 justify-center" : "px-3 justify-between gap-2",
        )}
      >
        <div className={cn("flex items-center gap-2.5 min-w-0", isCollapsed && "justify-center")}>
          <div className="w-8 h-8 shrink-0 rounded-sm bg-[#0066ff] text-white flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              clinicInitial(displayName)
            )}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1 sidebar-label-fade">
              <p className="text-[13px] font-semibold text-[#1a1b1e] truncate" title={displayName}>
                {displayName}
              </p>
              <p className="text-[10px] text-[#929296] font-medium">Clinic admin</p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="p-1.5 rounded-sm text-[#929296] hover:text-[#0066ff] hover:bg-[#ecf3ff] transition-colors sidebar-label-fade"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {isCollapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="mx-auto mt-2 p-1.5 rounded-sm text-[#929296] hover:text-[#0066ff] hover:bg-[#ecf3ff] transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <nav className="flex-1 overflow-y-auto no-scrollbar py-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-1">
            {!isCollapsed && <p className="pbi-nav-section sidebar-label-fade">{section.label}</p>}
            <div className={cn("space-y-0.5", isCollapsed ? "px-1.5" : "px-2")}>
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  title={isCollapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "pbi-nav-link",
                      isCollapsed && "justify-center px-2",
                      isActive && "pbi-nav-link-active",
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 opacity-80" strokeWidth={2} />
                  {!isCollapsed && <span className="truncate sidebar-label-fade">{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!isCollapsed && <SidebarQuickStats />}

      <div
        className={cn(
          "shrink-0 border-t border-[#edebe9] text-[10px] text-[#929296]",
          isCollapsed ? "py-3 text-center" : "px-4 py-3",
        )}
      >
        {isCollapsed ? "MC" : "MediCare clinic workspace"}
      </div>
    </aside>
  );
}
