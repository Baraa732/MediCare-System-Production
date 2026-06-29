import { apiRequest } from './client'
import type {
  ActivationCodeStatus,
  AuthSession,
  Clinic,
  ClinicStaffAssignment,
  PlatformHealth,
  PlatformStats,
  PlatformLogsResponse,
  PlatformLogLevel,
  PlatformObservability,
  PlatformUser,
  SystemManagerUser,
  DistributedTrace,
  PlatformIncidentRecord,
} from './types'

export function login(username: string, password: string) {
  return apiRequest<AuthSession>('/system-manager/login', {
    method: 'POST',
    body: { username, password },
  })
}

export function generateActivationCode(
  token: string,
  body: {
    idNumber: string
    phoneNumber: string
    fullName: string
    clinicLocation: string
    price: number
    isCashPaymentDone: boolean
    notes?: string
  },
) {
  return apiRequest<{ code: string; expiresAt: string; message: string }>(
    '/system-manager/activation-code/generate',
    { method: 'POST', body, token },
  )
}

export function revokeActivationCode(token: string, body: { code: string; reason?: string }) {
  return apiRequest<{ message: string }>('/system-manager/activation-code/revoke', {
    method: 'POST',
    body,
    token,
  })
}

export function getActivationCodeStatus(token: string, code: string) {
  return apiRequest<ActivationCodeStatus>(
    `/system-manager/activation-code/status?code=${encodeURIComponent(code)}`,
    { token },
  )
}

export function createSystemManager(
  token: string,
  body: {
    username: string
    password: string
    firstName: string
    lastName: string
    email?: string
  },
) {
  return apiRequest<SystemManagerUser>('/system-manager/create', {
    method: 'POST',
    body,
    token,
  })
}

export function listClinics(token: string) {
  return apiRequest<{ success: boolean; clinics: Clinic[] }>('/clinics', { token })
}

export function createClinic(
  token: string,
  body: {
    name: string
    description?: string
    city?: string
    governorate?: string
    phone?: string
    email?: string
  },
) {
  return apiRequest<{ success: boolean; clinic: Clinic }>('/clinics', {
    method: 'POST',
    body,
    token,
  })
}

export function listUsers(token: string, page = 1, limit = 20) {
  return apiRequest<PlatformUser[]>(`/users?page=${page}&limit=${limit}`, { token })
}

/** Paginate until all platform users are loaded (for staff name lookup). */
export async function listAllUsers(token: string, pageSize = 100) {
  const all: PlatformUser[] = []
  let page = 1
  const maxPages = 50

  while (page <= maxPages) {
    const batch = await listUsers(token, page, pageSize)
    if (!Array.isArray(batch)) break
    if (!batch.length) break
    all.push(...batch)
    if (batch.length < pageSize) break
    page += 1
  }

  return all
}

export function getClinicStaff(token: string, clinicId: string) {
  return apiRequest<{ success: boolean; staff: ClinicStaffAssignment[] }>(
    `/clinics/${clinicId}/staff`,
    { token },
  )
}

export function getPlatformHealth(token: string) {
  return apiRequest<PlatformHealth>('/system-manager/platform/health', { token })
}

export function getPlatformStats(token: string) {
  return apiRequest<PlatformStats>('/system-manager/platform/stats', { token })
}

export function getPlatformLogs(
  token: string,
  params: {
    services?: string[]
    levels?: PlatformLogLevel[]
    search?: string
    range?: string
    limit?: number
    signal?: AbortSignal
  } = {},
) {
  const { signal, ...rest } = params
  const query = new URLSearchParams()
  if (rest.services?.length) query.set('services', rest.services.join(','))
  if (rest.levels?.length) query.set('levels', rest.levels.join(','))
  if (rest.search) query.set('search', rest.search)
  if (rest.range) query.set('range', rest.range)
  if (rest.limit) query.set('limit', String(rest.limit))

  const suffix = query.toString() ? `?${query.toString()}` : ''
  return apiRequest<PlatformLogsResponse>(`/system-manager/platform/logs${suffix}`, { token, signal })
}

export function getPlatformObservability(token: string, range = '1h', signal?: AbortSignal) {
  return apiRequest<PlatformObservability>(
    `/system-manager/platform/observability?range=${encodeURIComponent(range)}`,
    { token, signal },
  )
}

export function getDistributedTrace(token: string, traceId: string) {
  return apiRequest<DistributedTrace>(
    `/system-manager/platform/traces/${encodeURIComponent(traceId)}`,
    { token },
  )
}

export function getTraceForService(token: string, service: string, range = '1h') {
  return apiRequest<DistributedTrace | null>(
    `/system-manager/platform/traces?service=${encodeURIComponent(service)}&range=${encodeURIComponent(range)}`,
    { token },
  )
}

export function listPlatformIncidents(token: string) {
  return apiRequest<PlatformIncidentRecord[]>('/system-manager/platform/incidents', { token })
}

export function acknowledgeIncident(token: string, id: string, body?: { title?: string; service?: string }) {
  return apiRequest<PlatformIncidentRecord>(`/system-manager/platform/incidents/${encodeURIComponent(id)}/acknowledge`, {
    method: 'POST',
    body: body ?? {},
    token,
  })
}

export function assignIncident(token: string, id: string, assignee: string, body?: { title?: string; service?: string }) {
  return apiRequest<PlatformIncidentRecord>(`/system-manager/platform/incidents/${encodeURIComponent(id)}/assign`, {
    method: 'POST',
    body: { assignee, ...body },
    token,
  })
}

export function resolveIncident(token: string, id: string, notes?: string, body?: { title?: string; service?: string }) {
  return apiRequest<PlatformIncidentRecord>(`/system-manager/platform/incidents/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    body: { notes, ...body },
    token,
  })
}

export function escalateIncident(token: string, id: string, notes?: string, body?: { title?: string; service?: string }) {
  return apiRequest<PlatformIncidentRecord>(`/system-manager/platform/incidents/${encodeURIComponent(id)}/escalate`, {
    method: 'POST',
    body: { notes, ...body },
    token,
  })
}
