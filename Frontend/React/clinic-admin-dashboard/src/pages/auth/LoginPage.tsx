import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { isMfaRequired, login } from "@/lib/api/auth";
import { toLoginErrorMessage } from "@/lib/api/errors";
import { fetchOnboardingStatus, clearActivationProgress } from "@/lib/onboarding";
import { normalizeSyrianPhone } from "@/lib/phone";
import { AuthEntryLinks } from "@/components/auth/AuthEntryLinks";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";

const schema = z.object({
  phoneNumber: z.string().min(8, "Enter a valid phone number"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const setSession = useAuthStore((s) => s.setSession);
  const setPendingMfa = useAuthStore((s) => s.setPendingMfa);
  const activatedPhone = useOnboardingStore((s) => s.activatedPhone);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(flash ?? null);
  const [loading, setLoading] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState(false);
  const [accountReady, setAccountReady] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phoneNumber: "", password: "" },
  });

  const watchedPhone = watch("phoneNumber");

  // Browser autofill fills the DOM but skips react-hook-form — sync on load.
  useEffect(() => {
    const syncAutofill = () => {
      const phoneEl = document.getElementById("phoneNumber") as HTMLInputElement | null;
      const passwordEl = document.getElementById("password") as HTMLInputElement | null;
      if (phoneEl?.value) setValue("phoneNumber", phoneEl.value, { shouldValidate: true });
      if (passwordEl?.value) setValue("password", passwordEl.value, { shouldValidate: true });
    };
    syncAutofill();
    const t1 = window.setTimeout(syncAutofill, 100);
    const t2 = window.setTimeout(syncAutofill, 500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [setValue]);

  useEffect(() => {
    if (!activatedPhone) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchOnboardingStatus(activatedPhone);
        if (cancelled) return;
        setPendingRegistration(status.canRegister);
        setAccountReady(status.canLogin);
        if (status.canLogin) {
          clearActivationProgress();
        }
      } catch {
        // ignore — typed phone check may still run
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activatedPhone]);

  useEffect(() => {
    const digits = watchedPhone.replace(/\D/g, "");
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          const phoneToCheck =
            digits.length >= 9 ? watchedPhone : activatedPhone;
          if (!phoneToCheck) {
            if (!cancelled) {
              setPendingRegistration(false);
              setAccountReady(false);
            }
            return;
          }

          const status = await fetchOnboardingStatus(phoneToCheck);
          if (cancelled) return;

          setPendingRegistration(status.canRegister);
          setAccountReady(status.canLogin);
          if (status.canRegister && digits.length >= 9) {
            setInfo(
              "This phone is activated but your admin account isn’t complete yet. Finish registration or sign in after you’re done.",
            );
          } else if (status.canLogin) {
            clearActivationProgress();
            setInfo(null);
          } else {
            setAccountReady(false);
          }
        } catch {
          if (!cancelled) setPendingRegistration(false);
        }
      })();
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [watchedPhone, activatedPhone]);

  const submitLogin = handleSubmit(async (data) => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      let formattedPhone = data.phoneNumber;
      try {
        formattedPhone = normalizeSyrianPhone(data.phoneNumber);
      } catch {
        // backend will validate
      }

      const status = await fetchOnboardingStatus(formattedPhone);
      if (!status.dashboardActivated) {
        setError(
          "Your clinic dashboard isn’t activated yet. Use your MediCare activation code first.",
        );
        return;
      }
      if (!status.registered) {
        setError(
          "No account found for this phone yet. Complete your admin registration first.",
        );
        setPendingRegistration(true);
        return;
      }

      const response = await login(formattedPhone, data.password);
      if (isMfaRequired(response)) {
        setPendingMfa({
          mfaToken: response.mfaToken,
          phoneNumber: formattedPhone,
          requiresPasswordChange: response.requiresPasswordChange,
        });
        navigate("/auth/otp", { replace: true });
        return;
      }
      setSession(response);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(toLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  });

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const phoneEl = document.getElementById("phoneNumber") as HTMLInputElement | null;
    const passwordEl = document.getElementById("password") as HTMLInputElement | null;
    if (phoneEl?.value) {
      setValue("phoneNumber", phoneEl.value, { shouldValidate: true });
    }
    if (passwordEl?.value) {
      setValue("password", passwordEl.value, { shouldValidate: true });
    }
    void submitLogin();
  };

  return (
    <div className="px-6 pb-5 pt-1 sm:px-8 sm:pb-6">
      <div className="mb-5">
        <h1 className="font-semibold text-2xl text-[#1A1B1E]">Sign in</h1>
        <p className="text-[#929296] mt-1 text-sm">
          Welcome back — manage your clinic staff, schedule, and operations.
        </p>
      </div>

      {accountReady && (
        <p className="mb-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          Your clinic admin account is ready — sign in with your phone and password.
        </p>
      )}

      {info && !pendingRegistration && !accountReady && (
        <p className="mb-3 text-sm text-[#0066ff] bg-[#ecf3ff] border border-[#0066ff]/20 rounded-xl px-3 py-2">
          {info}
        </p>
      )}

      {pendingRegistration && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          <p className="font-medium">Finish setting up your account</p>
          <p className="text-xs mt-0.5 text-amber-800/90">
            Your clinic is activated — complete your admin profile to sign in.
          </p>
          <Button
            asChild
            size="sm"
            className="mt-2 h-8 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white"
          >
            <Link to="/auth/register">Continue registration</Link>
          </Button>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="phoneNumber" className="text-sm text-[#929296]">
            Phone number
          </label>
          <input
            {...register("phoneNumber")}
            id="phoneNumber"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Phone number"
            disabled={loading}
            className={cn(
              "w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-4 transition-all",
              errors.phoneNumber || error
                ? "border-red-500 focus:ring-red-100"
                : "border-neutral-200 focus:border-[#0066ff] focus:ring-blue-100",
            )}
          />
          {errors.phoneNumber && (
            <p className="text-sm text-red-500">{errors.phoneNumber.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm text-[#929296]">
              Password
            </label>
            <Link
              to="/auth/forgot-password"
              className="text-xs font-semibold text-[#0066ff] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              {...register("password")}
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Password"
              disabled={loading}
              className={cn(
                "w-full pl-4 pr-11 py-2.5 border rounded-lg outline-none focus:ring-4 transition-all",
                errors.password || error
                  ? "border-red-500 focus:ring-red-100"
                  : "border-neutral-200 focus:border-[#0066ff] focus:ring-blue-100",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white font-medium disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <AuthEntryLinks
        registerHint={
          pendingRegistration
            ? "Your clinic is ready — complete your administrator profile to start signing in."
            : undefined
        }
      />
    </div>
  );
}
