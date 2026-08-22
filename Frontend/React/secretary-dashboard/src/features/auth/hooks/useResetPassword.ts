import { useState } from "react";
import { useNavigate } from "react-router";
import { resetPassword } from "@/lib/api/auth";
import { toPasswordResetErrorMessage } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/types";
import { useAuthStore } from "@/stores/authStore";

const INVALID_CREDENTIALS =
  "Incorrect phone number or password. Please try again.";

export function useResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const phoneNumber = useAuthStore((s) => s.passwordResetPhone);
  const otp = useAuthStore((s) => s.passwordResetOtp);
  const clearPasswordResetFlow = useAuthStore((s) => s.clearPasswordResetFlow);
  const setSession = useAuthStore((s) => s.setSession);

  const submit = async (newPassword: string) => {
    if (!phoneNumber || !otp) {
      setError("Your reset session has expired. Please start again from Forgot password.");
      navigate("/auth/forget_password", { replace: true });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await resetPassword({
        phoneNumber,
        otp,
        newPassword,
      });
      clearPasswordResetFlow();
      if (response.accessToken) {
        if (response.role !== "SECRETARY") {
          setError(INVALID_CREDENTIALS);
          return;
        }
        setSession(response);
        navigate("/dashboard", { replace: true });
        return;
      }
      navigate("/auth/reset_success", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.message === "Invalid or expired OTP") {
        clearPasswordResetFlow();
        navigate("/auth/link_expired", { replace: true });
        return;
      }
      setError(
        err instanceof ApiError
          ? toPasswordResetErrorMessage(err, "Could not reset your password. Please try again.")
          : "Could not reset your password. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return { submit, isLoading, error };
}
