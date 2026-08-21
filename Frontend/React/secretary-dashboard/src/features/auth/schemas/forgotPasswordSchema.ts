import z from "zod";
import { isValidSyrianPhone, SYRIAN_PHONE_HINT } from "@/lib/phone";

export const forgotPasswordSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, { message: "Phone number is required" })
    .refine(isValidSyrianPhone, {
      message: `Enter a valid Syrian phone number (${SYRIAN_PHONE_HINT})`,
    }),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const forgotPasswordOtpSchema = z.object({
  otp: z
    .string()
    .min(6, "Enter the 6-digit code")
    .max(6, "Enter the 6-digit code")
    .regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export type ForgotPasswordOtpFormData = z.infer<typeof forgotPasswordOtpSchema>;

export const forgotPasswordVerifySchema = z
  .object({
    otp: z
      .string()
      .min(6, "Enter the 6-digit code")
      .max(6, "Enter the 6-digit code")
      .regex(/^\d{6}$/, "OTP must be 6 digits"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/,
        "Include uppercase, lowercase, number, and special character",
      ),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ForgotPasswordVerifyFormData = z.infer<
  typeof forgotPasswordVerifySchema
>;
