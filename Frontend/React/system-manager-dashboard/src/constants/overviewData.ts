export const KPI_DATA = [
  {
    id: 'services',
    label: 'Total Services',
    value: 27,
    trend: 'up' as const,
    trendLabel: '+2 this week',
    sparkline: [18, 19, 20, 21, 22, 24, 25, 26, 27, 27, 27, 27],
    live: false,
  },
  {
    id: 'healthy',
    label: 'Healthy Services',
    value: 24,
    trend: 'up' as const,
    trendLabel: '88.9% healthy',
    sparkline: [20, 21, 22, 22, 23, 23, 24, 24, 24, 24, 24, 24],
    live: true,
  },
  {
    id: 'alerts',
    label: 'Active Alerts',
    value: 5,
    trend: 'down' as const,
    trendLabel: '-3 vs yesterday',
    sparkline: [12, 11, 9, 8, 7, 8, 6, 7, 5, 6, 5, 5],
    live: true,
  },
  {
    id: 'uptime',
    label: 'System Uptime',
    value: 99.95,
    decimals: 2,
    suffix: '%',
    trend: 'up' as const,
    trendLabel: '30d SLA',
    sparkline: [99.9, 99.91, 99.93, 99.92, 99.94, 99.95, 99.95, 99.96, 99.95, 99.95, 99.95, 99.95],
    live: false,
  },
  {
    id: 'requests',
    label: 'Total Requests',
    value: 2.45,
    decimals: 2,
    suffix: 'M',
    trend: 'up' as const,
    trendLabel: '+12.4%',
    sparkline: [1.8, 1.9, 2.0, 2.05, 2.1, 2.15, 2.2, 2.25, 2.3, 2.35, 2.4, 2.45],
    live: true,
  },
  {
    id: 'latency',
    label: 'Avg Response',
    value: 245,
    suffix: 'ms',
    trend: 'down' as const,
    trendLabel: '-18ms',
    sparkline: [310, 295, 280, 270, 265, 260, 255, 250, 248, 246, 245, 245],
    live: false,
  },
  {
    id: 'errors',
    label: 'Error Rate',
    value: 0.12,
    decimals: 2,
    suffix: '%',
    trend: 'down' as const,
    trendLabel: '-0.04%',
    sparkline: [0.28, 0.25, 0.22, 0.2, 0.18, 0.16, 0.15, 0.14, 0.13, 0.13, 0.12, 0.12],
    live: false,
  },
] as const

export const SERVICES_OVERVIEW = [
  { name: 'API Gateway', status: 'Healthy' as const, latencyMs: 42, spark: [40, 38, 45, 41, 39, 42, 44, 41, 40, 42] },
  { name: 'Auth Service', status: 'Healthy' as const, latencyMs: 68, spark: [70, 72, 65, 68, 71, 69, 67, 68, 66, 68] },
  { name: 'Clinic Service', status: 'Warning' as const, latencyMs: 185, spark: [120, 140, 160, 175, 190, 180, 188, 185, 182, 185] },
  { name: 'Appointment', status: 'Healthy' as const, latencyMs: 95, spark: [100, 98, 96, 94, 97, 95, 93, 96, 95, 95] },
  { name: 'Scheduling', status: 'Healthy' as const, latencyMs: 110, spark: [115, 112, 108, 111, 109, 110, 112, 108, 110, 110] },
  { name: 'Notification', status: 'Critical' as const, latencyMs: 420, spark: [200, 240, 280, 320, 360, 400, 410, 430, 425, 420] },
  { name: 'User Service', status: 'Healthy' as const, latencyMs: 78, spark: [80, 76, 79, 77, 78, 81, 79, 78, 77, 78] },
]

export const INFRA_REGIONS = [
  { id: 'us-east', label: 'US-EAST', x: 22, y: 42, status: 'Healthy' as const },
  { id: 'eu-west', label: 'EU-WEST', x: 48, y: 34, status: 'Healthy' as const },
  { id: 'me-central', label: 'ME-CENTRAL', x: 58, y: 48, status: 'Warning' as const },
  { id: 'ap-south', label: 'AP-SOUTH', x: 72, y: 58, status: 'Healthy' as const },
]

export const INFRA_LINKS: Array<[string, string]> = [
  ['us-east', 'eu-west'],
  ['eu-west', 'me-central'],
  ['me-central', 'ap-south'],
  ['us-east', 'me-central'],
]

export const SYSTEM_LOAD = {
  overall: 63,
  cpu: 58,
  memory: 71,
  disk: 44,
  network: 39,
}

export const ACTIVE_ALERTS = [
  { id: 'a1', title: 'Notification latency spike', service: 'notification-service', level: 'Critical' as const, ago: '2m ago' },
  { id: 'a2', title: 'Clinic service p95 elevated', service: 'clinic-service', level: 'Warning' as const, ago: '8m ago' },
  { id: 'a3', title: 'Redis connection retries', service: 'api-gateway', level: 'Warning' as const, ago: '14m ago' },
  { id: 'a4', title: 'WhatsApp webhook backlog', service: 'integrations', level: 'Info' as const, ago: '21m ago' },
  { id: 'a5', title: 'Disk pressure on worker-03', service: 'reminder-service', level: 'Critical' as const, ago: '36m ago' },
]

