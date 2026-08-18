import type { ObservabilityStatus } from '../api/types'
import type { PlatformAlert } from './platformAlerts'

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

export function correlateAlerts(
  signals: AlertSignal[],
  edges: Array<[string, string]>,
): AlertCluster[] {
  if (!signals.length) return []

  const sorted = [...signals].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
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
      const timeProximity = dt <= 10 * 60_000
      const sharedService = candidate.service === signal.service
      const dependencyLink = related.has(candidate.service)
      if (timeProximity && (sharedService || dependencyLink)) {
        clusterSignals.push(candidate)
        used.add(candidate.id)
      }
    }

    const affected = [...new Set(clusterSignals.map((s) => s.service))]
    const rootCause = inferRootCause(clusterSignals, edges)
    const maxSeverity = clusterSignals.reduce<AlertCluster['severity']>(
      (max, s) =>
        SEVERITY_RANK[s.severity] > SEVERITY_RANK[max]
          ? s.severity === 'info'
            ? 'warning'
            : s.severity
          : max,
      'warning',
    )

    clusters.push({
      id: `cluster-${affected.slice(0, 3).join('-')}-${clusterSignals.length}`,
      label: affected.length > 1 ? `Cascade · ${affected[0]}` : affected[0],
      rootCause,
      confidence: clusterSignals.length >= 3 ? 'high' : clusterSignals.length >= 2 ? 'medium' : 'low',
      affectedServices: affected,
      signals: clusterSignals,
      severity: maxSeverity,
    })
  }

  return clusters.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
}

export function alertsToSignals(alerts: PlatformAlert[]): AlertSignal[] {
  return alerts.map((alert) => ({
    id: alert.id,
    name: alert.name,
    service: alert.service,
    severity: alert.severity,
    message: `${alert.condition} · ${alert.value}`,
    timestamp: alert.startedAt,
    source: alert.source,
  }))
}

function inferRootCause(signals: AlertSignal[], edges: Array<[string, string]>): string {
  const infraKeywords = ['redis', 'kafka', 'database', 'postgres', 'mongo']
  const infra = signals.find((s) =>
    infraKeywords.some((k) => s.service.toLowerCase().includes(k) || s.message.toLowerCase().includes(k)),
  )
  if (infra) return `${infra.service} saturation`

  const down = signals.find((s) => s.name.toLowerCase().includes('down') || s.message.includes('up == 0'))
  if (down) return `${down.service} is unreachable`

  const gateway = signals.find((s) => s.service.includes('gateway'))
  if (gateway && signals.length > 2) return `Gateway timeout cascade from ${gateway.service}`

  const highest = signals.reduce(
    (best, s) => (SEVERITY_RANK[s.severity] > SEVERITY_RANK[best.severity] ? s : best),
    signals[0],
  )
  const downstream = edges.filter(([src]) => src === highest.service).length
  if (downstream >= 2) return `${highest.service} upstream failure`
  return highest.message.slice(0, 80)
}

export function statusColor(status: ObservabilityStatus | string): string {
  if (status === 'healthy' || status === 'up' || status === 'ok') return '#10b981'
  if (status === 'degraded' || status === 'slow') return '#f59e0b'
  return '#ef4444'
}
