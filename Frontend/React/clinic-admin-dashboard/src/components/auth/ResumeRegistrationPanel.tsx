import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Phone } from "lucide-react";
import { fetchOnboardingStatus, clearActivationProgress } from "@/lib/onboarding";
import { normalizeCaughtError } from "@/lib/api/errors";
import { normalizeSyrianPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { authInputNoAutofill } from "@/lib/authInput";

type ResumeRegistrationPanelProps = {
  onReady: () => void;
};

export function ResumeRegistrationPanel({ onReady }: ResumeRegistrationPanelProps) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setError(null);
    let formatted: string;
    try {
      formatted = normalizeSyrianPhone(phone);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Enter a valid phone number.",
      );
      return;
    }

    setLoading(true);
    try {
      const status = await fetchOnboardingStatus(formatted);

      if (status.canLogin) {
        clearActivationProgress();
        navigate("/auth/login", {
          replace: true,
          state: {
            flash:
              "You already have an account. Sign in with your phone and password.",
          },
        });
        return;
      }

      if (!status.canRegister) {
        navigate("/auth/activate-code", {
          replace: true,
          state: {
            flash:
              "This phone isn’t activated yet. Enter your 6-digit MediCare code first.",
          },
        });
        return;
      }

      onReady();
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not verify your clinic status."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 auth-page-enter">
      <div className="rounded-xl border border-[#0066ff]/15 bg-[#ecf3ff]/40 px-4 py-3 text-sm text-[#1A1B1E]">
        <p className="font-medium text-[#0066ff]">Resume your setup</p>
        <p className="text-[#929296] text-xs mt-1 leading-relaxed">
          Enter the same phone number you used when activating your clinic. We’ll
          confirm your dashboard is ready before you continue.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resume-phone" className="text-[#929296]">
          Activated phone number
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            id="resume-phone"
            name="clinic-resume-phone"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError(null);
            }}
            {...authInputNoAutofill}
            placeholder="Phone number"
            disabled={loading}
            className={cn("h-11 pl-10", error && "border-red-500")}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
          {error}
        </p>
      )}

      <Button
        type="button"
        disabled={loading || !phone.trim()}
        onClick={() => void handleContinue()}
        className="w-full h-11 rounded-xl bg-[#0066ff] hover:bg-[#0052cc] text-white font-medium"
      >
        {loading ? (
          "Checking…"
        ) : (
          <span className="inline-flex items-center gap-2">
            Continue to profile
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
    </div>
  );
}
