import { Navigate, useLocation } from "react-router";
import type { ReactNode } from "react";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { useAuthStore } from "@/stores/authStore";
import { NotificationProvider } from "@/features/notifications/NotificationProvider";

const PASSWORD_RESET_PREFIXES = [
  "/auth/forget_password",
  "/auth/reset_password",
  "/auth/reset_success",
  "/auth/link_expired",
] as const;

function isPasswordResetRoute(pathname: string): boolean {
  return PASSWORD_RESET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthHydration();
  const location = useLocation();

  if (!hydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-neutral-500">
        Loading session...
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  return <NotificationProvider>{children}</NotificationProvider>;
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthHydration();
  const location = useLocation();

  if (!hydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-neutral-500">
        Loading session...
      </div>
    );
  }

  // Allow forgot-password even when a stale JWT is still in session storage.
  if (accessToken && !isPasswordResetRoute(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
