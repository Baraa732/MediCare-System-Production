import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Sparkles } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { DigitCodeInput } from "@/components/auth/DigitCodeInput";
import { activateClinicAdmin } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { fetchOnboardingStatus } from "@/lib/onboarding";
import { normalizeSyrianPhone } from "@/lib/phone";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ActivateCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const setActivationPhone = useAuthStore((s) => s.setActivationPhone);
  const markDashboardActivated = useOnboardingStore((s) => s.markDashboardActivated);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(flash ?? null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyActivated, setAlreadyActivated] = useState(false);

  useEffect(() => {
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 9) {
      setAlreadyActivated(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          const status = await fetchOnboardingStatus(phoneNumber);
          if (cancelled) return;
          if (status.canLogin) {
            navigate("/auth/login", {
              replace: true,
              state: {
                flash: "You’re all set — sign in with your phone and password.",
              },
            });
            return;
          }
          if (status.canRegister) {
            setAlreadyActivated(true);
            setInfo(
              "This phone is already activated. You can continue straight to registration — no code needed.",
            );
          } else {
            setAlreadyActivated(false);
          }
        } catch {
          if (!cancelled) setAlreadyActivated(false);
        }
      })();
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phoneNumber, navigate]);

  const goToRegister = () => {
    try {
      const formatted = normalizeSyrianPhone(phoneNumber);
      setActivationPhone(formatted);
      markDashboardActivated(formatted);
      navigate("/auth/register", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Enter a valid phone number.",
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (alreadyActivated) {
      goToRegister();
      return;
    }
    if (code.length !== 6) {
      setError("Enter the full 6-digit activation code.");
      return;
    }

    let formattedPhone: string;
    try {
      formattedPhone = normalizeSyrianPhone(phoneNumber);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Enter a valid Syrian phone number.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await activateClinicAdmin(formattedPhone, code);
      const canonicalPhone = res.phoneNumber ?? formattedPhone;
      const context = {
        adminFullName: res.adminFullName,
        clinicLocation: res.clinicLocation,
      };
      setActivationPhone(canonicalPhone, context);
      markDashboardActivated(canonicalPhone, context);
      setSuccess(true);
      setTimeout(() => {
        navigate("/auth/register", { replace: true });
      }, 900);
    } catch (err) {
      const message = normalizeCaughtError(
        err,
        "Could not activate this code. Check the code and phone number.",
      );
      setError(message);
      if (message.toLowerCase().includes("already been used")) {
        setAlreadyActivated(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-7 pt-4">
      <div className="mb-5">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#ecf3ff] px-3 py-1 text-xs font-medium text-[#0066ff] mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          Step 1 — Clinic activation
        </div>
        <h1 className="font-semibold text-2xl text-[#1A1B1E]">
          Activate your clinic
        </h1>
        <p className="text-[#929296] mt-1.5 text-sm leading-relaxed">
          Enter the phone number and 6-digit code from your MediCare welcome
          message to unlock your clinic dashboard.
        </p>
      </div>

      {info && !error && (
        <p className="mb-4 text-sm text-[#0066ff] bg-[#ecf3ff] border border-[#0066ff]/20 rounded-xl px-3 py-2.5">
          {info}
        </p>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 auth-page-enter">
          <Building2 className="h-5 w-5 shrink-0" />
          <span>Clinic activated! Setting up your profile…</span>
        </div>
      )}

      {alreadyActivated && !success && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm auth-page-enter">
          <div className="flex items-start gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Dashboard already activated</p>
              <p className="text-xs mt-1 text-green-700/90">
                Skip the code and continue to create your administrator account.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={goToRegister}
            className="mt-3 w-full h-10 rounded-xl bg-[#0066ff] hover:bg-[#0052cc] text-white"
          >
            Continue to registration
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-[#929296]">
            Registered phone number
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              setError(null);
              setInfo(null);
            }}
            placeholder="+963912345680"
            disabled={loading || success}
            required
            className={cn(
              "h-11 px-3.5 text-base",
              error && "border-red-500 focus-visible:ring-red-100",
            )}
          />
        </div>

        {!alreadyActivated && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#1A1B1E] text-center">
              6-digit activation code
            </p>
            <DigitCodeInput
              value={code}
              onChange={(v) => {
                setCode(v);
                setError(null);
              }}
              disabled={loading || success}
              invalid={Boolean(error)}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 text-center bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            {error}
          </p>
        )}

        {!alreadyActivated && (
          <Button
            type="submit"
            disabled={loading || success || code.length !== 6 || !phoneNumber.trim()}
            className="w-full h-11 rounded-xl bg-[#0066ff] hover:bg-[#0052cc] text-white font-medium"
          >
            {loading ? (
              "Activating…"
            ) : success ? (
              "Redirecting…"
            ) : (
              <span className="inline-flex items-center gap-2">
                Continue to profile
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        )}
      </form>

      <div className="mt-6 text-center">
        <Link
          to="/auth/login"
          className="inline-flex items-center gap-1.5 text-[#0066ff] text-sm hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
