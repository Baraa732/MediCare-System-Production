import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  ImageIcon,
  MapPin,
  Shield,
  User,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerClinicAdmin } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { applyActivationProfileToForm, activationContextFromStatus, activationFieldLocks } from "@/lib/activationProfile";
import { fetchOnboardingStatus, clearActivationProgress } from "@/lib/onboarding";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useRegistrationImagesStore } from "@/stores/registrationImagesStore";
import { RegisterSubSteps } from "@/components/auth/AuthStepProgress";
import { ResumeRegistrationPanel } from "@/components/auth/ResumeRegistrationPanel";
import { ImageUploadZone } from "@/components/auth/ImageUploadZone";
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
    birthPlace: z.string().min(2, "Birth place is required"),
    phoneNumber: z.string().min(8, "Phone number is required"),
    email: z
      .string()
      .email("Enter a valid email")
      .optional()
      .or(z.literal("")),
    governorate: z.string().optional().or(z.literal("")),
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
  ["firstName", "middleName", "lastName", "gender", "birthPlace"],
  [],
  ["password", "confirmPassword"],
];

const IMAGES_STEP = 1;

const selectClass =
  "h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition-colors focus-visible:border-[#0066ff] focus-visible:ring-2 focus-visible:ring-[#0066ff]/15";

const lockedInputClass =
  "h-10 rounded-xl bg-[#f7f9fc] border border-neutral-200 text-[#1A1B1E] cursor-not-allowed text-sm";

const fieldClass = "h-10 rounded-xl border-neutral-200";

