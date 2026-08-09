import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { DigitCodeInput } from "@/components/auth/DigitCodeInput";
import {
  isAuthSession,
  requiresPasswordChange,
  resendMfaOtp,
  resendRegistrationOtp,
  verifyMfa,
  verifyRegistrationOtp,
  type OtpDeliveryResult,
} from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { uploadPendingRegistrationImages } from "@/lib/registrationImages";
import { useOtpResendCooldown } from "@/hooks/useOtpResendCooldown";
import { useAuthStore } from "@/stores/authStore";

type OtpLocationState = {
  whatsappSent?: boolean;
  whatsappHint?: string;
  devOtp?: string;
};

function applyDeliveryHints(
  res: OtpDeliveryResult,
  setters: {
    setWhatsappWarning: (v: string | null) => void;
    setDevOtpHint: (v: string | null) => void;
  },
) {
  if (res.whatsappSent === false) {
    setters.setWhatsappWarning(
      res.whatsappHint ??
        "WhatsApp delivery failed. Reconnect WhatsApp in Evolution Manager, then tap Resend.",
    );
  } else {
    setters.setWhatsappWarning(null);
  }
  if (res.devOtp) {
    setters.setDevOtpHint(`Dev OTP (WhatsApp unavailable): ${res.devOtp}`);
  }
}

export function OtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? {}) as OtpLocationState;

  const phoneNumber = useAuthStore((s) => s.phoneNumber);
  const mfaToken = useAuthStore((s) => s.mfaToken);
  const otpFlow = useAuthStore((s) => s.otpFlow);
  const setSession = useAuthStore((s) => s.setSession);
  const setPendingActivation = useAuthStore((s) => s.setPendingActivation);
  const clearPendingFlow = useAuthStore((s) => s.clearPendingFlow);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [whatsappWarning, setWhatsappWarning] = useState<string | null>(
    locationState.whatsappSent === false
      ? (locationState.whatsappHint ??
          "WhatsApp delivery failed. Use Resend after reconnecting WhatsApp.")
      : null,
  );
  const [devOtpHint, setDevOtpHint] = useState<string | null>(
    locationState.devOtp
      ? `Dev OTP (WhatsApp unavailable): ${locationState.devOtp}`
      : null,
  );

  const { remaining, canResend, markSent } = useOtpResendCooldown();

  useEffect(() => {
    if (otpFlow === "mfa" && !mfaToken) {
      navigate("/auth/login", { replace: true });
    }
    if (otpFlow === "register" && !phoneNumber) {
      navigate("/auth/register", { replace: true });
    }
    if (!otpFlow) {
      navigate("/auth/login", { replace: true });
    }
  }, [otpFlow, mfaToken, phoneNumber, navigate]);

  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let res: OtpDeliveryResult;
      if (otpFlow === "mfa" && mfaToken) {
        res = await resendMfaOtp(mfaToken);
      } else if (otpFlow === "register" && phoneNumber) {
        res = await resendRegistrationOtp(phoneNumber);
      } else {
        return;
      }

      markSent();
      setCode("");
      applyDeliveryHints(res, { setWhatsappWarning, setDevOtpHint });
      setSuccessMessage(
        res.whatsappSent === false
          ? "A new code was generated. WhatsApp could not deliver it — see the note below."
          : "A new verification code was sent to your WhatsApp.",
      );
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not resend the verification code."));
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter the full 6-digit code.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (otpFlow === "mfa" && mfaToken) {
        const res = await verifyMfa(mfaToken, code);
        if (requiresPasswordChange(res)) {
          setPendingActivation(res.activationToken);
          navigate("/auth/set-password", { replace: true });
          return;
        }
        if (isAuthSession(res)) {
          if (res.role !== "CLINIC_ADMIN") {
            setError("Incorrect verification or account. Please sign in again.");
            clearPendingFlow();
            navigate("/auth/login", { replace: true });
            return;
          }
          setSession(res);
          await uploadPendingRegistrationImages(res);
          navigate("/dashboard", { replace: true });
        }
        return;
      }

      if (otpFlow === "register" && phoneNumber) {
        const res = await verifyRegistrationOtp(phoneNumber, code);
        if (requiresPasswordChange(res)) {
          setPendingActivation(res.activationToken);
          navigate("/auth/set-password", { replace: true });
          return;
        }
        if (isAuthSession(res)) {
          if (res.role !== "CLINIC_ADMIN") {
            setError("Incorrect verification or account. Please sign in again.");
            clearPendingFlow();
            navigate("/auth/login", { replace: true });
            return;
          }
          setSession(res);
          await uploadPendingRegistrationImages(res);
          navigate("/dashboard", { replace: true });
          return;
        }
        setError("Phone verified. Please sign in with your password.");
        clearPendingFlow();
        navigate("/auth/login", { replace: true });
      }
    } catch (err) {
      setError(normalizeCaughtError(err, "Verification failed"));
    } finally {
      setLoading(false);
    }
  };

  const title =
    otpFlow === "register" ? "Verify your phone" : "Enter verification code";
  const subtitle =
    otpFlow === "register"
      ? `We sent a 6-digit code to ${phoneNumber ?? "your phone"} via WhatsApp.`
      : `Enter the 6-digit code sent to ${phoneNumber ?? "your phone"}.`;

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="font-semibold text-2xl text-[#1A1B1E]">{title}</h1>
        <p className="text-[#929296] mt-1.5">{subtitle}</p>
        {whatsappWarning && (
          <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {whatsappWarning}
          </p>
        )}
        {devOtpHint && (
          <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 font-mono">
            {devOtpHint}
          </p>
        )}
      </div>

      <div className="mb-6 text-center">
        {!canResend ? (
          <span className="text-sm text-[#0066ff]">
            Resend code in {remaining} second{remaining === 1 ? "" : "s"}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending}
            className="text-sm text-[#0066ff] font-medium hover:underline disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend verification code"}
          </button>
        )}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <DigitCodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(null);
          }}
          disabled={loading}
          invalid={Boolean(error)}
        />

        {successMessage && (
          <p className="text-sm text-green-700 text-center bg-green-50 border border-green-100 rounded-lg px-3 py-2">
            {successMessage}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-500 text-center bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full py-3 rounded-lg bg-[#0066ff] text-white font-medium disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Confirm code"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            clearPendingFlow();
            navigate("/auth/login", { replace: true });
          }}
          className="inline-flex items-center gap-1.5 text-[#0066ff] text-sm hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>
      </div>
    </div>
  );
}
