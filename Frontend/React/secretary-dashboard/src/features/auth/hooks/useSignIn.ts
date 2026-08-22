import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { signInSchema, type SignInFormValues } from "../schemas/loginSchema";
import { isMfaRequired, login } from "@/lib/api/auth";
import { toLoginErrorMessage } from "@/lib/api/errors";
import { normalizeSyrianPhone } from "@/lib/phone";
import { useAuthStore } from "@/stores/authStore";

const INVALID_CREDENTIALS =
  "Incorrect phone number or password. Please try again.";

function isSecretaryRole(role?: string): boolean {
  return role === "SECRETARY";
}

export function useSignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorAPI, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setPendingMfa = useAuthStore((s) => s.setPendingMfa);

  const form = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      phoneNumber: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: SignInFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const phoneNumber = normalizeSyrianPhone(data.phoneNumber);
      const response = await login(phoneNumber, data.password);

      if (isMfaRequired(response)) {
        if (!isSecretaryRole(response.role)) {
          setError(INVALID_CREDENTIALS);
          return;
        }
        setPendingMfa({
          mfaToken: response.mfaToken,
          phoneNumber,
          requiresPasswordChange: response.requiresPasswordChange,
          clinicId: response.clinicId,
          userId: response.userId,
          role: response.role,
          whatsappSent: response.whatsappSent,
          whatsappHint: response.whatsappHint,
        });
        navigate("/auth/otp", { replace: true });
        return;
      }

      if (!isSecretaryRole(response.role)) {
        setError(INVALID_CREDENTIALS);
        return;
      }

      setSession(response);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setError(toLoginErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    onSubmit: form.handleSubmit(onSubmit),
    isLoading,
    errorAPI,
  };
}
