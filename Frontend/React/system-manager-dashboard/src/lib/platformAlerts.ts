import type {
  ApmService,
  PlatformIncidentRecord,
  PlatformObservability,
  PrometheusAlertsResponse,
  QueueOverviewResponse,
} from '../api/types'

export type AlertSeverity = 'critical' | 'high' | 'warning' | 'info'
export type AlertSource = 'prometheus' | 'apm' | 'monitor' | 'integration' | 'logs' | 'queue' | 'rule'
export type AlertLifecycle = 'firing' | 'acknowledged' | 'assigned' | 'escalated' | 'resolved'

export interface AlertRule {
  id: string
  name: string
  service: string
  condition: string
  severity: AlertSeverity
  enabled: boolean
  builtin: boolean
  lastFired: string | null
  notifications: Array<'email' | 'webhook' | 'slack' | 'pagerduty'>
}

export interface PlatformAlert {
  id: string
  name: string
  service: string
  severity: AlertSeverity
  condition: string
  value: string
  numericValue: number
  threshold: number
  source: AlertSource
  startedAt: string
  relatedTraceIds: string[]
  series: number[]
  status: AlertLifecycle
  assignee: string | null
  silenced: boolean
  silencedUntil: string | null
}

const ERROR_RATE_CRITICAL = 5
const ERROR_RATE_HIGH = 1
const LATENCY_MS = 1000
const LOG_ERROR_MIN = 12

export function formatAlertAgo(iso: string) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (!Number.isFinite(sec)) return 'live'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function buildPlatformAlerts(input: {
  observability: PlatformObservability | null
  prometheus?: PrometheusAlertsResponse | null
  queues?: QueueOverviewResponse | null
  customRules?: AlertRule[]
}): PlatformAlert[] {
  const now = input.observability?.timestamp || new Date().toISOString()
  const traces = input.observability?.traces.items ?? []
  const items: PlatformAlert[] = []
  const seen = new Set<string>()
  const push = (alert: PlatformAlert) => {
    if (seen.has(alert.id)) return
    seen.add(alert.id)
    items.push(alert)
  }

  for (const row of input.prometheus?.items ?? []) {
    push({
      id: row.id,
      name: row.summary || row.name,
      service: row.service,
      severity: row.severity,
      condition: row.condition,
      value: row.value,
      numericValue: Number.parseFloat(row.value) || 1,
      threshold: 0,
      source: 'prometheus',
      startedAt: input.prometheus?.timestamp || now,
      relatedTraceIds: traces.filter((t) => t.rootService === row.service).slice(0, 5).map((t) => t.id),
      series: [1],
      status: 'firing',
      assignee: null,
      silenced: false,
      silencedUntil: null,
    })
  }

  for (const service of input.observability?.apm.services ?? []) {
    const alert = alertFromService(service, now, traces)
    if (alert) push(alert)
  }

  for (const monitor of input.observability?.monitors.items ?? []) {
    if (monitor.status === 'up') continue
    push({
      id: `mon-${monitor.id}`,
      name: `${monitor.name} is ${monitor.status}`,
      service: monitor.name,
      severity: monitor.status === 'down' ? 'critical' : 'warning',
      condition: 'monitor_status != up',
      value: monitor.status,
      numericValue: monitor.status === 'down' ? 0 : 50,
      threshold: 100,
      source: 'monitor',
      startedAt: monitor.lastCheck || now,
      relatedTraceIds: [],
      series: [monitor.availability ?? 0],
      status: 'firing',
      assignee: null,
      silenced: false,
      silencedUntil: null,
    })
  }

  for (const integration of input.observability?.integrations ?? []) {
    if (integration.status !== 'error') continue
    push({
      id: `int-${integration.name}`,
      name: `${integration.name} unavailable`,
      service: integration.name,
      severity: 'high',
      condition: 'integration_status = error',
      value: 'error',
      numericValue: 0,
      threshold: 1,
      source: 'integration',
      startedAt: integration.checkedAt || now,
      relatedTraceIds: [],
      series: [0],
      status: 'firing',
      assignee: null,
      silenced: false,
      silencedUntil: null,
    })
  }

  for (const event of (input.observability?.apm.errors ?? []).filter((e) => e.count >= LOG_ERROR_MIN).slice(0, 6)) {
    push({
      id: `log-${event.service}-${event.id}`,
      name: event.message.slice(0, 96),
      service: event.service,
      severity: event.count > 40 ? 'high' : 'warning',
      condition: `error_count >= ${LOG_ERROR_MIN}`,
      value: String(event.count),
      numericValue: event.count,
      threshold: LOG_ERROR_MIN,
      source: 'logs',
      startedAt: event.lastSeen || now,
      relatedTraceIds: event.traceId ? [event.traceId] : traces.filter((t) => t.rootService === event.service).slice(0, 4).map((t) => t.id),
      series: [event.count],
      status: 'firing',
      assignee: null,
      silenced: false,
      silencedUntil: null,
    })
  }

  for (const queue of input.queues?.items ?? []) {
    if (queue.status !== 'Warning' && queue.status !== 'Critical') continue
    push({
      id: `q-${queue.name}`,
      name: `Queue pressure on ${queue.name}`,
      service: queue.name,
      severity: queue.status === 'Critical' ? 'critical' : 'warning',
      condition: 'consumer_lag',
      value: String(queue.lag),
      numericValue: queue.lag,
      threshold: 100,
      source: 'queue',
      startedAt: input.queues?.timestamp || now,
      relatedTraceIds: [],
      series: [queue.lag],
      status: 'firing',
      assignee: null,
      silenced: false,
      silencedUntil: null,
    })
  }

  for (const rule of (input.customRules ?? []).filter((r) => r.enabled)) {
    for (const match of evaluateRule(rule, input.observability, now, traces)) {
      push(match)
    }
  }

  return items.sort((a, b) => rank(b.severity) - rank(a.severity))
}

