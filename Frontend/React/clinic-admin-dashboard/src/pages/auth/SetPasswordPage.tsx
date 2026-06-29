import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { completeStaffActivation } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { useAuthStore } from "@/stores/authStore";

const schema = z
  .object({
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

export function SetPasswordPage() {
  const navigate = useNavigate();
  const activationToken = useAuthStore((s) => s.activationToken);
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!activationToken) {
      navigate("/auth/login", { replace: true });
    }
  }, [activationToken, navigate]);

  const onSubmit = form.handleSubmit(async (data) => {
    if (!activationToken) return;
    setLoading(true);
    setError(null);
    try {
      const session = await completeStaffActivation(
        activationToken,
        data.newPassword,
      );
      setSession(session);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not set password"));
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="p-7">
      <h1 className="text-2xl font-semibold text-[#1A1B1E]">Set your password</h1>
      <p className="text-[#929296] mt-1 mb-6">
        Choose a secure password for your clinic admin account.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          {...form.register("newPassword")}
          type="password"
          placeholder="New password"
          className="w-full px-4 py-3 border border-neutral-200 rounded-lg outline-none focus:border-[#0066ff] focus:ring-4 focus:ring-blue-100"
        />
        <input
          {...form.register("confirmPassword")}
          type="password"
          placeholder="Confirm password"
          className="w-full px-4 py-3 border border-neutral-200 rounded-lg outline-none focus:border-[#0066ff] focus:ring-4 focus:ring-blue-100"
        />
        {form.formState.errors.confirmPassword && (
          <p className="text-sm text-red-500">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-[#0066ff] text-white font-medium disabled:opacity-60"
        >
          {loading ? "Saving…" : "Continue to dashboard"}
        </button>
      </form>
    </div>
  );
}
