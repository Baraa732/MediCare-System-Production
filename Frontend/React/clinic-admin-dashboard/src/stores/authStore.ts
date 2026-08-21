import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthIdentity } from "@/lib/api/types";
import { useOnboardingStore } from "@/stores/onboardingStore";

export interface ActivationContext {
  adminFullName?: string;
  clinicLocation?: string;
  idNumber?: string;
  dateOfBirth?: string;
  email?: string;
  registrationLicenseNumber?: string;
  address?: string;
  phoneNumber?: string;
}

interface AuthState extends AuthIdentity {
  accessToken: string | null;
  refreshToken: string | null;
  phoneNumber: string | null;
  activationContext: ActivationContext | null;
  mfaToken: string | null;
  activationToken: string | null;
  otpFlow: "mfa" | "register" | null;
  otpSentAt: number | null;
  passwordResetPhone: string | null;
  passwordResetOtp: string | null;
  _hasHydrated: boolean;
  setSession: (
    session: AuthIdentity & { accessToken: string; refreshToken: string },
  ) => void;
  updateTokens: (
    accessToken: string,
    refreshToken: string,
    identity?: Partial<AuthIdentity>,
  ) => void;
  setPendingMfa: (payload: {
    mfaToken: string;
    phoneNumber: string;
    requiresPasswordChange?: boolean;
  }) => void;
  setPendingRegistration: (phoneNumber: string) => void;
  setPendingActivation: (activationToken: string) => void;
  setActivationPhone: (phoneNumber: string, context?: ActivationContext) => void;
  clearActivationSession: () => void;
  markOtpSent: () => void;
  clearPendingFlow: () => void;
  setPasswordResetPhone: (phoneNumber: string) => void;
  setPasswordResetOtp: (otp: string) => void;
  clearPasswordResetFlow: () => void;
  setClinicId: (clinicId: string) => void;
  setTenantId: (tenantId: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const initialState = {
  userId: "",
  role: "",
  tenantId: undefined as string | undefined,
  clinicId: undefined as string | undefined,
  accessToken: null as string | null,
  refreshToken: null as string | null,
  phoneNumber: null as string | null,
  activationContext: null as ActivationContext | null,
  mfaToken: null as string | null,
  activationToken: null as string | null,
  otpFlow: null as "mfa" | "register" | null,
  otpSentAt: null as number | null,
  passwordResetPhone: null as string | null,
  passwordResetOtp: null as string | null,
  _hasHydrated: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setSession: (session) => {
        useOnboardingStore.getState().clearOnboarding();
        set({
          userId: session.userId,
          role: session.role,
          tenantId: session.tenantId ?? session.clinicId,
          clinicId: session.tenantId ?? session.clinicId,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          mfaToken: null,
          activationToken: null,
          otpFlow: null,
          otpSentAt: null,
        });
      },
      updateTokens: (accessToken, refreshToken, identity) =>
        set({
          accessToken,
          refreshToken,
          ...(identity?.userId ? { userId: identity.userId } : {}),
          ...(identity?.role ? { role: identity.role } : {}),
          ...(identity?.tenantId !== undefined
            ? { tenantId: identity.tenantId, clinicId: identity.tenantId }
            : identity?.clinicId !== undefined
              ? { tenantId: identity.clinicId, clinicId: identity.clinicId }
              : {}),
        }),
      setPendingMfa: ({ mfaToken, phoneNumber }) =>
        set({
          mfaToken,
          phoneNumber,
          otpFlow: "mfa",
          otpSentAt: Date.now(),
          accessToken: null,
          refreshToken: null,
        }),
      setPendingRegistration: (phoneNumber) =>
        set({
          phoneNumber,
          otpFlow: "register",
          otpSentAt: Date.now(),
          mfaToken: null,
        }),
      setPendingActivation: (activationToken) =>
        set({ activationToken, mfaToken: null, otpFlow: null, otpSentAt: null }),
      setActivationPhone: (phoneNumber, context) =>
        set({ phoneNumber, activationContext: context ?? null }),
      clearActivationSession: () => {
        if (!get().accessToken) {
          set({ phoneNumber: null, activationContext: null });
        }
      },
      markOtpSent: () => set({ otpSentAt: Date.now() }),
      clearPendingFlow: () =>
        set({
          mfaToken: null,
          activationToken: null,
          otpFlow: null,
          otpSentAt: null,
        }),
      setPasswordResetPhone: (phoneNumber) =>
        set({ passwordResetPhone: phoneNumber, passwordResetOtp: null }),
      setPasswordResetOtp: (otp) => set({ passwordResetOtp: otp }),
      clearPasswordResetFlow: () =>
        set({ passwordResetPhone: null, passwordResetOtp: null }),
      setClinicId: (clinicId) => set({ clinicId, tenantId: clinicId }),
      setTenantId: (tenantId) => set({ tenantId, clinicId: tenantId }),
      logout: () => set({ ...initialState, _hasHydrated: true }),
      isAuthenticated: () => Boolean(get().accessToken),
    }),
    {
      name: "clinic-admin-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        userId: state.userId,
        role: state.role,
        tenantId: state.tenantId,
        clinicId: state.clinicId,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        phoneNumber: state.phoneNumber,
        activationContext: state.activationContext,
        mfaToken: state.mfaToken,
        activationToken: state.activationToken,
        otpFlow: state.otpFlow,
        otpSentAt: state.otpSentAt,
      }),
      onRehydrateStorage: () => (_state, error) => {
        // Do not call useAuthStore.setState here — store may still be undefined
        // while create() is assigning the export (TDZ / circular init).
        if (error) {
          console.warn("Auth session rehydration failed:", error);
        }
      },
    },
  ),
);

useAuthStore.persist.onFinishHydration(() => {
  useAuthStore.setState({ _hasHydrated: true });
});

if (useAuthStore.persist.hasHydrated()) {
  useAuthStore.setState({ _hasHydrated: true });
}
