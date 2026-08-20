const DEFAULT_CLINIC_TIMEZONE = 'Asia/Damascus';

export function resolveClinicTimezone(timezone?: string | null): string {
  return timezone?.trim() || DEFAULT_CLINIC_TIMEZONE;
}

export function formatClinicDateTime(
  iso: string | Date,
  timezone?: string | null,
): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-GB', {
    timeZone: resolveClinicTimezone(timezone),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatClinicDate(
  iso: string | Date,
  timezone?: string | null,
): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-GB', {
    timeZone: resolveClinicTimezone(timezone),
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatClinicTime(
  iso: string | Date,
  timezone?: string | null,
): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-GB', {
    timeZone: resolveClinicTimezone(timezone),
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
