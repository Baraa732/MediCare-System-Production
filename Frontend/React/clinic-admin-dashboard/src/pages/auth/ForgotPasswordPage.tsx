import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  resetPassword,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
} from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { normalizeSyrianPhone } from "@/lib/phone";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const phoneSchema = z.object({
  phoneNumber: z.string().min(8, "Enter a valid phone number"),
});

const resetSchema = z
  .object({
    otp: z.string().length(6, "Enter the 6-digit code"),
    newPassword: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/\d/, "Include a number")
      .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, "Include a special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

type Step = "phone" | "reset";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setPasswordResetPhone = useAuthStore((s) => s.setPasswordResetPhone);
  const passwordResetPhone = useAuthStore((s) => s.passwordResetPhone);
  const clearPasswordResetFlow = useAuthStore((s) => s.clearPasswordResetFlow);

  const [step, setStep] = useState<Step>(passwordResetPhone ? "reset" : "phone");
  const [phone, setPhone] = useState(passwordResetPhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const phoneForm = useForm({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: phone },
  });

  const resetForm = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { otp: "", newPassword: "", confirmPassword: "" },
  });

  const sendCode = phoneForm.handleSubmit(async (data) => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const formatted = normalizeSyrianPhone(data.phoneNumber);
      const res = await sendPasswordResetOtp(formatted);
      setPhone(formatted);
      setPasswordResetPhone(formatted);
      setStep("reset");
      setInfo(
        res.whatsappSent
          ? "We sent a verification code to your WhatsApp."
          : res.whatsappHint ?? "Check WhatsApp for your verification code.",
      );
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not send verification code."));
    } finally {
      setLoading(false);
    }
  });

  const submitReset = resetForm.handleSubmit(async (data) => {
    if (!phone) return;
    setLoading(true);
    setError(null);
    try {
      await verifyPasswordResetOtp(phone, data.otp);
      const session = await resetPassword({
        phoneNumber: phone,
        otp: data.otp,
        newPassword: data.newPassword,
      });
      clearPasswordResetFlow();
      setSession(session);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not reset password."));
    } finally {
      setLoading(false);
    }
  });

  const resendCode = async () => {
    if (!phone || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await sendPasswordResetOtp(phone);
      setInfo(
        res.whatsappSent
          ? "We sent a new verification code to your WhatsApp."
          : res.whatsappHint ?? "Check WhatsApp for your verification code.",
      );
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not resend verification code."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 pb-5 pt-1 sm:px-8 sm:pb-6">
      <div className="mb-5">
        <h1 className="font-semibold text-2xl text-[#1A1B1E]">Reset password</h1>
        <p className="text-[#929296] mt-1 text-sm">
          {step === "phone"
            ? "Enter your registered phone number — we'll send a WhatsApp code."
            : `Enter the code sent to ${phone} and choose a new password.`}
        </p>
      </div>

      {info && (
        <p className="mb-3 text-sm text-[#0066ff] bg-[#ecf3ff] border border-[#0066ff]/20 rounded-xl px-3 py-2">
          {info}
        </p>
      )}

      {step === "phone" ? (
        <form onSubmit={(e) => void sendCode(e)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="phoneNumber" className="text-sm text-[#929296]">
              Phone number
            </label>
            <input
              {...phoneForm.register("phoneNumber")}
              id="phoneNumber"
              type="tel"
              placeholder="0934557287"
              disabled={loading}
              className={cn(
                "w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-4 transition-all",
                phoneForm.formState.errors.phoneNumber || error
                  ? "border-red-500 focus:ring-red-100"
                  : "border-neutral-200 focus:border-[#0066ff] focus:ring-blue-100",
              )}
            />
            {phoneForm.formState.errors.phoneNumber && (
              <p className="text-sm text-red-500">
                {phoneForm.formState.errors.phoneNumber.message}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white font-medium disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send verification code"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void submitReset(e)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="otp" className="text-sm text-[#929296]">
              Verification code
            </label>
            <input
              {...resetForm.register("otp")}
              id="otp"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              disabled={loading}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg tracking-[0.3em] text-center font-mono"
            />
            {resetForm.formState.errors.otp && (
              <p className="text-sm text-red-500">{resetForm.formState.errors.otp.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-sm text-[#929296]">
              New password
            </label>
            <input
              {...resetForm.register("newPassword")}
              id="newPassword"
              type="password"
              autoComplete="new-password"
              disabled={loading}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg"
            />
            {resetForm.formState.errors.newPassword && (
              <p className="text-sm text-red-500">
                {resetForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm text-[#929296]">
              Confirm password
            </label>
            <input
              {...resetForm.register("confirmPassword")}
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={loading}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg"
            />
            {resetForm.formState.errors.confirmPassword && (
              <p className="text-sm text-red-500">
                {resetForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white font-medium disabled:opacity-60"
          >
            {loading ? "Resetting…" : "Reset password & sign in"}
          </button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void resendCode()}
            className="w-full rounded-lg"
          >
            Resend code
          </Button>
        </form>
      )}

      <p className="mt-6 text-sm text-center text-[#929296]">
        <Link to="/auth/login" className="text-[#0066ff] font-semibold hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
