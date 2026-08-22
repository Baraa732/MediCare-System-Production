/** Shared default media for clinic / doctor placeholders. */
export const DEFAULT_CLINIC_IMAGE = "/defaults/default-clinic.jpg";
export const DEFAULT_DOCTOR_IMAGE = "/defaults/default-doctor.jpg";

export function clinicImageSrc(logoUrl?: string | null): string {
  const trimmed = logoUrl?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_CLINIC_IMAGE;
}

export function doctorImageSrc(avatarUrl?: string | null): string {
  const trimmed = avatarUrl?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_DOCTOR_IMAGE;
}
