import * as React from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import type { ConfirmEmailFormProps } from "../../types";
import { useNavigate } from "react-router";
import { useVerifyOtp } from "../../hooks/useVerifyOtp";
import { useResendOtp } from "../../hooks/useResendOtp";
import { useAuthStore } from "@/stores/authStore";

const RESEND_COOLDOWN_SECONDS = 60;

export function ConfirmEmailForm({
  isLoading: externalLoading = false,
}: ConfirmEmailFormProps) {
  const [otpValue, setOtpValue] = React.useState<string>("");
  const [countdown, setCountdown] = React.useState<number>(RESEND_COOLDOWN_SECONDS);
  const navigate = useNavigate();
  const phoneNumber = useAuthStore((s) => s.phoneNumber);
  const mfaToken = useAuthStore((s) => s.mfaToken);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activationToken = useAuthStore((s) => s.activationToken);
  const clearPendingFlow = useAuthStore((s) => s.clearPendingFlow);
  const { verify, isLoading, error, setError } = useVerifyOtp();
  const {
    resend,
    isResending,
    error: resendError,
    successMessage,
    clearFeedback,
  } = useResendOtp();
  const loading = externalLoading || isLoading || isResending;

  React.useEffect(() => {
    if (mfaToken) return;
    // mfaToken is cleared after successful OTP — do not treat that as an expired session.
    if (accessToken || activationToken) return;
    navigate("/auth/login", { replace: true });
  }, [mfaToken, accessToken, activationToken, navigate]);

  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResend = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (countdown > 0 || isResending) return;

    setError(null);
    clearFeedback();

    const sent = await resend();
    if (sent) {
      setOtpValue("");
      setCountdown(RESEND_COOLDOWN_SECONDS);
    }
  };

  const onVerifyCode = async (code: string) => {
    clearFeedback();
    await verify(code);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpValue.length === 6) {
      void onVerifyCode(otpValue);
    }
  };

  const onBackToLogin = () => {
    clearPendingFlow();
    navigate("/auth/login", { replace: true });
  };

  const displayError = error ?? resendError;

  return (
    <>
      <div className="flex-1 flex flex-col justify-center p-7 w-full mx-auto ">
        <div className="mb-4">
          <h1 className="font-inter text-[36px] font-semibold leading-[1.3] tracking-[-0.5px] text-[#1A1B1E]">
            Verify your phone
          </h1>
          <p className=" mt-2 font-inter text-[18px] font-normal leading-normal tracking-[0.02em] text-[#929296]">
            Enter the code sent to {phoneNumber ?? "your phone"} via WhatsApp.
            On your first login you will set a permanent password next.
          </p>
        </div>

        <div className="mb-13">
          {countdown > 0 ? (
            <span className="font-inter text-[18px] font-normal leading-normal tracking-[0.02em] underline underline-offset-0 decoration-0 text-[#0B74FA]">
              Resend code in {countdown} seconds
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="font-inter text-[18px] font-normal leading-normal tracking-[0.02em] underline underline-offset-0 decoration-0 text-[#0B74FA] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResending ? "Sending new code..." : "Resend verification code"}
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex justify-center w-full">
            <InputOTP
              maxLength={6}
              value={otpValue}
              onChange={(value: React.SetStateAction<string>) => {
                clearFeedback();
                setOtpValue(value);
              }}
              disabled={loading}
              className="w-full disabled:pointer-events-none"
            >
              <InputOTPGroup className="gap-2 sm:gap-2.5 w-full flex justify-between">
                {[...Array(6)].map((_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="w-11 h-11 text-base sm:text-lg font-inter font-bold text-neutral-900 bg-white border border-[#B6B7B9] rounded-xl transition-all duration-200 focus-visible:ring-4 focus-visible:ring-blue-100 focus-visible:border-[#0066ff] shadow-none"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="space-y-3 mt-22">
            {successMessage && (
              <p className="text-center text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                {successMessage}
              </p>
            )}
            {displayError && (
              <p className="text-center text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {displayError}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || otpValue.length < 6}
              className="w-full h-12 bg-[rgba(11_116_250/1)] hover:bg-[#b3d1ff] text-white font-inter text-[22px] font-semibold leading-[1.2] tracking-[0.02em] rounded-lg transition-all shadow-none  disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading ? "Verifying..." : "Confirm code"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={onBackToLogin}
                className="inline-flex items-center gap-1.5 font-inter text-[18px] font-normal leading-normal tracking-[0.02em] text-center underline decoration-0 text-[#0B74FA] hover:underline underline-offset-4 cursor-pointer focus:outline-none py-1 px-2"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                Back to Log in
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