export const RESOURCE_USAGE = {
  labels: ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22'],
  cpu: [32, 28, 30, 45, 58, 62, 55, 60, 68, 64, 52, 40],
  memory: [48, 50, 51, 54, 60, 66, 70, 72, 71, 68, 62, 58],
  disk: [38, 38, 39, 40, 41, 42, 43, 43, 44, 44, 44, 44],
  network: [20, 18, 22, 35, 48, 55, 50, 58, 62, 57, 40, 28],
}

export const TOP_SERVICES = [
  { name: 'api-gateway', requests: 842000 },
  { name: 'auth-service', requests: 512000 },
  { name: 'appointment-service', requests: 398000 },
  { name: 'clinic-service', requests: 286000 },
  { name: 'user-service', requests: 241000 },
  { name: 'notification-service', requests: 188000 },
]

export const ERROR_RATE_SERIES = [
  { name: 'api-gateway', rate: 0.08, spark: [0.12, 0.1, 0.09, 0.11, 0.08, 0.07, 0.08, 0.09, 0.08, 0.08] },
  { name: 'auth-service', rate: 0.05, spark: [0.06, 0.05, 0.07, 0.05, 0.04, 0.05, 0.05, 0.06, 0.05, 0.05] },
  { name: 'clinic-service', rate: 0.31, spark: [0.18, 0.22, 0.25, 0.28, 0.3, 0.32, 0.29, 0.31, 0.3, 0.31] },
  { name: 'notification', rate: 1.42, spark: [0.4, 0.6, 0.9, 1.1, 1.3, 1.5, 1.45, 1.4, 1.42, 1.42] },
  { name: 'scheduling', rate: 0.11, spark: [0.14, 0.13, 0.12, 0.11, 0.1, 0.11, 0.12, 0.11, 0.11, 0.11] },
]

export const DEPLOYMENTS = [
  { id: 'd1', service: 'api-gateway', version: 'v2.14.3', by: 'deploy-bot', ago: '12m ago', status: 'Success' as const, duration: '1m 42s' },
  { id: 'd2', service: 'auth-service', version: 'v1.9.1', by: 'baraa', ago: '48m ago', status: 'Success' as const, duration: '2m 08s' },
  { id: 'd3', service: 'clinic-service', version: 'v3.2.0', by: 'ci-pipeline', ago: '2h ago', status: 'Success' as const, duration: '3m 11s' },
  { id: 'd4', service: 'notification', version: 'v1.4.8', by: 'deploy-bot', ago: '5h ago', status: 'Rolled back' as const, duration: '4m 02s' },
]

export const SYSTEM_LOGS = [
  { ts: '15:41:02', level: 'ERROR', service: 'notification', message: 'Webhook timeout after 8000ms' },
  { ts: '15:40:51', level: 'WARN', service: 'clinic-service', message: 'p95 latency crossed 180ms threshold' },
  { ts: '15:40:44', level: 'INFO', service: 'api-gateway', message: 'Route cache warm complete (214 keys)' },
  { ts: '15:40:31', level: 'INFO', service: 'auth-service', message: 'OTP issued for seed patient channel' },
  { ts: '15:40:18', level: 'DEBUG', service: 'scheduling', message: 'Slot window rebuilt for clinic 3221…' },
  { ts: '15:39:58', level: 'ERROR', service: 'reminder', message: 'Worker-03 disk usage at 92%' },
  { ts: '15:39:41', level: 'INFO', service: 'user-service', message: 'Profile sync completed for 18 tenants' },
  { ts: '15:39:22', level: 'WARN', service: 'api-gateway', message: 'Rate limit soft-hit on /appointments' },
]

export const TRACE_NODES = [
  { id: 'client', label: 'Client', x: 8, y: 50, latency: 0 },
  { id: 'gateway', label: 'API Gateway', x: 28, y: 50, latency: 42 },
  { id: 'auth', label: 'Auth', x: 48, y: 28, latency: 68 },
  { id: 'clinic', label: 'Clinic', x: 48, y: 72, latency: 185 },
  { id: 'appt', label: 'Appointment', x: 70, y: 50, latency: 95 },
  { id: 'db', label: 'Postgres', x: 90, y: 50, latency: 12 },
]

export const TRACE_EDGES: Array<[string, string]> = [
  ['client', 'gateway'],
  ['gateway', 'auth'],
  ['gateway', 'clinic'],
  ['clinic', 'appt'],
  ['appt', 'db'],
  ['auth', 'db'],
]

export const DATABASES = [
  { name: 'PostgreSQL · primary', engine: 'Postgres 16', health: 'Healthy' as const, latencyMs: 12, storage: '428 GB', version: '16.2' },
  { name: 'PostgreSQL · replica', engine: 'Postgres 16', health: 'Healthy' as const, latencyMs: 15, storage: '428 GB', version: '16.2' },
  { name: 'Redis · cache', engine: 'Redis 7', health: 'Warning' as const, latencyMs: 3, storage: '6.2 GB', version: '7.2' },
  { name: 'Mongo · analytics', engine: 'MongoDB 7', health: 'Healthy' as const, latencyMs: 28, storage: '112 GB', version: '7.0' },
]

