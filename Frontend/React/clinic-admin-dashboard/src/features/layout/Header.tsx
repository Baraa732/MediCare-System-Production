import { useNavigate } from "react-router";
import { LogOut, Menu, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { logout as logoutApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/authStore";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { useSidebarStore } from "@/stores/sidebarStore";

export function Header() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const toggleSidebar = useSidebarStore((s) => s.toggleSidebar);
  const { clinic, reload, loading } = useClinicAdmin();

  const initials = role === "CLINIC_ADMIN" ? "CA" : role?.slice(0, 2).toUpperCase() || "U";

  const handleLogout = () => {
    if (accessToken && refreshToken) {
      void logoutApi(refreshToken, accessToken).catch(() => undefined);
    }
    logout();
    navigate("/auth/login", { replace: true });
  };

  return (
    <header className="h-16 w-full border-b border-neutral-200 bg-white px-6 flex items-center justify-between shrink-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggleSidebar}
          className="h-9 w-9 rounded-xl border-neutral-200"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <p className="text-xs text-neutral-400 font-medium">Clinic admin portal</p>
          <p className="text-sm font-bold text-neutral-900 truncate">
            {clinic?.name ?? "MediCare Clinic"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void reload()}
          disabled={loading}
          className="h-9 rounded-xl border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 px-3 gap-1.5"
        >
          <RefreshCw className={cnIcon(loading)} />
          Refresh
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/dashboard/profile")}
          className="h-9 rounded-xl border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 px-3 gap-1.5"
        >
          <Settings className="w-3.5 h-3.5" />
          Profile
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleLogout}
          className="h-9 rounded-xl border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 px-3 gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </Button>

        <button
          type="button"
          onClick={() => navigate("/dashboard/profile")}
          className="rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200"
          title="Profile settings"
        >
          <Avatar className="w-9 h-9 rounded-xl border border-neutral-200">
            <AvatarImage src="" />
            <AvatarFallback className="rounded-xl font-bold bg-[#0066ff] text-white text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  );
}

function cnIcon(spin: boolean) {
  return `w-3.5 h-3.5${spin ? " animate-spin" : ""}`;
}
