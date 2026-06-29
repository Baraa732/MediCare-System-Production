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
export function usePasswordResetResendCooldown(
  cooldownSeconds = DEFAULT_COOLDOWN_SECONDS,
) {
  const sentAt = useAuthStore((s) => s.passwordResetOtpSentAt);
  const markSent = useAuthStore((s) => s.markPasswordResetOtpSent);

  const getRemaining = useCallback(
    () => remainingSeconds(sentAt, cooldownSeconds),
    [sentAt, cooldownSeconds],
  );

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    setRemaining(getRemaining());

    const interval = window.setInterval(() => {
      setRemaining(getRemaining());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [getRemaining]);

  return {
    remaining,
    canResend: remaining <= 0,
    markSent,
  };
}
