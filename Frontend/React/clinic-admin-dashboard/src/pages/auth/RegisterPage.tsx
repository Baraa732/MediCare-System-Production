import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  MapPin,
  Shield,
  User,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerClinicAdmin } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { fetchOnboardingStatus } from "@/lib/onboarding";
import { formatPhoneDisplay } from "@/lib/phone";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { RegisterSubSteps } from "@/components/auth/AuthStepProgress";
import { ResumeRegistrationPanel } from "@/components/auth/ResumeRegistrationPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/\d/, "Include a number")
  .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, "Include a special character");

const schema = z
  .object({
    firstName: z.string().min(2, "First name is required"),
    middleName: z.string().optional(),
    lastName: z.string().min(2, "Last name is required"),
    gender: z.enum(["MALE", "FEMALE", "OTHER"], {
      message: "Select your gender",
    }),
    birthDate: z.string().min(1, "Date of birth is required"),
    birthPlace: z.string().min(2, "Birth place is required"),
    nationalId: z.string().optional(),
    maritalStatus: z
      .enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"])
      .optional(),
    motherName: z.string().optional(),
    motherLastName: z.string().optional(),
    phoneNumber: z.string().min(8, "Phone number is required"),
    email: z
      .string()
      .email("Enter a valid email")
      .optional()
      .or(z.literal("")),
    governorate: z.string().min(2, "Governorate is required"),
    state: z.string().optional(),
    streetInfo: z.string().optional(),
    licenseNumber: z.string().optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

const STEP_FIELDS: (keyof FormValues)[][] = [
  [
    "firstName",
    "middleName",
    "lastName",
    "gender",
    "birthDate",
    "birthPlace",
    "nationalId",
    "maritalStatus",
    "motherName",
    "motherLastName",
  ],
  ["phoneNumber", "email", "governorate", "state", "streetInfo", "licenseNumber"],
  ["password", "confirmPassword"],
];

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function RegisterPage() {
  const navigate = useNavigate();
  const phoneFromActivation = useAuthStore((s) => s.phoneNumber);
  const sessionContext = useAuthStore((s) => s.activationContext);
  const persistedContext = useOnboardingStore((s) => s.activationContext);
  const activationContext = sessionContext ?? persistedContext;
  const activatedPhone = useOnboardingStore((s) => s.activatedPhone);
  const setPendingRegistration = useAuthStore((s) => s.setPendingRegistration);
  const [gatePhase, setGatePhase] = useState<"loading" | "resume" | "form">(
    "loading",
  );
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      gender: undefined,
      birthDate: "",
      birthPlace: "",
      nationalId: "",
      maritalStatus: undefined,
      motherName: "",
      motherLastName: "",
      phoneNumber: phoneFromActivation ?? "",
      email: "",
      governorate: "",
      state: "",
      streetInfo: "",
      licenseNumber: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onBlur",
  });

  useEffect(() => {
    let cancelled = false;

    async function verifyAccess() {
      const candidatePhone = phoneFromActivation ?? activatedPhone;
      if (!candidatePhone) {
        if (!cancelled) setGatePhase("resume");
        return;
      }

      try {
        const status = await fetchOnboardingStatus(candidatePhone);
        if (cancelled) return;

        if (status.canLogin) {
          navigate("/auth/login", {
            replace: true,
            state: {
              flash:
                "You already registered. Sign in with your phone and password.",
            },
          });
          return;
        }

        if (!status.canRegister) {
          navigate("/auth/activate-code", {
            replace: true,
            state: {
              flash:
                "Activate your clinic with your MediCare code before registering.",
            },
          });
          return;
        }

        form.setValue("phoneNumber", status.phoneNumber);
        setGatePhase("form");
      } catch {
        if (!cancelled) setGatePhase("resume");
      }
    }

    void verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [phoneFromActivation, activatedPhone, navigate, form]);

  useEffect(() => {
    if (!activationContext?.adminFullName) return;
    const parts = activationContext.adminFullName.trim().split(/\s+/);
    if (parts.length >= 1 && !form.getValues("firstName")) {
      form.setValue("firstName", parts[0]);
    }
    if (parts.length >= 2 && !form.getValues("lastName")) {
      form.setValue("lastName", parts.slice(1).join(" "));
    }
  }, [activationContext, form]);

  const goNext = async () => {
    setError(null);
    const valid = await form.trigger(STEP_FIELDS[step]);
    if (!valid) return;
    setStep((s) => Math.min(s + 1, STEP_FIELDS.length - 1));
  };

  const goBack = () => {
    setError(null);
    if (step === 0) {
      navigate("/auth/activate-code");
      return;
    }
    setStep((s) => s - 1);
  };

  const onSubmit = form.handleSubmit(async (data) => {
    setLoading(true);
    setError(null);
    try {
      const res = await registerClinicAdmin({
        phoneNumber: data.phoneNumber,
        firstName: data.firstName,
        middleName: data.middleName || undefined,
        lastName: data.lastName,
        password: data.password,
        email: data.email || undefined,
        gender: data.gender,
        birthDate: data.birthDate,
        birthPlace: data.birthPlace,
        nationalId: data.nationalId || undefined,
        maritalStatus: data.maritalStatus,
        motherName: data.motherName || undefined,
        motherLastName: data.motherLastName || undefined,
        governorate: data.governorate,
        state: data.state || undefined,
        streetInfo: data.streetInfo || undefined,
        licenseNumber: data.licenseNumber || undefined,
      });
      if (res.devOtp) {
        console.info(`[dev] Registration OTP: ${res.devOtp}`);
      }
      setPendingRegistration(data.phoneNumber);
      navigate("/auth/otp", {
        replace: true,
        state: {
          whatsappSent: res.whatsappSent,
          whatsappHint: res.whatsappHint,
          devOtp: res.devOtp,
        },
      });
    } catch (err) {
      setError(normalizeCaughtError(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  });

  const stepTitles = [
    { icon: User, title: "Personal information", desc: "Your identity as clinic administrator" },
    { icon: MapPin, title: "Contact & location", desc: "How patients and staff reach you" },
    { icon: Shield, title: "Secure your account", desc: "Create a strong password" },
  ];
  const StepIcon = stepTitles[step].icon;

  if (gatePhase === "loading") {
    return (
      <div className="p-7 py-16 text-center text-[#929296] text-sm">
        Checking your clinic status…
      </div>
    );
  }

  if (gatePhase === "resume") {
    return (
      <div className="p-7 pt-4">
        <div className="mb-5">
          <h1 className="font-semibold text-2xl text-[#1A1B1E]">
            Complete your profile
          </h1>
          <p className="text-[#929296] mt-1 text-sm">
            Resume registration for your activated clinic dashboard.
          </p>
        </div>
        <ResumeRegistrationPanel
          initialPhone={activatedPhone ?? ""}
          onReady={() => setGatePhase("form")}
        />
        <div className="mt-6 text-center">
          <Link
            to="/auth/login"
            className="text-[#0066ff] text-sm hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 pt-4">
      <div className="mb-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#ecf3ff] px-3 py-1 text-xs font-medium text-[#0066ff] mb-3">
          <StepIcon className="h-3.5 w-3.5" />
          Step 2 — {stepTitles[step].title}
        </div>
        <h1 className="font-semibold text-2xl text-[#1A1B1E]">
          Complete your profile
        </h1>
        <p className="text-[#929296] mt-1 text-sm">{stepTitles[step].desc}</p>
      </div>

      {activationContext?.clinicLocation && (
        <div className="mb-4 rounded-xl border border-[#0066ff]/20 bg-[#ecf3ff]/60 px-4 py-3 text-sm text-[#1A1B1E] auth-page-enter">
          <span className="font-medium text-[#0066ff]">Clinic location: </span>
          {activationContext.clinicLocation}
        </div>
      )}

      <RegisterSubSteps current={step} total={STEP_FIELDS.length} />

      <form
        onSubmit={(e) => {
          if (step < STEP_FIELDS.length - 1) {
            e.preventDefault();
            void goNext();
            return;
          }
          void onSubmit(e);
        }}
        className="space-y-4"
      >
        {step === 0 && (
          <div className="space-y-4 auth-page-enter">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>First name *</Label>
                <Input
                  {...form.register("firstName")}
                  className="h-11"
                  disabled={loading}
                />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Middle name</Label>
                <Input
                  {...form.register("middleName")}
                  className="h-11"
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last name *</Label>
                <Input
                  {...form.register("lastName")}
                  className="h-11"
                  disabled={loading}
                />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gender *</Label>
                <select
                  {...form.register("gender")}
                  className={selectClass}
                  disabled={loading}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select gender
                  </option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
                {form.formState.errors.gender && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.gender.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Date of birth *</Label>
                <Input
                  type="date"
                  {...form.register("birthDate")}
                  className="h-11"
                  disabled={loading}
                />
                {form.formState.errors.birthDate && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.birthDate.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Birth place *</Label>
                <Input
                  {...form.register("birthPlace")}
                  placeholder="City, governorate"
                  className="h-11"
                  disabled={loading}
                />
                {form.formState.errors.birthPlace && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.birthPlace.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>National ID</Label>
                <Input
                  {...form.register("nationalId")}
                  className="h-11"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Marital status</Label>
                <select
                  {...form.register("maritalStatus")}
                  className={selectClass}
                  disabled={loading}
                  defaultValue=""
                >
                  <option value="">Not specified</option>
                  <option value="SINGLE">Single</option>
                  <option value="MARRIED">Married</option>
                  <option value="DIVORCED">Divorced</option>
                  <option value="WIDOWED">Widowed</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Mother&apos;s first name</Label>
                <Input
                  {...form.register("motherName")}
                  className="h-11"
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mother&apos;s last name</Label>
                <Input
                  {...form.register("motherLastName")}
                  className="h-11"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 auth-page-enter">
            <div className="space-y-1.5">
              <Label>Phone number</Label>
              <Input
                readOnly
                className="h-11 bg-neutral-50 text-[#929296]"
                value={formatPhoneDisplay(
                  phoneFromActivation ?? activatedPhone ?? "",
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Work email</Label>
              <Input
                type="email"
                {...form.register("email")}
                placeholder="admin@yourclinic.com"
                className="h-11"
                disabled={loading}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Governorate *</Label>
                <Input
                  {...form.register("governorate")}
                  placeholder="e.g. Damascus"
                  className="h-11"
                  disabled={loading}
                />
                {form.formState.errors.governorate && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.governorate.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>City / area</Label>
                <Input
                  {...form.register("state")}
                  className="h-11"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Street address</Label>
              <Input
                {...form.register("streetInfo")}
                placeholder="Building, street, landmark"
                className="h-11"
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Professional license (optional)</Label>
              <Input
                {...form.register("licenseNumber")}
                placeholder="Medical admin or practice license"
                className="h-11"
                disabled={loading}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 auth-page-enter">
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <div className="relative">
                <Input
                  {...form.register("password")}
                  type={showPassword ? "text" : "password"}
                  className="h-11 pr-11"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.password.message}
                </p>
              )}
              <p className="text-xs text-[#929296]">
                8+ characters with uppercase, lowercase, number, and special character
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password *</Label>
              <div className="relative">
                <Input
                  {...form.register("confirmPassword")}
                  type={showConfirm ? "text" : "password"}
                  className="h-11 pr-11"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={loading}
            className="h-11 rounded-xl flex-1"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className={cn(
              "h-11 rounded-xl flex-1 bg-[#0066ff] hover:bg-[#0052cc] text-white",
            )}
          >
            {loading ? (
              "Creating account…"
            ) : step < STEP_FIELDS.length - 1 ? (
              <span className="inline-flex items-center gap-1">
                Continue
                <ArrowRight className="h-4 w-4" />
              </span>
            ) : (
              "Create account & verify"
            )}
          </Button>
        </div>
      </form>

      <div className="mt-5 text-center">
        <Link
          to="/auth/login"
          className="text-[#0066ff] text-sm hover:underline"
        >
          Already have an account? Sign in
        </Link>
      </div>
    </div>
  );
}