export function applyIncidentState(
  alerts: PlatformAlert[],
  incidents: PlatformIncidentRecord[],
): PlatformAlert[] {
  const byId = new Map(incidents.map((row) => [row.id, row]))
  return alerts.map((alert) => {
    const row = byId.get(alert.id)
    if (!row) return alert
    if (row.status === 'resolved') {
      return { ...alert, assignee: row.assignee }
    }
    const silencedUntil = activeSilence(row)
    return {
      ...alert,
      status:
        row.status === 'escalated'
          ? 'escalated'
          : row.status === 'assigned'
            ? 'assigned'
            : row.status === 'acknowledged'
              ? 'acknowledged'
              : 'firing',
      assignee: row.assignee,
      silenced: Boolean(silencedUntil),
      silencedUntil,
      startedAt: row.createdAt || alert.startedAt,
    }
  })
}

export function firingAlerts(alerts: PlatformAlert[]) {
  return alerts.filter((a) => a.status !== 'resolved' && !a.silenced)
}

export const BUILTIN_RULES: AlertRule[] = [
  { id: 'r-error-rate', name: 'High error rate', service: 'any', condition: 'error_rate > 5%', severity: 'critical', enabled: true, builtin: true, lastFired: null, notifications: ['email', 'webhook'] },
  { id: 'r-latency', name: 'High latency p99', service: 'any', condition: 'latency_p99 > 1000ms', severity: 'high', enabled: true, builtin: true, lastFired: null, notifications: ['email'] },
  { id: 'r-service-down', name: 'Service down', service: 'any', condition: 'availability < 99%', severity: 'critical', enabled: true, builtin: true, lastFired: null, notifications: ['email', 'webhook'] },
  { id: 'r-monitor', name: 'Monitor degraded', service: 'any', condition: 'monitor_status != up', severity: 'warning', enabled: true, builtin: true, lastFired: null, notifications: ['webhook'] },
]