export function RegisterPage() {
  const navigate = useNavigate();
  const phoneFromActivation = useAuthStore((s) => s.phoneNumber);
  const sessionContext = useAuthStore((s) => s.activationContext);
  const persistedContext = useOnboardingStore((s) => s.activationContext);
  const activationContext = sessionContext ?? persistedContext;
  const activatedPhone = useOnboardingStore((s) => s.activatedPhone);
  const setPendingRegistration = useAuthStore((s) => s.setPendingRegistration);
  const lockedFields = useMemo(
    () => ({
      ...activationFieldLocks(activationContext),
      phone: Boolean(
        activationContext?.phoneNumber ?? phoneFromActivation ?? activatedPhone,
      ),
    }),
    [activationContext, phoneFromActivation, activatedPhone],
  );
  const [gatePhase, setGatePhase] = useState<
    "loading" | "resume" | "form" | "already-registered"
  >("loading");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const profileImage = useRegistrationImagesStore((s) => s.profileImage);
  const clinicImage = useRegistrationImagesStore((s) => s.clinicImage);
  const setProfileImage = useRegistrationImagesStore((s) => s.setProfileImage);
  const setClinicImage = useRegistrationImagesStore((s) => s.setClinicImage);
  const clearRegistrationImages = useRegistrationImagesStore((s) => s.clear);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      gender: undefined,
      birthPlace: "",
      phoneNumber: "",
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
          clearActivationProgress();
          if (!cancelled) setGatePhase("already-registered");
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
        applyActivationProfileToForm(
          {
            setValue: (name, value, options) =>
              form.setValue(name as keyof FormValues, value as FormValues[keyof FormValues], options),
            getValues: (name) => form.getValues(name as keyof FormValues),
          },
          activationContextFromStatus(status) ?? null,
          status.phoneNumber,
        );
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
    const phone = phoneFromActivation ?? activatedPhone ?? undefined;
    applyActivationProfileToForm(
      {
        setValue: (name, value, options) =>
          form.setValue(name as keyof FormValues, value as FormValues[keyof FormValues], options),
        getValues: (name) => form.getValues(name as keyof FormValues),
      },
      activationContext,
      phone,
    );
  }, [activationContext, form, phoneFromActivation, activatedPhone]);

  const goNext = async () => {
    setError(null);
    if (step === IMAGES_STEP) {
      if (!profileImage || !clinicImage) {
        setError("Please upload both your profile photo and clinic image.");
        return;
      }
      setStep((s) => Math.min(s + 1, STEP_FIELDS.length - 1));
      return;
    }
    const valid = await form.trigger(STEP_FIELDS[step], { shouldFocus: true });
    if (!valid) {
      setError("Please complete the required fields below to continue.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_FIELDS.length - 1));
  };

  const goBack = () => {
    setError(null);
    if (step === 0) {
      clearRegistrationImages();
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
        birthDate: activationContext?.dateOfBirth || undefined,
        birthPlace: data.birthPlace,
        nationalId: activationContext?.idNumber || undefined,
        governorate: data.governorate || undefined,
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
    { icon: ImageIcon, title: "Clinic branding", desc: "Upload your profile photo and clinic image" },
    { icon: Shield, title: "Secure your account", desc: "Create a strong password" },
  ];
  const StepIcon = stepTitles[step].icon;

  if (gatePhase === "loading") {
    return (
      <div className="px-5 py-10 text-center text-[#929296] text-sm">
        Checking your clinic status…
      </div>
    );
  }

  if (gatePhase === "already-registered") {
    return (
      <div className="px-5 pb-5 pt-2 sm:px-6 text-center space-y-3">
        <h1 className="font-semibold text-xl text-[#1A1B1E]">Account already exists</h1>
        <p className="text-sm text-[#929296] leading-relaxed">
          This phone number already has a clinic admin account. Sign in with your
          phone and password to open the dashboard.
        </p>
        <Button
          asChild
          className="w-full h-11 rounded-xl bg-[#0066ff] hover:bg-[#0052cc] text-white font-medium"
        >
          <Link to="/auth/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  if (gatePhase === "resume") {
    return (
      <div className="px-5 py-3 sm:px-6">
        <div className="mb-4">
          <h1 className="font-semibold text-xl text-[#1A1B1E]">
            Complete your profile
          </h1>
          <p className="text-[#929296] mt-1 text-sm">
            Resume registration for your activated clinic dashboard.
          </p>
        </div>
        <ResumeRegistrationPanel onReady={() => setGatePhase("form")} />
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
    <div>
      <div className="mb-4">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#ecf3ff] px-3 py-1 text-[11px] font-semibold text-[#0066ff] mb-2">
          <StepIcon className="h-3.5 w-3.5" />
          Step 2 — {stepTitles[step].title}
        </div>
        <h1 className="font-semibold text-lg text-[#1A1B1E] tracking-tight">
          Complete your profile
        </h1>
        <p className="text-[#929296] mt-0.5 text-sm">{stepTitles[step].desc}</p>
      </div>

      {activationContext?.clinicLocation && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#0066ff]/15 bg-[#ecf3ff]/50 px-3 py-2 text-xs text-[#1A1B1E]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0066ff]" />
          <span>
            <span className="font-semibold text-[#0066ff]">Clinic: </span>
            {activationContext.clinicLocation}
          </span>
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
        className="space-y-3"
      >
        {step === 0 && (
          <div className="space-y-4 auth-page-enter">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A1B1E]">First name *</Label>
                <Input
                  {...form.register("firstName")}
                  placeholder="First name"
                  className={cn(fieldClass, lockedFields.name && lockedInputClass)}
                  readOnly={lockedFields.name}
                  disabled={loading}
                />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A1B1E]">Middle name</Label>
                <Input
                  {...form.register("middleName")}
                  placeholder="Optional"
                  className={fieldClass}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A1B1E]">Last name *</Label>
                <Input
                  {...form.register("lastName")}
                  placeholder="Last name"
                  className={cn(fieldClass, lockedFields.name && lockedInputClass)}
                  readOnly={lockedFields.name}
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
                <Label className="text-xs font-medium text-[#1A1B1E]">Gender *</Label>
                <Controller
                  name="gender"
                  control={form.control}
                  render={({ field }) => (
                    <select
                      {...field}
                      value={field.value ?? ""}
                      className={selectClass}
                      disabled={loading}
                    >
                      <option value="" disabled>
                        Select gender
                      </option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  )}
                />
                {form.formState.errors.gender && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.gender.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A1B1E]">Birth place *</Label>
                <Input
                  {...form.register("birthPlace")}
                  placeholder="City or town where you were born"
                  className={fieldClass}
                  disabled={loading}
                />
                {form.formState.errors.birthPlace && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.birthPlace.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {step === IMAGES_STEP && (
          <div className="space-y-4 auth-page-enter">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ImageUploadZone
                label="Profile image"
                helper="Your photo as clinic administrator"
                value={profileImage}
                onChange={setProfileImage}
                disabled={loading}
                variant="circle"
              />
              <ImageUploadZone
                label="Clinic image"
                helper="Logo or photo representing your clinic"
                value={clinicImage}
                onChange={setClinicImage}
                disabled={loading}
                variant="square"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 auth-page-enter">
            <div className="rounded-xl border border-neutral-100 bg-[#fafcff] p-3.5 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#929296]">
                Account security
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A1B1E]">Password *</Label>
                <div className="relative">
                  <Input
                    {...form.register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    autoComplete="off"
                    className={cn(fieldClass, "pr-11")}
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
                <Label className="text-xs font-medium text-[#1A1B1E]">Confirm password *</Label>
                <div className="relative">
                  <Input
                    {...form.register("confirmPassword")}
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your password"
                    autoComplete="off"
                    className={cn(fieldClass, "pr-11")}
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
            className="h-10 rounded-xl flex-1 border-neutral-200"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="h-10 rounded-xl flex-1 bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-sm shadow-blue-200"
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

      <div className="mt-3 text-center">
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
