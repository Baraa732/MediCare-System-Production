import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

const DEFAULT_COOLDOWN_SECONDS = 60;

function remainingSeconds(sentAt: number | null, cooldownSeconds: number): number {
  if (!sentAt) return 0;
  return Math.max(0, Math.ceil((sentAt + cooldownSeconds * 1000 - Date.now()) / 1000));
}

/**
 * Cooldown based on when the OTP was last sent (persisted in session storage).
 * Survives page refresh and ticks every second from wall-clock time.
 */
export function useOtpResendCooldown(cooldownSeconds = DEFAULT_COOLDOWN_SECONDS) {
  const otpSentAt = useAuthStore((s) => s.otpSentAt);
  const markOtpSent = useAuthStore((s) => s.markOtpSent);

  const getRemaining = useCallback(
    () => remainingSeconds(otpSentAt, cooldownSeconds),
    [otpSentAt, cooldownSeconds],
  );

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    setRemaining(getRemaining());

    const interval = window.setInterval(() => {
      setRemaining(getRemaining());
    }, 1000);

    const onVisible = () => setRemaining(getRemaining());
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [getRemaining]);

  return {
    remaining,
    canResend: remaining <= 0,
    markSent: markOtpSent,
  };
}
