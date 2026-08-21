// src/features/auth/schemas/loginSchema.ts
import { z } from "zod";
import { isValidSyrianPhone, SYRIAN_PHONE_HINT } from "@/lib/phone";

export const signInSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, "Phone number is required")
    .refine(isValidSyrianPhone, {
      message: `Enter a valid Syrian phone number (${SYRIAN_PHONE_HINT})`,
    }),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  rememberMe: z.boolean().default(false),
});

export type SignInFormValues = z.infer<typeof signInSchema>;
