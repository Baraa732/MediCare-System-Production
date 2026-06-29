import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { AuthFlowShell } from "@/components/auth/AuthFlowShell";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { useAuthStore } from "@/stores/authStore";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const hydrated = useAuthHydration();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-[#929296]">
        Loading…
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/auth/login" replace />;
  }

  if (role && role !== "CLINIC_ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
        <div className="max-w-md text-center space-y-2">
          <p className="text-lg font-semibold text-[#1A1B1E]">Wrong dashboard</p>
          <p className="text-[#929296]">
            This portal is for clinic administrators only.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const hydrated = useAuthHydration();
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ecf3ff] text-[#929296]">
        Loading…
      </div>
    );
  }

  if (accessToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function AuthShell() {
  return <AuthFlowShell />;
}
