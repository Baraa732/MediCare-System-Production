import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { sendPasswordResetOtp } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { useAuthStore } from "@/stores/authStore";
import { usePasswordResetResendCooldown } from "../../hooks/usePasswordResetResendCooldown";

export function ForgotPasswordCheckPhoneForm() {
  const navigate = useNavigate();
  const phoneNumber = useAuthStore((s) => s.passwordResetPhone);
  const { remaining, canResend, markSent } = usePasswordResetResendCooldown();
  const [isResending, setIsResending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!phoneNumber) {
      navigate("/auth/forget_password", { replace: true });
    }
  }, [phoneNumber, navigate]);

  const handleResend = async () => {
    if (!phoneNumber || !canResend || isResending) return;
    setIsResending(true);
    setError(null);
    try {
      const res = await sendPasswordResetOtp(phoneNumber);
      markSent();
      if (res.devOtp) setDevOtpHint(`Dev OTP: ${res.devOtp}`);
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not resend the verification code."));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center p-7 w-full mx-auto">
      <div>
        <h1 className="font-inter text-[36px] font-semibold leading-[1.3] tracking-[-0.5px] text-[#1A1B1E]">
          Check your phone
        </h1>
        <p className="font-inter text-[22px] font-normal leading-[1.6] tracking-normal text-[#929296] mt-3">
          We sent a verification code to{" "}
          <span className="text-[#0B74FA] break-all">{phoneNumber}</span> via WhatsApp.
          You should receive it shortly.
        </p>
        <p className="mt-4 font-inter text-[18px] font-normal leading-[1.6] text-[#929296]">
          The code is valid for 10 minutes. If you do not receive it, check that WhatsApp is
          connected on the server or request a new code below.
        </p>
        {devOtpHint && (
          <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {devOtpHint}
          </p>
        )}
      </div>

      <div className="mt-6 mb-8">
        {!canResend ? (
          <span className="font-inter text-[18px] text-[#0B74FA]">
            Resend code in {remaining}s
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={isResending}
            className="font-inter text-[18px] text-[#0B74FA] underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending ? "Sending…" : "Resend verification code"}
          </button>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <Button
          type="button"
          onClick={() => navigate("/auth/forget_password/verify")}
          className="w-full h-13 bg-[#0066ff] hover:bg-[#0052cc] text-white font-inter text-lg font-semibold rounded-xl"
        >
          Enter verification code
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/auth/login", { replace: true })}
          className="w-full h-13 rounded-xl border-neutral-200 font-semibold flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to login
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate("/auth/forget_password")}
            className="font-inter text-[18px] text-[#0B74FA] underline"
          >
            Change phone number
          </button>
        </div>
      </div>
    </div>
  );
}
