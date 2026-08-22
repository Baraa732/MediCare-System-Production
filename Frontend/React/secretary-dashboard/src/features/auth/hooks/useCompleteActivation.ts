import { useState } from "react";
import { useNavigate } from "react-router";
import { completeStaffActivation } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { useAuthStore } from "@/stores/authStore";

const INVALID_CREDENTIALS =
  "Incorrect phone number or password. Please try again.";

export function useCompleteActivation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const activationToken = useAuthStore((s) => s.activationToken);
  const setSession = useAuthStore((s) => s.setSession);

  const submit = async (newPassword: string) => {
    if (!activationToken) {
      setError("Your activation session has expired. Please sign in again.");
      navigate("/auth/login", { replace: true });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await completeStaffActivation(activationToken, newPassword);
      if (response.role !== "SECRETARY") {
        setError(INVALID_CREDENTIALS);
        return;
      }
      setSession(response);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        normalizeCaughtError(
          err,
          "Could not set your new password. Please try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return { submit, isLoading, error };
}
