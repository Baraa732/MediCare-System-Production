import * as z from "zod";

// 1️⃣ بناء مخطط التحقق باستخدام Zod
export const profileSchema = z.object({
  fullName: z
    .string()
    .min(3, "Full name must be at least 3 characters")
    .max(50, "Full name is too long"),
  phone: z
    .string()
    .regex(/^[0-9]+$/, "Phone number must contain digits only")
    .min(10, "Phone number must be at least 10 digits")
    .max(14, "Phone number cannot exceed 14 digits"),
});

// استخراج الـ Type تلقائياً من المخطط
export type ProfileFormValues = z.infer<typeof profileSchema>;
