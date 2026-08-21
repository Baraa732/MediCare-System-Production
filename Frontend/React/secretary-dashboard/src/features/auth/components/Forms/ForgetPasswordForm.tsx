import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import type { ForgotPasswordFormProps } from "../../types";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "../../schemas/forgotPasswordSchema";
import { normalizeSyrianPhone, sanitizePhoneInput } from "@/lib/phone";

export function ForgotPasswordForm({
  onSendResetCode,
  isLoading = false,
  errorMessage,
}: ForgotPasswordFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { phoneNumber: "" },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    onSendResetCode(normalizeSyrianPhone(data.phoneNumber));
  };

  return (
    <div className="flex-1 flex flex-col justify-center p-7 w-full mx-auto">
      <div className="mb-8">
        <h1 className="font-inter text-[36px] font-semibold leading-[1.3] tracking-[-0.5px] text-[#1A1B1E]">
          Forgot password?
        </h1>
        <p className="font-inter text-[22px] font-normal leading-[1.6] tracking-normal text-[#929296] mt-3">
          Enter your registered phone number and we&apos;ll send a verification code via WhatsApp.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <input
            {...register("phoneNumber")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Phone (09… or +963…)"
            disabled={isLoading}
            onChange={(e) => {
              const next = sanitizePhoneInput(e.target.value);
              setValue("phoneNumber", next, { shouldValidate: true });
            }}
            className={cn(
              "w-full px-4 py-3 font-inter text-[18px] border rounded-lg outline-hidden focus:ring-4 transition-all",
              errors.phoneNumber
                ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                : "border-neutral-200 focus:border-blue-500 focus:ring-blue-100",
            )}
          />
          {errors.phoneNumber && (
            <p className="text-sm text-red-600">{errors.phoneNumber.message}</p>
          )}
        </div>

        {errorMessage && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {errorMessage}
          </p>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-13 bg-[#0066ff] hover:bg-[#0052cc] text-white font-semibold rounded-xl"
        >
          {isLoading ? "Sending code…" : "Send verification code"}
        </Button>

        <div className="space-y-4 pt-4">
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-1.5 font-inter text-[18px] font-normal text-[#0B74FA] underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
        </div>
      </form>
    </div>
  );
}