function alertFromService(
  service: ApmService,
  now: string,
  traces: PlatformObservability['traces']['items'],
): PlatformAlert | null {
  const related = traces.filter((t) => t.rootService === service.name).slice(0, 5).map((t) => t.id)
  if (service.status === 'down') {
    return {
      id: `svc-${service.name}`,
      name: `${service.name} is down`,
      service: service.name,
      severity: 'critical',
      condition: 'up == 0',
      value: 'down',
      numericValue: 0,
      threshold: 1,
      source: 'apm',
      startedAt: now,
      relatedTraceIds: related,
      series: service.errorSeries?.length ? service.errorSeries : service.series ?? [0],
      status: 'firing',
      assignee: null,
      silenced: false,
      silencedUntil: null,
    }
  }
  if (service.errorRate > ERROR_RATE_CRITICAL) {
    return {
      id: `svc-${service.name}`,
      name: `${service.name} error rate`,
      service: service.name,
      severity: 'critical',
      condition: `error_rate > ${ERROR_RATE_CRITICAL}%`,
      value: `${service.errorRate.toFixed(2)}%`,
      numericValue: service.errorRate,
      threshold: ERROR_RATE_CRITICAL,
      source: 'apm',
      startedAt: now,
      relatedTraceIds: related,
      series: service.errorSeries ?? [service.errorRate],
      status: 'firing',
      assignee: null,
      silenced: false,
      silencedUntil: null,
    }
  }
  if (service.errorRate > ERROR_RATE_HIGH) {
    return {
      id: `svc-${service.name}`,
      name: `${service.name} error rate`,
      service: service.name,
      severity: 'high',
      condition: `error_rate > ${ERROR_RATE_HIGH}%`,
      value: `${service.errorRate.toFixed(2)}%`,
      numericValue: service.errorRate,
      threshold: ERROR_RATE_HIGH,
      source: 'apm',
      startedAt: now,
      relatedTraceIds: related,
      series: service.errorSeries ?? [service.errorRate],
      status: 'firing',
      assignee: null,
      silenced: false,
      silencedUntil: null,
    }
  }
  const latency = service.p99 ?? service.p95 ?? 0
  if (latency > LATENCY_MS) {
    return {
      id: `svc-${service.name}`,
      name: `${service.name} high latency`,
      service: service.name,
      severity: 'high',
      condition: `latency_p99 > ${LATENCY_MS}ms`,
      value: `${Math.round(latency)}ms`,
      numericValue: latency,
      threshold: LATENCY_MS,
      source: 'apm',
      startedAt: now,
      relatedTraceIds: related,
      series: service.series ?? [latency],
      status: 'firing',
      assignee: null,
      silenced: false,
      silencedUntil: null,
    }
  }
  return null
}

function evaluateRule(
  rule: AlertRule,
  observability: PlatformObservability | null,
  now: string,
  traces: PlatformObservability['traces']['items'],
): PlatformAlert[] {
  if (rule.builtin) return []
  const parsed = parseCondition(rule.condition)
  if (!parsed) return []
  const services = observability?.apm.services ?? []
  const scoped = rule.service === 'any' ? services : services.filter((s) => s.name === rule.service)
  const matches: PlatformAlert[] = []

  for (const service of scoped) {
    const current =
      parsed.metric === 'error_rate'
        ? service.errorRate
        : parsed.metric === 'latency'
          ? service.p99 ?? service.p95 ?? 0
          : service.status === 'healthy'
            ? 100
            : 0
    if (!compare(current, parsed.op, parsed.threshold)) continue
    matches.push({
      id: `rule-${rule.id}-${service.name}`,
      name: `${rule.name} · ${service.name}`,
      service: service.name,
      severity: rule.severity,
      condition: rule.condition,
      value:
        parsed.metric === 'latency'
          ? `${Math.round(current)}ms`
          : parsed.metric === 'error_rate'
            ? `${current.toFixed(2)}%`
            : `${current}`,
      numericValue: current,
      threshold: parsed.threshold,
      source: 'rule',
      startedAt: now,
      relatedTraceIds: traces.filter((t) => t.rootService === service.name).slice(0, 4).map((t) => t.id),
      series: parsed.metric === 'error_rate' ? service.errorSeries ?? [current] : service.series ?? [current],
      status: 'firing',
      assignee: null,
      silenced: false,
      silencedUntil: null,
    })
  }
  return matches
}

function parseCondition(raw: string): { metric: 'error_rate' | 'latency' | 'availability'; op: '>' | '<' | '>=' | '<='; threshold: number } | null {
  const text = raw.trim().toLowerCase()
  const match = text.match(/^(error_rate|latency_p99|latency|availability)\s*(>=|<=|>|<)\s*([\d.]+)/)
  if (!match) return null
  const metric = match[1].startsWith('error') ? 'error_rate' : match[1].startsWith('lat') ? 'latency' : 'availability'
  return { metric, op: match[2] as '>' | '<' | '>=' | '<=', threshold: Number(match[3]) }
}

function compare(value: number, op: '>' | '<' | '>=' | '<=', threshold: number) {
  if (op === '>') return value > threshold
  if (op === '>=') return value >= threshold
  if (op === '<') return value < threshold
  return value <= threshold
}

function rank(severity: AlertSeverity) {
  return severity === 'critical' ? 4 : severity === 'high' ? 3 : severity === 'warning' ? 2 : 1
}

function activeSilence(row: PlatformIncidentRecord): string | null {
  const until = row.silencedUntil || (row.notes?.startsWith('silencedUntil:') ? row.notes.slice('silencedUntil:'.length) : null)
  if (!until) return null
  const ts = new Date(until).getTime()
  return Number.isFinite(ts) && ts > Date.now() ? until : null
}
