export interface ApiErrorBody {
  message?: string
  statusCode?: number
  code?: string
  suggestion?: string
}

export class ApiError extends Error {
  status: number
  code?: string
  suggestion?: string

  constructor(status: number, message: string, code?: string, suggestion?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.suggestion = suggestion
  }
}

export interface SystemManagerUser {
  id: string
  username: string
  firstName: string
  lastName: string
  email?: string
}

export interface AuthSession {
  accessToken: string
  user: SystemManagerUser
}

export interface ActivationCodeStatus {
  status: 'pending' | 'used' | 'expired' | 'revoked'
  expiresAt?: string
  usedAt?: string
  revokedAt?: string
  attemptCount?: number
  code?: string
  clinicLocation?: string
  clinicType?: string
  registrationLicenseNumber?: string
  establishmentDate?: string | null
  specialties?: string[]
  fullName?: string
  phoneNumber?: string
  whatsappNumber?: string
  email?: string | null
  dateOfBirth?: string | null
  yearsOfExperience?: number | null
  hasMapLocation?: boolean
  latitude?: number | null
  longitude?: number | null
  address?: string | null
  serviceRadiusKm?: number
  documents?: Record<string, {
    fileName: string
    mimeType: string
    storageKey: string
    sizeBytes: number
    uploadedAt: string
  }>
}

export interface Clinic {
  id: string
  name: string
  description?: string
  city?: string
  governorate?: string
  phone?: string
  email?: string
  status: string
  createdAt?: string
  latitude?: number | null
  longitude?: number | null
}

export interface SecuritySummary {
  available: boolean
  timestamp: string
  range: string
  failedLogins: number
  suspicious: number
  rateLimitExceeded: number
  activeSessions: number
  blockedIdentifiers: Array<{
    identifier: string
    tier: string
    failedAttempts: number
    lockedUntil: string | null
  }>
  topIps: Array<{
    ip: string
    count: number
    lastSeen: string
    actions: string[]
  }>
  recentAudits: Array<{
    id: string
    actor: string
    action: string
    target: string
    result: string
    ip: string | null
    ago: string
    createdAt: string
  }>
  warning?: string
}

export interface QueueOverviewResponse {
  available: boolean
  timestamp: string
  warning?: string
  items: Array<{
    name: string
    messages: number
    consumers: number
    lag: number
    status: 'Healthy' | 'Warning' | 'Critical' | 'Unknown'
  }>
}

export interface DeploymentsResponse {
  available: boolean
  timestamp: string
  source: 'db' | 'loki' | 'none'
  warning?: string
  items: Array<{
    id: string
    service: string
    version: string
    status: 'Success' | 'Failed' | 'Rolled back' | 'In progress'
    by: string
    ago: string
    duration: string
    startedAt: string
  }>
}

export interface PlatformUser {
  id: string
  phoneNumber?: string
  firstName?: string
  lastName?: string
  role: string
  status: string
  clinicId?: string
  createdAt?: string
}

export type ClinicStaffRole = 'CLINIC_ADMIN' | 'DOCTOR' | 'SECRETARY'

export interface ClinicStaffAssignment {
  id: string
  userId: string
  staffRole: ClinicStaffRole
  status: string
  assignedAt?: string
  assignedBy?: string
}

export interface ClinicStaffMember extends ClinicStaffAssignment {
  user?: PlatformUser
}

export interface PlatformHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: Array<{
    name: string
    status: 'up' | 'down' | 'degraded'
    checks?: Record<string, string>
  }>
  infrastructure: {
    database: 'ok' | 'error' | 'unknown'
    kafka: 'ok' | 'error' | 'unknown'
    redis: 'ok' | 'error' | 'unknown'
  }
}

export interface PlatformStats {
  timestamp: string
  clinics: {
    total: number
    byStatus: Record<string, number>
  }
  users: {
    total: number
    active: number
    byRole: Record<string, number>
    byStatus: Record<string, number>
  }
  activationCodes: {
    total: number
    byStatus: Record<string, number>
  }
}

