import {
  getClinicAdminOnboardingStatus,
  type ClinicAdminOnboardingStatus,
} from "@/lib/api/auth";
import { activationContextFromStatus } from "@/lib/activationProfile";
import { normalizeSyrianPhone } from "@/lib/phone";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";

/** Clear local activation / registration progress (not a logged-in session). */
export function clearActivationProgress() {
  useOnboardingStore.getState().clearOnboarding();
  useAuthStore.getState().clearActivationSession();
}

/** Sync activation phone + context into session and local onboarding stores. */
export function applyOnboardingStatus(status: ClinicAdminOnboardingStatus) {
  const { setActivationPhone } = useAuthStore.getState();
  const { markDashboardActivated } = useOnboardingStore.getState();
  const context = activationContextFromStatus(status);

  if (status.dashboardActivated) {
    markDashboardActivated(status.phoneNumber, context);
    setActivationPhone(status.phoneNumber, context);
  }
}

export async function fetchOnboardingStatus(
  phoneNumber: string,
): Promise<ClinicAdminOnboardingStatus> {
  const formatted = normalizeSyrianPhone(phoneNumber);
  const status = await getClinicAdminOnboardingStatus(formatted);
  if (status.dashboardActivated) {
    applyOnboardingStatus(status);
  }
  return status;
}
