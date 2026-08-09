import { useEffect, type ReactNode } from "react";
import { Navigate } from "react-router";
import { AuthFlowShell } from "@/components/auth/AuthFlowShell";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { useAuthStore } from "@/stores/authStore";

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
    return <Navigate to="/auth/login" replace />;
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

  if (wrongRole) {
    return <Navigate to="/auth/login" replace />;
  }

  if (canEnterApp) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function AuthShell() {
  return <AuthFlowShell />;
}
