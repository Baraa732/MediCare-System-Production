import { useState } from "react";
import { useNavigate } from "react-router";
import { resendMfaOtp } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { useAuthStore } from "@/stores/authStore";

export function useResendOtp() {
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const mfaToken = useAuthStore((s) => s.mfaToken);

  const resend = async () => {
    if (!mfaToken) {
      setError("Your verification session has expired. Please sign in again.");
      navigate("/auth/login", { replace: true });
      return false;
    }

    setIsResending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await resendMfaOtp(mfaToken);
      setSuccessMessage(
        response.message === "OTP sent successfully"
          ? "A new verification code was sent to your WhatsApp."
          : response.message,
      );
      return true;
    } catch (err) {
      setError(
        normalizeCaughtError(
          err,
          "Could not resend the verification code. Please try again.",
        ),
      );
      return false;
    } finally {
      setIsResending(false);
    }
  };

  const clearFeedback = () => {
    setError(null);
    setSuccessMessage(null);
  };

  return { resend, isResending, error, successMessage, clearFeedback };
}
