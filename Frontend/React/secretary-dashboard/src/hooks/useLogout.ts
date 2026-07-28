import { useCallback } from "react";
import { useNavigate } from "react-router";
import { logout as logoutApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/authStore";

export function useLogout() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);

  return useCallback(async () => {
    if (accessToken && refreshToken) {
      try {
        await logoutApi(refreshToken, accessToken);
      } catch {
        // Local session is cleared even if the server call fails.
      }
    }
    logout();
    navigate("/auth/login", { replace: true });
  }, [accessToken, refreshToken, logout, navigate]);
}
