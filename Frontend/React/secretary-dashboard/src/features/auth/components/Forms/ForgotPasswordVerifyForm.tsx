import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuthStore } from "@/stores/authStore";
import { sendPasswordResetOtp, verifyPasswordResetOtp } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/types";
import { usePasswordResetResendCooldown } from "../../hooks/usePasswordResetResendCooldown";
import {
  forgotPasswordOtpSchema,
  type ForgotPasswordOtpFormData,
} from "../../schemas/forgotPasswordSchema";

export function ForgotPasswordVerifyForm() {
  const navigate = useNavigate();
  const phoneNumber = useAuthStore((s) => s.passwordResetPhone);
  const setPasswordResetOtp = useAuthStore((s) => s.setPasswordResetOtp);
  const clearPasswordResetFlow = useAuthStore((s) => s.clearPasswordResetFlow);
  const { remaining, canResend, markSent } = usePasswordResetResendCooldown();

  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [devOtpHint, setDevOtpHint] = React.useState<string | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ForgotPasswordOtpFormData>({
    resolver: zodResolver(forgotPasswordOtpSchema),
    defaultValues: { otp: "" },
  });

  const otpValue = watch("otp");

  React.useEffect(() => {
    if (!phoneNumber) {
      navigate("/auth/forget_password", { replace: true });
    }
  }, [phoneNumber, navigate]);

  const handleResend = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!phoneNumber || !canResend || isResending) return;
    setIsResending(true);
    setError(null);
    try {
      const res = await sendPasswordResetOtp(phoneNumber);
      markSent();
      setValue("otp", "");
      if (res.devOtp) setDevOtpHint(`Dev OTP: ${res.devOtp}`);
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not resend code."));
    } finally {
      setIsResending(false);
    }
  };

  const onSubmit = async (data: ForgotPasswordOtpFormData) => {
    if (!phoneNumber) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await verifyPasswordResetOtp(phoneNumber, data.otp);
      setPasswordResetOtp(data.otp);
      navigate("/auth/reset_password", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.message === "Invalid or expired OTP") {
        clearPasswordResetFlow();
        navigate("/auth/link_expired", { replace: true });
        return;
      }
      setError(normalizeCaughtError(err, "Could not verify the code."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center p-7 w-full mx-auto">
      <div className="mb-4">
        <h1 className="font-inter text-[36px] font-semibold leading-[1.3] tracking-[-0.5px] text-[#1A1B1E]">
          Confirm your code
        </h1>
        <p className="mt-2 font-inter text-[18px] font-normal leading-normal tracking-[0.02em] text-[#929296]">
          Enter the 6-digit code sent to{" "}
          <span className="text-[#0B74FA] break-all">{phoneNumber}</span> via WhatsApp.
        </p>
        {devOtpHint && (
          <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {devOtpHint}
          </p>
        )}
      </div>

      <div className="mb-10">
        {!canResend ? (
          <span className="font-inter text-[18px] text-[#0B74FA]">
            Resend code in {remaining} second{remaining === 1 ? "" : "s"}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="font-inter text-[18px] text-[#0B74FA] underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending ? "Sending…" : "Resend verification code"}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex justify-center w-full">
          <InputOTP
            maxLength={6}
            value={otpValue}
            onChange={(value) => setValue("otp", value, { shouldValidate: true })}
            disabled={isSubmitting}
            className="w-full"
          >
            <InputOTPGroup className="gap-2 sm:gap-2.5 w-full flex justify-between">
              {Array.from({ length: 6 }).map((_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="w-11 h-11 text-base sm:text-lg font-inter font-bold text-neutral-900 bg-white border border-[#B6B7B9] rounded-xl transition-all duration-200 focus-visible:ring-4 focus-visible:ring-blue-100 focus-visible:border-[#0066ff] shadow-none"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        {errors.otp && (
          <p className="text-sm text-red-600 text-center">{errors.otp.message}</p>
        )}

        <div className="space-y-3">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || otpValue.length < 6}
            className="w-full h-12 bg-[#0B74FA] hover:bg-[#0052cc] text-white font-inter text-[22px] font-semibold rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? "Verifying…" : "Confirm code"}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/auth/forget_password")}
              className="inline-flex items-center gap-1.5 font-inter text-[18px] text-[#0B74FA] underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to forgot password
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
