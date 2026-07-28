import { LogOut, Menu, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router";
import { AuthAvatar } from "@/components/AuthAvatar";
import { TenantScopeBadge } from "@/components/layout/TenantScopeBadge";
import { Button } from "@/components/ui/button";
import { logout as logoutApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/authStore";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useProfileDrawerStore } from "@/stores/profileDrawerStore";
import { cn } from "@/lib/utils";

export function Header() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const toggleSidebar = useSidebarStore((s) => s.toggleSidebar);
  const openProfile = useProfileDrawerStore((s) => s.open);
  const isProfileOpen = useProfileDrawerStore((s) => s.isOpen);
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
    <header className="h-12 w-full border-b border-[#e1dfdd] bg-white px-4 flex items-center justify-between shrink-0 z-10">
      <div className="flex items-center gap-2 min-w-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8 rounded-sm text-[#1a1b1e] hover:bg-[#f3f2f1]"
          aria-label="Toggle navigation"
        >
          <Menu className="w-4 h-4" />
        </Button>
        <div className="h-5 w-px bg-[#edebe9] hidden sm:block" />
        <TenantScopeBadge clinicName={clinic?.name} />
        <p className="text-sm font-medium text-[#1a1b1e] truncate hidden lg:block">
          {clinic?.name ?? "MediCare Clinic"}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void reload()}
          disabled={loading}
          className="h-8 rounded-sm text-xs font-medium text-[#1a1b1e] hover:bg-[#f3f2f1]"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Sync
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="h-8 rounded-sm text-xs font-medium text-[#1a1b1e] hover:bg-[#f3f2f1] hidden sm:inline-flex"
        >
          <LogOut className="w-3.5 h-3.5 mr-1" />
          Logout
        </Button>

        <button
          type="button"
          onClick={() => openProfile("profile")}
          className={cn(
            "flex items-center gap-2 rounded-sm pl-1 pr-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-[#c7dcff]",
            isProfileOpen ? "bg-[#ecf3ff]" : "hover:bg-[#f3f2f1]",
          )}
          title="Account settings"
          aria-expanded={isProfileOpen}
          aria-haspopup="dialog"
        >
          <AuthAvatar
            userId={userId ?? undefined}
            fallback={initials}
            className="w-8 h-8 border border-[#e1dfdd]"
            fallbackClassName="text-[10px]"
          />
          <span className="hidden md:block text-xs font-semibold text-[#1a1b1e] max-w-[120px] truncate">
            My account
          </span>
        </button>
      </div>
    </header>
  );
}
