import type {
  ApmService,
  Clinic,
  DeploymentsResponse,
  PlatformHealth,
  PlatformIncidentRecord,
  PlatformLogsResponse,
  PlatformObservability,
  PlatformStats,
  QueueOverviewResponse,
  SecuritySummary,
} from '../../api/types'
import type { TrendDirection } from '../../types/dashboard'
import { applyIncidentState, buildPlatformAlerts, formatAlertAgo } from '../../lib/platformAlerts'

export type KpiView = {
  id: string
  label: string
  value: number
  decimals?: number
  suffix?: string
  trend: TrendDirection
  trendLabel: string
  sparkline: number[]
  live?: boolean
}

function avg(nums: number[]) {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function statusFromObs(s: ApmService['status']): 'Healthy' | 'Warning' | 'Critical' {
  if (s === 'healthy') return 'Healthy'
  if (s === 'degraded') return 'Warning'
  return 'Critical'
}

export function buildOverviewKpis(input: {
  observability: PlatformObservability | null
  health: PlatformHealth | null
  stats: PlatformStats | null
  incidents: PlatformIncidentRecord[]
}): KpiView[] {
  const services = input.observability?.apm.services ?? []
  const healthy = services.filter((s) => s.status === 'healthy').length
  const openIncidents = input.incidents.filter((i) => i.status !== 'resolved').length
  const upCount = input.observability?.monitors.summary.up ?? 0
  const downCount = input.observability?.monitors.summary.down ?? 0
  const degradedCount = input.observability?.monitors.summary.degraded ?? 0
  const monitorTotal = upCount + downCount + degradedCount
  const uptime = monitorTotal > 0 ? (upCount / monitorTotal) * 100 : services.length ? (healthy / services.length) * 100 : 0

  const totalReq = services.reduce((n, s) => n + (s.reqRate || 0), 0)
  const avgLatency = avg(services.map((s) => s.p95 ?? s.p50 ?? 0).filter((n) => n > 0))
  const errRate = avg(services.map((s) => s.errorRate ?? 0))

  const spark = (s?: number[]) => (s && s.length ? s : [0])

  return [
    {
      id: 'services',
      label: 'Total Services',
      value: services.length || input.health?.services.length || 0,
      trend: 'flat',
      trendLabel: input.health?.status ?? '—',
      sparkline: spark(services[0]?.series),
      live: true,
    },
    {
      id: 'healthy',
      label: 'Healthy Services',
      value: healthy,
      trend: healthy >= services.length * 0.9 ? 'up' : 'down',
      trendLabel: services.length ? `${((healthy / services.length) * 100).toFixed(0)}%` : '—',
      sparkline: spark(services.find((s) => s.status === 'healthy')?.series),
      live: true,
    },
    {
      id: 'alerts',
      label: 'Active Alerts',
      value: openIncidents,
      trend: openIncidents > 0 ? 'up' : 'down',
      trendLabel: `${openIncidents} open`,
      sparkline: [openIncidents],
      live: true,
    },
    {
      id: 'uptime',
      label: 'System Uptime',
      value: Number(uptime.toFixed(2)),
      decimals: 2,
      suffix: '%',
      trend: uptime >= 99 ? 'up' : 'down',
      trendLabel: input.health?.status ?? 'monitors',
      sparkline: [uptime],
      live: false,
    },
    {
      id: 'requests',
      label: 'Request Rate',
      value: Number(totalReq.toFixed(2)),
      decimals: 2,
      suffix: '/s',
      trend: 'up',
      trendLabel: input.observability?.apm.throughput?.unit ?? 'req/s',
      sparkline: spark(input.observability?.apm.throughput?.total),
      live: true,
    },
    {
      id: 'latency',
      label: 'Avg p95',
      value: Math.round(avgLatency),
      suffix: 'ms',
      trend: avgLatency > 300 ? 'up' : 'down',
      trendLabel: avgLatency > 300 ? 'elevated' : 'ok',
      sparkline: spark(services[0]?.series),
      live: false,
    },
    {
      id: 'errors',
      label: 'Error Rate',
      value: Number(errRate.toFixed(2)),
      decimals: 2,
      suffix: '%',
      trend: errRate > 1 ? 'up' : 'down',
      trendLabel: errRate > 1 ? 'high' : 'stable',
      sparkline: spark(services[0]?.errorSeries),
      live: false,
    },
  ]
}

export function buildServiceRows(observability: PlatformObservability | null) {
  return (observability?.apm.services ?? []).map((s) => ({
    name: s.name,
    status: statusFromObs(s.status),
    latencyMs: s.p95 ?? s.p50 ?? 0,
    spark: s.series?.length ? s.series : [s.reqRate],
  }))
}

export function buildSystemLoad(observability: PlatformObservability | null) {
  const services = observability?.apm.services ?? []
  const cpus = services.map((s) => s.cpuPercent).filter((n): n is number => n != null)
  const mems = services.map((s) => s.memoryBytes).filter((n): n is number => n != null)
  const resourceCpu = observability?.apm.resources?.cpuPercent ?? null
  const resourceMem = observability?.apm.resources?.memoryBytes ?? observability?.apm.resources?.heapUsedBytes ?? null

  const cpu = resourceCpu != null
    ? Math.round(resourceCpu)
    : cpus.length
      ? Math.round(avg(cpus))
      : null

  const memoryBytes = resourceMem ?? (mems.length ? avg(mems) : null)
  const memory = memoryBytes != null
    ? Math.min(100, Math.round((memoryBytes / (512 * 1024 * 1024)) * 100))
    : null

  const totalReq = services.reduce((n, s) => n + (s.reqRate || 0), 0)
  const peak = observability?.apm.throughput?.peak || 0
  const requests = peak > 0
    ? Math.min(100, Math.round((totalReq / peak) * 100))
    : Math.min(100, Math.round(totalReq * 20))

  const avgP95 = avg(services.map((s) => s.p95 ?? s.p50 ?? 0).filter((n) => n > 0))
  const latency = avgP95 > 0 ? Math.min(100, Math.round((avgP95 / 800) * 100)) : 0

  const parts = [cpu, memory, requests, latency].filter((n): n is number => n != null)
  const overall = parts.length ? Math.round(avg(parts)) : 0

  return {
    overall,
    cpu,
    memory,
    requests,
    latency,
    available: services.length > 0 || cpu != null || memory != null,
    services: services.map((s) => ({
      name: s.name,
      cpu: s.cpuPercent ?? null,
      memoryBytes: s.memoryBytes ?? null,
      reqRate: s.reqRate,
    })),
  }
}

export function buildActiveAlerts(
  incidents: PlatformIncidentRecord[],
  observability: PlatformObservability | null,
) {
  return applyIncidentState(buildPlatformAlerts({ observability }), incidents)
    .filter((alert) => alert.status !== 'resolved' && !alert.silenced)
    .slice(0, 12)
    .map((alert) => ({
      id: alert.id,
      title: alert.name,
      service: alert.service,
      level:
        alert.severity === 'critical'
          ? ('Critical' as const)
          : alert.severity === 'info'
            ? ('Info' as const)
            : ('Warning' as const),
      ago: formatAlertAgo(alert.startedAt),
    }))
}

export type IncidentTimelineItem = {
  id: string
  title: string
  meta: string
  ago: string
  level: 'Critical' | 'Warning' | 'Success' | 'Info'
}

export function buildIncidentTimeline(
  incidents: PlatformIncidentRecord[],
  observability: PlatformObservability | null,
  queues: QueueOverviewResponse | null,
  deployments: DeploymentsResponse | null,
): IncidentTimelineItem[] {
  const items: IncidentTimelineItem[] = incidents.slice(0, 10).map((i) => ({
    id: `inc-${i.id}`,
    title: i.title || `Incident ${i.id.slice(0, 8)}`,
    meta: i.service || i.status,
    ago: i.updatedAt ? relative(i.updatedAt) : '—',
    level:
      i.status === 'escalated'
        ? 'Critical'
        : i.status === 'resolved'
          ? 'Success'
          : i.status === 'open'
            ? 'Warning'
            : 'Info',
  }))

  const seen = new Set(items.map((i) => i.id))
  const push = (item: IncidentTimelineItem) => {
    if (seen.has(item.id)) return
    seen.add(item.id)
    items.push(item)
  }

  for (const s of observability?.apm.services ?? []) {
    if (s.status === 'healthy') continue
    push({
      id: `svc-${s.name}`,
      title: `${s.name} is ${s.status}`,
      meta: `${s.errorRate?.toFixed?.(1) ?? 0}% errors · ${s.reqRate?.toFixed?.(2) ?? 0} req/s`,
      ago: 'live',
      level: s.status === 'down' ? 'Critical' : 'Warning',
    })
  }

  for (const e of (observability?.apm.errors ?? []).slice(0, 5)) {
    push({
      id: `err-${e.id}`,
      title: e.message.slice(0, 80),
      meta: e.service,
      ago: e.lastSeen ? relative(e.lastSeen) : 'live',
      level: 'Warning',
    })
  }

  for (const q of queues?.items ?? []) {
    if (q.status === 'Healthy' || q.status === 'Unknown') continue
    push({
      id: `q-${q.name}`,
      title: `Queue pressure on ${q.name}`,
      meta: `lag ${q.lag} · ${q.messages} messages`,
      ago: queues?.timestamp ? relative(queues.timestamp) : 'live',
      level: q.status === 'Critical' ? 'Critical' : 'Warning',
    })
  }

  for (const d of (deployments?.items ?? []).slice(0, 4)) {
    push({
      id: `dep-${d.id}`,
      title: `${d.service} ${d.version}`,
      meta: `${d.status} · ${d.by}`,
      ago: d.ago || (d.startedAt ? relative(d.startedAt) : '—'),
      level: d.status === 'Failed' ? 'Critical' : d.status === 'Success' ? 'Success' : 'Info',
    })
  }

  if (!items.length) {
    const services = observability?.apm.services ?? []
    const healthy = services.filter((s) => s.status === 'healthy').length
    items.push({
      id: 'all-clear',
      title: `No open incidents · ${healthy || services.length} services healthy`,
      meta: queues?.available
        ? `${queues.topics ?? 0} Kafka topics · ${queues.groups ?? 0} groups`
        : 'platform',
      ago: 'live',
      level: 'Success',
    })
  }

  return items.slice(0, 12)
}

function relative(iso: string) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function buildAiInsights(input: {
  observability: PlatformObservability | null
  queues: QueueOverviewResponse | null
  security: SecuritySummary | null
}) {
  const insights: Array<{ id: string; title: string; body: string; confidence: number }> = []
  const services = input.observability?.apm.services ?? []

  for (const s of services.filter((x) => x.errorRate > 1).slice(0, 2)) {
    insights.push({
      id: `err-${s.name}`,
      title: `${s.name} elevated errors`,
      body: `Error rate is ${s.errorRate.toFixed(2)}% with p95 ${s.p95 ?? '—'}ms. Investigate recent traces and last deploy.`,
      confidence: Math.min(95, 70 + Math.round(s.errorRate)),
    })
  }

  for (const q of input.queues?.items?.filter((x) => x.status !== 'Healthy') ?? []) {
    insights.push({
      id: `q-${q.name}`,
      title: `Queue pressure on ${q.name}`,
      body: `Lag ${q.lag} / messages ${q.messages}. Scale consumers or drain backlog before peak traffic.`,
      confidence: q.status === 'Critical' ? 90 : 78,
    })
  }

  if ((input.security?.failedLogins ?? 0) > 20) {
    insights.push({
      id: 'sec-fail',
      title: 'Failed login surge',
      body: `${input.security!.failedLogins} failed logins in range. Review top IPs and locked accounts.`,
      confidence: 85,
    })
  }

  return insights
}

export function clinicsWithCoords(clinics: Clinic[]) {
  return clinics.filter(
    (c) =>
      typeof c.latitude === 'number' &&
      typeof c.longitude === 'number' &&
      Number.isFinite(c.latitude) &&
      Number.isFinite(c.longitude),
  )
}

export function mapLogEntries(logs: PlatformLogsResponse | null) {
  return (logs?.entries ?? []).slice(0, 40).map((e) => ({
    ts: new Date(e.timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
    level: e.level,
    service: e.service,
    message: e.message,
  }))
}

export type { DeploymentsResponse, SecuritySummary, QueueOverviewResponse }
