import { useEffect, type ReactNode } from "react";
import { Navigate } from "react-router";
import { AuthFlowShell } from "@/components/auth/AuthFlowShell";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { useAuthStore } from "@/stores/authStore";

const WRONG_PORTAL_FLASH =
  "This portal is for clinic administrators only. Please sign in with a clinic admin account.";

function isClinicAdminRole(role: string | null | undefined): boolean {
  return role === "CLINIC_ADMIN";
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const hydrated = useAuthHydration();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);

  const wrongRole = Boolean(accessToken && role && !isClinicAdminRole(role));

  useEffect(() => {
    if (wrongRole) {
      logout();
    }
  }, [wrongRole, logout]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-[#929296]">
        Loading…
      </div>
    );
  }

  if (!accessToken || wrongRole) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={wrongRole ? { flash: WRONG_PORTAL_FLASH } : undefined}
      />
    );
  }

  return children;
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const hydrated = useAuthHydration();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);

  const wrongRole = Boolean(accessToken && role && !isClinicAdminRole(role));
  const canEnterApp = Boolean(accessToken && isClinicAdminRole(role));

  useEffect(() => {
    if (wrongRole) {
      logout();
    }
  }, [wrongRole, logout]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ecf3ff] text-[#929296]">
        Loading…
      </div>
    );
  }

  // Stale / wrong-role tokens must not block the login page.
  if (wrongRole) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ flash: WRONG_PORTAL_FLASH }}
      />
    );
  }

  if (canEnterApp) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function AuthShell() {
  return <AuthFlowShell />;
}
