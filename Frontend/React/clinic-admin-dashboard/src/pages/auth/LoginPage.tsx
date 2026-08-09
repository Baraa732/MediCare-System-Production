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
import { useAuthStore } from "@/stores/authStore";

const schema = z.object({
  phoneNumber: z.string().min(8, "Enter a valid phone number"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const INVALID_CREDENTIALS =
  "Incorrect phone number or password. Please try again.";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const setPendingMfa = useAuthStore((s) => s.setPendingMfa);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Drop one-shot router flash after reading (keeps URL state clean).
  useEffect(() => {
    if ((location.state as { flash?: string } | null)?.flash) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phoneNumber: "", password: "" },
  });

  // Browser autofill fills the DOM but skips react-hook-form — sync on load.
  useEffect(() => {
    const syncAutofill = () => {
      const phoneEl = document.getElementById(
        "phoneNumber",
      ) as HTMLInputElement | null;
      const passwordEl = document.getElementById(
        "password",
      ) as HTMLInputElement | null;
      if (phoneEl?.value) {
        setValue("phoneNumber", phoneEl.value, { shouldValidate: true });
      }
      if (passwordEl?.value) {
        setValue("password", passwordEl.value, { shouldValidate: true });
      }
    };
    syncAutofill();
    const t1 = window.setTimeout(syncAutofill, 100);
    const t2 = window.setTimeout(syncAutofill, 500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [setValue]);

  const submitLogin = handleSubmit(async (data) => {
    setLoading(true);
    setError(null);
    try {
      let formattedPhone = data.phoneNumber;
      try {
        formattedPhone = normalizeSyrianPhone(data.phoneNumber);
      } catch {
        // backend will validate
      }

      // Soft onboarding gate — only when phone clearly isn't ready to log in.
      try {
        const status = await fetchOnboardingStatus(formattedPhone);
        if (!status.dashboardActivated && !status.registered) {
          setError(
            "This clinic isn’t activated yet. Use your MediCare activation code first.",
          );
          return;
        }
        if (status.dashboardActivated && !status.registered) {
          setError(
            "Finish creating your administrator account before signing in.",
          );
          return;
        }
        if (status.canLogin) {
          clearActivationProgress();
        }
      } catch {
        // Fall through to auth — credentials check is the source of truth.
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
      if (response.role !== "CLINIC_ADMIN") {
        // Same copy as bad credentials — don’t lecture about “wrong dashboard”.
        setError(INVALID_CREDENTIALS);
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
    const phoneEl = document.getElementById(
      "phoneNumber",
    ) as HTMLInputElement | null;
    const passwordEl = document.getElementById(
      "password",
    ) as HTMLInputElement | null;
    if (phoneEl?.value) {
      setValue("phoneNumber", phoneEl.value, { shouldValidate: true });
    }
    if (passwordEl?.value) {
      setValue("password", passwordEl.value, { shouldValidate: true });
    }
    void submitLogin();
  };

  return (
    <div className="px-6 pb-6 pt-1 sm:px-8 sm:pb-7">
      <div className="mb-6">
        <h1 className="font-semibold text-2xl text-[#1A1B1E]">Sign in</h1>
        <p className="text-[#929296] mt-1 text-sm">
          Enter your clinic administrator phone and password.
        </p>
      </div>

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
              aria-label={showPassword ? "Hide password" : "Show password"}
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

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white font-medium disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-neutral-100 space-y-2 text-center text-sm text-[#929296]">
        <p>
          New clinic?{" "}
          <Link
            to="/auth/activate-code"
            className="font-semibold text-[#0066ff] hover:underline"
          >
            Activate with your code
          </Link>
        </p>
        <p>
          Already activated?{" "}
          <Link
            to="/auth/register"
            className="font-semibold text-[#0066ff] hover:underline"
          >
            Complete admin registration
          </Link>
        </p>
      </div>
    </div>
  );
}