export const QUEUES = [
  { name: 'user-events', messages: 1284, consumers: 6, lag: 42, status: 'Healthy' as const },
  { name: 'appointment-created', messages: 312, consumers: 4, lag: 8, status: 'Healthy' as const },
  { name: 'whatsapp-outbound', messages: 8901, consumers: 3, lag: 1240, status: 'Warning' as const },
  { name: 'audit-trail', messages: 56, consumers: 2, lag: 0, status: 'Healthy' as const },
]

export const SECURITY = {
  failedLogins: 47,
  blockedIps: 12,
  activeSessions: 318,
  topIps: [
    { ip: '185.22.14.9', count: 18, region: 'EU' },
    { ip: '103.44.210.2', count: 11, region: 'APAC' },
    { ip: '44.201.88.15', count: 9, region: 'US' },
    { ip: '91.200.12.44', count: 7, region: 'ME' },
  ],
  threatPoints: [
    { x: 30, y: 40, intensity: 0.8 },
    { x: 55, y: 46, intensity: 0.6 },
    { x: 70, y: 55, intensity: 0.9 },
    { x: 48, y: 32, intensity: 0.4 },
  ],
}

export const RECENT_EVENTS = [
  { id: 'e1', title: 'Clinic activated', detail: 'Damascus Heart Clinic', ago: '4m ago', tone: 'success' as const },
  { id: 'e2', title: 'Alert acknowledged', detail: 'notification latency', ago: '11m ago', tone: 'info' as const },
  { id: 'e3', title: 'Scale event', detail: 'reminder workers +2', ago: '29m ago', tone: 'warning' as const },
  { id: 'e4', title: 'Config published', detail: 'feature flags v18', ago: '1h ago', tone: 'info' as const },
]

export const PLATFORM_ACTIVITY = [
  { id: 'p1', actor: 'baraa', action: 'Updated activation policy', ago: '9m ago' },
  { id: 'p2', actor: 'deploy-bot', action: 'Promoted api-gateway v2.14.3', ago: '12m ago' },
  { id: 'p3', actor: 'sara.ops', action: 'Muted clinic-service alert', ago: '26m ago' },
  { id: 'p4', actor: 'system', action: 'Rotated JWT signing key', ago: '2h ago' },
]

export const NETWORK_TRAFFIC = {
  labels: ['00', '04', '08', '12', '16', '20'],
  ingress: [120, 90, 220, 340, 390, 260],
  egress: [80, 70, 160, 250, 300, 190],
}

export const AI_INSIGHTS = [
  {
    id: 'i1',
    title: 'Notification service degradation',
    body: 'Error rate rose 4.2× after last deploy. Suggest rollback of v1.4.8 or increase webhook timeout to 12s.',
    confidence: 92,
  },
  {
    id: 'i2',
    title: 'Clinic service capacity risk',
    body: 'p95 latency correlates with appointment booking peaks. Consider read replicas for listDoctorsEnriched.',
    confidence: 84,
  },
  {
    id: 'i3',
    title: 'WhatsApp queue lag',
    body: 'Consumer lag > 1k messages. Scale outbound workers before evening OTP window.',
    confidence: 88,
  },
]

export const INCIDENT_TIMELINE = [
  { id: 'inc1', title: 'Notification outage', severity: 'Critical' as const, ago: '36m', duration: '18m' },
  { id: 'inc2', title: 'Elevated clinic latency', severity: 'Warning' as const, ago: '2h', duration: '41m' },
  { id: 'inc3', title: 'Gateway rate-limit storm', severity: 'Warning' as const, ago: '1d', duration: '12m' },
]

export const DEPLOY_HISTORY = [
  { id: 'dh1', service: 'api-gateway', version: 'v2.14.3', ago: '12m ago', status: 'Success' as const },
  { id: 'dh2', service: 'auth-service', version: 'v1.9.1', ago: '48m ago', status: 'Success' as const },
  { id: 'dh3', service: 'notification', version: 'v1.4.8', ago: '5h ago', status: 'Rolled back' as const },
  { id: 'dh4', service: 'scheduling', version: 'v2.1.0', ago: '1d ago', status: 'Success' as const },
]

export const AUDIT_TIMELINE = [
  { id: 'au1', actor: 'baraa', action: 'VIEW_PHI', target: 'patient:seed-8001', ago: '6m ago', result: 'Allowed' },
  { id: 'au2', actor: 'sara.ops', action: 'UPDATE_CLINIC', target: 'clinic:damascus-heart', ago: '22m ago', result: 'Allowed' },
  { id: 'au3', actor: 'system', action: 'KEY_ROTATION', target: 'jwt-signing', ago: '2h ago', result: 'Success' },
  { id: 'au4', actor: 'unknown', action: 'LOGIN_FAILED', target: 'sm-dashboard', ago: '3h ago', result: 'Blocked' },
]
