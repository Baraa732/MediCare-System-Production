export const INTERNAL_SERVICE_NAMES = [
  'api-gateway',
  'auth-service',
  'user-service',
  'clinic-service',
  'appointment-service',
  'scheduling-service',
  'notification-service',
  'emr-service',
  'system-manager-service',
  'reminder-service',
] as const;

export type InternalServiceName = (typeof INTERNAL_SERVICE_NAMES)[number];

export const INTERNAL_AUTH_HEADERS = {
  SERVICE_NAME: 'x-service-name',
  SIGNATURE: 'x-service-signature',
  TIMESTAMP: 'x-request-timestamp',
  LEGACY_TOKEN: 'x-service-token',
} as const;

export const INTERNAL_AUTH_REPLAY_WINDOW_MS = 30_000;
