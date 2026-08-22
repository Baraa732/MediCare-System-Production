import { useState } from "react";
import { useNavigate } from "react-router";
import { verifyMfa } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { useAuthStore } from "@/stores/authStore";

const INVALID_CREDENTIALS =
  "Incorrect phone number or password. Please try again.";

function isSecretaryRole(role?: string): boolean {
  return role === "SECRETARY";
}

export function useVerifyOtp() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const mfaToken = useAuthStore((s) => s.mfaToken);
  const setSession = useAuthStore((s) => s.setSession);
  const setPendingActivation = useAuthStore((s) => s.setPendingActivation);

  const verify = async (otp: string) => {
    if (!mfaToken) {
      setError(
        "Your verification session has expired. Please sign in again to receive a new code.",
      );
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code from WhatsApp.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await verifyMfa(mfaToken, otp);

      if ("requiresPasswordChange" in response && response.requiresPasswordChange) {
        setPendingActivation({
          activationToken: response.activationToken,
          clinicId: response.clinicId,
          userId: response.userId,
          role: response.role,
        });
        navigate("/auth/reset_password", { replace: true });
        return;
      }

      if ("accessToken" in response) {
        if (!isSecretaryRole(response.role)) {
          setError(INVALID_CREDENTIALS);
          return;
        }
        setSession(response);
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(
        normalizeCaughtError(
          err,
          "Could not verify the code. Please try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return { verify, isLoading, error, setError };
}
