import { InternalServiceName } from './types';

export type RouteAllowlist = Record<string, InternalServiceName[]>;

export const INTERNAL_ROUTE_ALLOWLISTS: Record<InternalServiceName, RouteAllowlist> = {
  'api-gateway': {
    'POST /internal/cache/auth/invalidate': ['auth-service'],
  },
  'auth-service': {
    'GET /v1/auth/validate-token': ['api-gateway'],
  },
  'user-service': {
    'GET /users/internal/exists': ['auth-service'],
    'GET /users/internal/by-id/:id': [
      'auth-service',
      'appointment-service',
      'notification-service',
      'reminder-service',
      'clinic-service',
    ],
    'POST /users/internal/public-doctors': [
      'appointment-service',
      'clinic-service',
      'scheduling-service',
      'notification-service',
    ],
    'POST /users/internal/search-doctor-ids': ['clinic-service'],
    'GET /users/internal/by-phone/:phoneNumber': ['auth-service'],
    'GET /users/internal/clinic-admin-by-clinic/:clinicId': ['clinic-service', 'notification-service'],
    'PATCH /users/internal/:id/clinic-id': ['clinic-service'],
    'GET /users/internal/stats': ['system-manager-service'],
    'POST /users/internal/create': ['auth-service'],
    'POST /users/internal/create-by-admin': ['auth-service', 'system-manager-service'],
    'POST /users/internal/complete-staff-activation': ['auth-service'],
    'POST /users/internal/verify-phone': ['auth-service'],
    'POST /users/validate-login': ['auth-service'],
    'POST /users/:id/reset-password-internal': ['auth-service'],
  },
  'clinic-service': {
    'POST /v1/clinics/internal/provision-from-activation': ['system-manager-service'],
    'POST /v1/clinics/internal/create-platform': ['system-manager-service'],
    'POST /v1/clinics/internal/link-admin': ['user-service'],
    'POST /v1/clinics/internal/verify-staff': ['scheduling-service', 'appointment-service'],
    'POST /v1/clinics/internal/check-access': [
      'appointment-service',
      'scheduling-service',
      'notification-service',
      'emr-service',
      'user-service',
    ],
    'POST /v1/clinics/internal/ensure-staff-assignment': ['auth-service'],
    'POST /v1/clinics/internal/assign-staff': ['auth-service'],
    'POST /v1/clinics/internal/resolve-staff-clinic': ['auth-service'],
    'POST /v1/clinics/internal/get-by-id/:id': [
      'scheduling-service',
      'appointment-service',
      'notification-service',
      'reminder-service',
    ],
    'POST /v1/clinics/internal/list-staff': ['notification-service'],
  },
  'appointment-service': {
    'POST /v1/appointments/internal/check-doctor-patient': [
      'appointment-service',
      'scheduling-service',
      'notification-service',
      'emr-service',
      'user-service',
      'clinic-service',
    ],
    'POST /v1/appointments/internal/check-patient-clinic': [
      'appointment-service',
      'scheduling-service',
      'notification-service',
      'emr-service',
      'user-service',
      'clinic-service',
    ],
    'POST /v1/appointments/internal/booked-ranges': ['scheduling-service'],
    'POST /v1/appointments/internal/patient-upcoming-summary': [],
    'POST /v1/appointments/internal/verify-ownership': [],
  },
  'scheduling-service': {
    'POST /v1/schedule/internal/validate-slot': ['appointment-service'],
    'GET /v1/schedule/internal/clinics/:clinicId/hours': ['clinic-service'],
  },
  'notification-service': {
    'POST /v1/notifications/internal/appointment-reminder': ['reminder-service'],
  },
  'emr-service': {
    'GET /internal/emr/patient/:userId': ['appointment-service', 'auth-service'],
  },
  'system-manager-service': {
    'GET /v1/system-manager/validate-token': ['api-gateway'],
    'GET /v1/system-manager/activation-code/check-activated': ['auth-service'],
    'GET /v1/system-manager/activation-code/lookup-used-by-phone': ['auth-service'],
    'POST /v1/system-manager/activation-code/validate-internal': ['auth-service'],
  },
  'reminder-service': {},
};

function patternToRegex(patternPath: string): RegExp {
  const escaped = patternPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withParams = escaped.replace(/\\:[^/\\]+/g, '[^/]+');
  return new RegExp(`^${withParams}$`);
}

export function normalizeRouteKey(method: string, path: string): string {
  const normalizedPath = path.split('?')[0];
  return `${method.toUpperCase()} ${normalizedPath}`;
}

export function findRouteAllowlist(
  owningService: InternalServiceName,
  method: string,
  path: string,
): InternalServiceName[] | undefined {
  const allowlists = INTERNAL_ROUTE_ALLOWLISTS[owningService];
  if (!allowlists) return undefined;

  const normalizedPath = path.split('?')[0];
  const upperMethod = method.toUpperCase();

  for (const [routeKey, callers] of Object.entries(allowlists)) {
    const spaceIdx = routeKey.indexOf(' ');
    const routeMethod = routeKey.slice(0, spaceIdx);
    const routePath = routeKey.slice(spaceIdx + 1);
    if (routeMethod !== upperMethod) continue;
    if (patternToRegex(routePath).test(normalizedPath)) {
      return callers;
    }
  }

  return undefined;
}

export function isCallerAllowedForRoute(
  owningService: InternalServiceName,
  method: string,
  path: string,
  caller: string,
  decoratorAllowlist?: InternalServiceName[],
): boolean {
  const effectiveAllowlist = decoratorAllowlist ?? findRouteAllowlist(owningService, method, path);
  if (!effectiveAllowlist) {
    return false;
  }
  if (effectiveAllowlist.length === 0) {
    return false;
  }
  return effectiveAllowlist.includes(caller as InternalServiceName);
}
