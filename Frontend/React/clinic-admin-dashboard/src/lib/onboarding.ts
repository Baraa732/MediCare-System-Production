import {
  getClinicAdminOnboardingStatus,
  type ClinicAdminOnboardingStatus,
} from "@/lib/api/auth";
import { normalizeSyrianPhone } from "@/lib/phone";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";

/** Sync activation phone + context into session and local onboarding stores. */
export function applyOnboardingStatus(status: ClinicAdminOnboardingStatus) {
  const { setActivationPhone } = useAuthStore.getState();
  const { markDashboardActivated } = useOnboardingStore.getState();

  if (status.dashboardActivated) {
    markDashboardActivated(status.phoneNumber, {
      adminFullName: status.adminFullName,
      clinicLocation: status.clinicLocation,
    });
    setActivationPhone(status.phoneNumber, {
      adminFullName: status.adminFullName,
      clinicLocation: status.clinicLocation,
    });
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