export type PlatformLogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE'

export interface PlatformLogEntry {
  id: string
  timestamp: string
  level: PlatformLogLevel
  service: string
  message: string
  raw: string
  traceId?: string | null
  spanId?: string | null
  requestId?: string | null
}

export interface PlatformLogsHistogramBucket {
  bucket: string
  error: number
  warn: number
  info: number
  debug: number
  trace: number
}

export interface PlatformLogsResponse {
  timestamp: string
  enabled: boolean
  source?: 'loki' | 'docker'
  warning?: string
  entries: PlatformLogEntry[]
  services: Array<{ name: string; count: number }>
  levels: Array<{ level: PlatformLogLevel; count: number }>
  histogram: PlatformLogsHistogramBucket[]
}

export type ObservabilityStatus = 'healthy' | 'degraded' | 'down'
export type TraceStatus = 'ok' | 'slow' | 'error'
export type MonitorStatus = 'up' | 'degraded' | 'down'

export interface ApmService {
  name: string
  status: ObservabilityStatus
  reqRate: number
  errorRate: number
  p50: number
  p95: number | null
  p99: number | null
  instances: number
  series: number[]
  errorSeries?: number[]
  seriesTimestamps?: string[]
  cpuPercent?: number | null
  memoryBytes?: number | null
}

export interface PlatformThroughput {
  timestamps: string[]
  total: number[]
  errors: number[]
  current: number
  peak: number
  avg: number
  unit: string
  source: string
}

export interface OperationalTrace {
  id: string
  traceId?: string
  rootService: string
  rootOp: string
  duration: number
  spans: number
  errors: number
  status: TraceStatus
  time: string
  logs: PlatformLogEntry[]
}

export interface TraceSpan {
  spanId: string
  service: string
  operation: string
  durationMs: number
  status: 'ok' | 'error' | 'slow'
  parentSpanId: string | null
}

export interface DistributedTrace {
  traceId: string
  rootService: string
  durationMs: number
  status: TraceStatus
  spans: TraceSpan[]
}

export type PlatformIncidentStatus = 'open' | 'acknowledged' | 'assigned' | 'resolved' | 'escalated'

export interface PlatformIncidentRecord {
  id: string
  title: string | null
  service: string | null
  status: PlatformIncidentStatus
  assignee: string | null
  notes: string | null
  acknowledgedAt: string | null
  assignedAt: string | null
  resolvedAt: string | null
  escalatedAt: string | null
  resolutionNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface PlatformMonitor {
  id: string
  name: string
  url: string
  type: 'HTTP' | 'TCP'
  status: MonitorStatus
  availability: number
  avgDuration: number | null
  lastCheck: string
  frequency: string
}

export interface PlatformIntegration {
  name: string
  category: string
  status: 'connected' | 'error' | 'available'
  desc: string
  url: string
  latencyMs: number | null
  checkedAt: string
}

export interface PlatformObservability {
  timestamp: string
  range: string
  telemetrySources?: {
    prometheus: boolean
    loki: boolean
    otel: boolean
  }
  apm: {
    services: ApmService[]
    errors: Array<{
      id: number
      message: string
      service: string
      count: number
      traceId?: string | null
      users: null
      firstSeen: string
      lastSeen: string
    }>
    latencySeries: Array<{ name: string; p50: number[]; p95: number[] }>
    throughput?: PlatformThroughput
    serviceMap: {
      simulated?: boolean
      nodes: Array<{ id: string; name: string; status: ObservabilityStatus; reqRate: number; errorRate: number }>
      edges: string[][]
    }
  }
  traces: {
    summary: {
      total: number
      errors: number
      avgDuration: number
      throughput: number
    }
    items: OperationalTrace[]
  }
  monitors: {
    summary: {
      up: number
      degraded: number
      down: number
    }
    items: PlatformMonitor[]
    statusPage: Array<{ name: string; status: 'operational' | 'outage' }>
  }
  integrations: PlatformIntegration[]
}
