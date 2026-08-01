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
  const cpu = cpus.length ? Math.round(avg(cpus)) : 0
  const memory = mems.length
    ? Math.min(100, Math.round((avg(mems) / (512 * 1024 * 1024)) * 100))
    : 0
  const overall = Math.round(avg([cpu || 0, memory || 0].filter(Boolean)) || 0)
  return {
    overall,
    cpu,
    memory,
    disk: null as number | null,
    network: null as number | null,
    available: cpus.length > 0 || mems.length > 0,
  }
}

export function buildActiveAlerts(
  incidents: PlatformIncidentRecord[],
  observability: PlatformObservability | null,
) {
  const fromIncidents = incidents
    .filter((i) => i.status !== 'resolved')
    .slice(0, 12)
    .map((i) => ({
      id: i.id,
      title: i.title || `Incident ${i.id.slice(0, 8)}`,
      service: i.service || 'platform',
      level:
        i.status === 'escalated'
          ? ('Critical' as const)
          : i.status === 'open'
            ? ('Warning' as const)
            : ('Info' as const),
      ago: i.updatedAt ? relative(i.updatedAt) : '—',
    }))

  if (fromIncidents.length) return fromIncidents

  const degraded = (observability?.apm.services ?? [])
    .filter((s) => s.status !== 'healthy')
    .map((s) => ({
      id: `svc-${s.name}`,
      title: `${s.name} is ${s.status}`,
      service: s.name,
      level: s.status === 'down' ? ('Critical' as const) : ('Warning' as const),
      ago: 'live',
    }))

  const errors = (observability?.apm.errors ?? []).slice(0, 5).map((e) => ({
    id: String(e.id),
    title: e.message.slice(0, 80),
    service: e.service,
    level: 'Warning' as const,
    ago: e.lastSeen ? relative(e.lastSeen) : '—',
  }))

  return [...degraded, ...errors].slice(0, 12)
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
