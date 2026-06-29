import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ActivationContext } from "@/stores/authStore";

interface OnboardingState {
  activatedPhone: string | null;
  activationContext: ActivationContext | null;
  dashboardActivated: boolean;
  markDashboardActivated: (
    phoneNumber: string,
    context?: ActivationContext,
  ) => void;
  clearOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      activatedPhone: null,
      activationContext: null,
      dashboardActivated: false,
      markDashboardActivated: (phoneNumber, context) =>
        set({
          activatedPhone: phoneNumber,
          activationContext: context ?? null,
          dashboardActivated: true,
        }),
      clearOnboarding: () =>
        set({
          activatedPhone: null,
          activationContext: null,
          dashboardActivated: false,
        }),
    }),
    {
      name: "clinic-admin-onboarding",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activatedPhone: state.activatedPhone,
        activationContext: state.activationContext,
        dashboardActivated: state.dashboardActivated,
      }),
    },
  ),
);
