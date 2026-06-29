import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthIdentity } from "@/lib/api/types";

interface AuthState extends AuthIdentity {
  accessToken: string | null;
  refreshToken: string | null;
  phoneNumber: string | null;
  mfaToken: string | null;
  activationToken: string | null;
  passwordResetPhone: string | null;
  passwordResetOtp: string | null;
  passwordResetOtpSentAt: number | null;
  _hasHydrated: boolean;
  setSession: (
    session: AuthIdentity & { accessToken: string; refreshToken: string },
  ) => void;
  updateTokens: (
    accessToken: string,
    refreshToken: string,
    identity?: Partial<AuthIdentity>,
  ) => void;
  setClinicId: (clinicId: string) => void;
  setTenantId: (tenantId: string) => void;
  setPendingMfa: (payload: {
    mfaToken: string;
    phoneNumber: string;
    requiresPasswordChange?: boolean;
    clinicId?: string;
    userId?: string;
    role?: string;
  }) => void;
  setPendingActivation: (payload: {
    activationToken: string;
    clinicId?: string;
    userId?: string;
    role?: string;
  }) => void;
  setActivationToken: (activationToken: string) => void;
  setPasswordResetPhone: (phoneNumber: string) => void;
  setPasswordResetOtp: (otp: string) => void;
  markPasswordResetOtpSent: () => void;
  clearPasswordResetFlow: () => void;
  clearPasswordResetPhone: () => void;
  clearPendingFlow: () => void;
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
  mfaToken: null as string | null,
  activationToken: null as string | null,
  passwordResetPhone: null as string | null,
  passwordResetOtp: null as string | null,
  passwordResetOtpSentAt: null as number | null,
  _hasHydrated: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setSession: (session) =>
        set({
          userId: session.userId,
          role: session.role,
          tenantId: session.tenantId ?? session.clinicId,
          clinicId: session.tenantId ?? session.clinicId,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          mfaToken: null,
          activationToken: null,
          phoneNumber: null,
        }),
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
      setClinicId: (clinicId) => set({ clinicId, tenantId: clinicId }),
      setTenantId: (tenantId) => set({ tenantId, clinicId: tenantId }),
      setPendingMfa: ({
        mfaToken,
        phoneNumber,
        requiresPasswordChange,
        clinicId,
        userId,
        role,
      }) =>
        set({
          mfaToken,
          phoneNumber,
          clinicId,
          userId: userId ?? "",
          role: role ?? "",
          accessToken: null,
          refreshToken: null,
          activationToken: requiresPasswordChange ? get().activationToken : null,
        }),
      setPendingActivation: ({ activationToken, clinicId, userId, role }) =>
        set({
          activationToken,
          clinicId: clinicId ?? get().clinicId,
          userId: userId ?? get().userId,
          role: role ?? get().role,
          mfaToken: null,
        }),
      setActivationToken: (activationToken) => set({ activationToken }),
      setPasswordResetPhone: (phoneNumber) =>
        set({ passwordResetPhone: phoneNumber, passwordResetOtp: null }),
      setPasswordResetOtp: (otp) => set({ passwordResetOtp: otp }),
      markPasswordResetOtpSent: () => set({ passwordResetOtpSentAt: Date.now() }),
      clearPasswordResetFlow: () =>
        set({
          passwordResetPhone: null,
          passwordResetOtp: null,
          passwordResetOtpSentAt: null,
        }),
      clearPasswordResetPhone: () =>
        set({
          passwordResetPhone: null,
          passwordResetOtp: null,
          passwordResetOtpSentAt: null,
        }),
      clearPendingFlow: () =>
        set({ mfaToken: null, activationToken: null, phoneNumber: null }),
      logout: () => set({ ...initialState, _hasHydrated: true }),
      isAuthenticated: () => Boolean(get().accessToken),
    }),
    {
      name: "secretary-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        userId: state.userId,
        role: state.role,
        tenantId: state.tenantId,
        clinicId: state.clinicId,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        phoneNumber: state.phoneNumber,
        mfaToken: state.mfaToken,
        activationToken: state.activationToken,
        passwordResetPhone: state.passwordResetPhone,
        passwordResetOtp: state.passwordResetOtp,
        passwordResetOtpSentAt: state.passwordResetOtpSentAt,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn("Auth session rehydration failed:", error);
        }
        useAuthStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
