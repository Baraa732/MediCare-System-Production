import { uploadClinicLogo } from "@/lib/api/clinics";
import { uploadUserAvatar } from "@/lib/api/users";
import type { AuthSession } from "@/lib/api/types";
import { useRegistrationImagesStore } from "@/stores/registrationImagesStore";

/** Upload profile and clinic images collected during registration (best-effort). */
export async function uploadPendingRegistrationImages(
  session: AuthSession,
): Promise<void> {
  const { profileImage, clinicImage, clear } =
    useRegistrationImagesStore.getState();
  if (!profileImage && !clinicImage) return;

  const token = session.accessToken;
  const uploads: Promise<unknown>[] = [];

  if (profileImage) {
    uploads.push(uploadUserAvatar(session.userId, profileImage, token));
  }

  const clinicId = session.clinicId ?? session.tenantId;
  if (clinicImage && clinicId) {
    uploads.push(uploadClinicLogo(clinicId, clinicImage, token));
  }

  await Promise.allSettled(uploads);
  clear();
}
