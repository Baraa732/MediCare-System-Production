import type { ApmService, ObservabilityStatus } from '../api/types'
import type { DashboardIncident } from '../pages/dashboard/dashboardUtils'

export interface AlertSignal {
  id: string
  name: string
  service: string
  severity: 'critical' | 'high' | 'warning' | 'info'
  message: string
  timestamp: string
  source: string
}

export interface AlertCluster {
  id: string
  label: string
  rootCause: string
  confidence: 'high' | 'medium' | 'low'
  affectedServices: string[]
  signals: AlertSignal[]
  severity: 'critical' | 'high' | 'warning'
}

const SEVERITY_RANK = { critical: 4, high: 3, warning: 2, info: 1 }

/** Heuristic alert correlation — groups by time, service, dependency, severity. */
export function correlateAlerts(
  signals: AlertSignal[],
  edges: Array<[string, string]>,
): AlertCluster[] {
  if (!signals.length) return []

  const sorted = [...signals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const clusters: AlertCluster[] = []
  const used = new Set<string>()

  const dependencyMap = new Map<string, Set<string>>()
  for (const [src, tgt] of edges) {
    if (!dependencyMap.has(src)) dependencyMap.set(src, new Set())
    if (!dependencyMap.has(tgt)) dependencyMap.set(tgt, new Set())
    dependencyMap.get(src)!.add(tgt)
    dependencyMap.get(tgt)!.add(src)
  }

  for (const signal of sorted) {
    if (used.has(signal.id)) continue

    const clusterSignals: AlertSignal[] = [signal]
    used.add(signal.id)
    const signalTime = new Date(signal.timestamp).getTime()
    const related = dependencyMap.get(signal.service) ?? new Set()

    for (const candidate of sorted) {
      if (used.has(candidate.id)) continue
      const dt = Math.abs(new Date(candidate.timestamp).getTime() - signalTime)
      const timeProximity = dt <= 5 * 60_000
      const sharedService = candidate.service === signal.service
      const dependencyLink = related.has(candidate.service)
      const severityPattern = SEVERITY_RANK[candidate.severity] >= 2 && SEVERITY_RANK[signal.severity] >= 2

      if (timeProximity && (sharedService || dependencyLink || severityPattern)) {
        clusterSignals.push(candidate)
        used.add(candidate.id)
      }
    }

    const affected = [...new Set(clusterSignals.map((s) => s.service))]
    const rootCause = inferRootCause(clusterSignals, edges)
    const maxSeverity = clusterSignals.reduce<AlertCluster['severity']>(
      (max, s) => (SEVERITY_RANK[s.severity] > SEVERITY_RANK[max] ? (s.severity === 'info' ? 'warning' : s.severity) : max),
      'warning',
    )

    clusters.push({
      id: `cluster-${clusters.length + 1}`,
      label: `Incident Cluster #${392 + clusters.length}`,
      rootCause,
      confidence: clusterSignals.length >= 3 ? 'high' : clusterSignals.length >= 2 ? 'medium' : 'low',
      affectedServices: affected,
      signals: clusterSignals,
      severity: maxSeverity,
    })
  }

  return clusters.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
}

function inferRootCause(signals: AlertSignal[], edges: Array<[string, string]>): string {
  const infraKeywords = ['redis', 'kafka', 'database', 'db', 'postgres']
  const infra = signals.find((s) => infraKeywords.some((k) => s.service.toLowerCase().includes(k) || s.message.toLowerCase().includes(k)))
  if (infra) return `${infra.service} saturation`

  const gateway = signals.find((s) => s.service.includes('gateway'))
  if (gateway && signals.length > 2) return 'Gateway timeout cascade'

  const highest = signals.reduce((best, s) => (SEVERITY_RANK[s.severity] > SEVERITY_RANK[best.severity] ? s : best), signals[0])
  const downstream = edges.filter(([src]) => src === highest.service).length
  if (downstream >= 2) return `${highest.service} upstream failure`

  return highest.message.slice(0, 80)
}

export function alertsFromIncidents(incidents: DashboardIncident[]): AlertSignal[] {
  return incidents.map((inc) => ({
    id: inc.id,
    name: inc.title,
    service: inc.service,
    severity: inc.severity === 'info' ? 'info' : inc.severity,
    message: inc.title,
    timestamp: inc.startedAt,
    source: inc.source,
  }))
}

export function alertsFromServices(services: ApmService[]): AlertSignal[] {
  return services
    .filter((s) => s.status !== 'healthy' || s.errorRate > 0)
    .map((s) => ({
      id: `svc-alert-${s.name}`,
      name: `${s.name} ${s.status}`,
      service: s.name,
      severity: (s.status === 'down' || s.errorRate > 5 ? 'critical' : s.errorRate > 1 ? 'high' : 'warning') as AlertSignal['severity'],
      message: s.status === 'down' ? `${s.name} is down` : `Error rate ${s.errorRate}% · p95 ${s.p95 ?? 0}ms`,
      timestamp: new Date().toISOString(),
      source: 'apm',
    }))
}

export function statusColor(status: ObservabilityStatus): string {
  if (status === 'healthy') return '#10b981'
  if (status === 'degraded') return '#f59e0b'
  return '#ef4444'
}
