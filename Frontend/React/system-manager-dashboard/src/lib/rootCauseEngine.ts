import type { ApmService, PlatformObservability } from '../api/types'
import type { DashboardIncident } from '../pages/dashboard/dashboardUtils'
import type { AnomalySignal } from './anomalyEngine'

export interface RootCauseEvidence {
  label: string
  detail: string
}

export interface RootCauseResult {
  probableRootCause: string
  confidence: number
  affectedServices: string[]
  evidence: RootCauseEvidence[]
  service: string
}

const INFRA_PATTERNS: Array<{ match: RegExp; cause: string; action: string }> = [
  { match: /redis|cache/i, cause: 'Redis saturation', action: 'Inspect cache memory pressure and eviction policy' },
  { match: /postgres|database|db/i, cause: 'Database saturation', action: 'Review slow queries and connection pool limits' },
  { match: /kafka/i, cause: 'Message broker lag', action: 'Check consumer lag and partition health' },
  { match: /gateway/i, cause: 'Gateway overload', action: 'Inspect upstream latency and rate limits' },
]

function dependencyCentrality(service: string, edges: string[][]): number {
  const upstream = edges.filter(([, t]) => t === service).length
  const downstream = edges.filter(([s]) => s === service).length
  return upstream + downstream * 1.5
}

function scoreCandidate(input: {
  service: string
  errors: number
  p95: number
  errorRate: number
  status: string
  centrality: number
  incidentCount: number
  anomalyScore: number
}): number {
  let score = 0
  score += Math.min(30, input.errors * 2)
  score += Math.min(25, (input.p95 ?? 0) / 40)
  score += Math.min(20, input.errorRate * 4)
  score += input.status === 'down' ? 25 : input.status === 'degraded' ? 12 : 0
  score += Math.min(15, input.centrality * 3)
  score += Math.min(10, input.incidentCount * 5)
  score += Math.min(10, input.anomalyScore * 3)
  return Math.round(score)
}

/** Rank probable root causes from telemetry correlation. */
export function analyzeRootCause(input: {
  services: ApmService[]
  errors: Array<{ message: string; service: string; count: number; traceId?: string | null }>
  incidents: DashboardIncident[]
  anomalies: AnomalySignal[]
  serviceMap?: PlatformObservability['apm']['serviceMap']
  traces?: PlatformObservability['traces']['items']
}): RootCauseResult[] {
  const { services, errors, incidents, anomalies, serviceMap, traces } = input
  const edges = serviceMap?.edges ?? []
  const results: RootCauseResult[] = []

  const candidates = new Map<string, RootCauseResult>()

  for (const svc of services) {
    if (svc.status === 'healthy' && svc.errorRate < 1 && (svc.p95 ?? 0) < 300) continue

    const svcErrors = errors.filter((e) => e.service === svc.name)
    const errorCount = svcErrors.reduce((s, e) => s + e.count, 0)
    const svcIncidents = incidents.filter((i) => i.service === svc.name)
    const svcAnomalies = anomalies.filter((a) => a.service === svc.name)
    const anomalyScore = svcAnomalies.reduce((s, a) => s + a.score, 0)

    const centrality = dependencyCentrality(svc.name, edges)
    const confidence = Math.min(98, scoreCandidate({
      service: svc.name,
      errors: errorCount,
      p95: svc.p95 ?? 0,
      errorRate: svc.errorRate,
      status: svc.status,
      centrality,
      incidentCount: svcIncidents.length,
      anomalyScore,
    }))

    const evidence: RootCauseEvidence[] = []
    if (svc.p95 && svc.p95 > 400) {
      evidence.push({ label: 'Latency spike', detail: `p95 ${svc.p95}ms on ${svc.name}` })
    }
    if (svc.errorRate > 1) {
      evidence.push({ label: 'Error rate', detail: `${svc.errorRate}% errors on ${svc.name}` })
    }
    for (const err of svcErrors.slice(0, 2)) {
      evidence.push({ label: 'Log pattern', detail: `${err.message} (${err.count}x)` })
    }
    const downstream = edges.filter(([s]) => s === svc.name).map(([, t]) => t)
    const affectedDownstream = services.filter((s) => downstream.includes(s.name) && s.status !== 'healthy')
    for (const ds of affectedDownstream.slice(0, 2)) {
      evidence.push({ label: 'Propagation', detail: `${ds.name} degraded after ${svc.name} signals` })
    }
    const relatedTrace = traces?.find((t) => t.rootService === svc.name && t.status === 'error')
    if (relatedTrace) {
      evidence.push({ label: 'Trace correlation', detail: `Trace ${relatedTrace.traceId ?? relatedTrace.id} shows errors` })
    }

    let probableRootCause = `${svc.name} degradation`
    if ((svc.p95 ?? 0) > 800) probableRootCause = `Latency saturation on ${svc.name}`
    else if (svc.errorRate > 3) probableRootCause = `Elevated error rate on ${svc.name}`
    else if (svc.status === 'down') probableRootCause = `${svc.name} unreachable`

    for (const pattern of INFRA_PATTERNS) {
      const haystack = `${svc.name} ${svcErrors.map((e) => e.message).join(' ')}`
      if (pattern.match.test(haystack)) {
        probableRootCause = pattern.cause
        evidence.push({ label: 'Infrastructure match', detail: pattern.action })
        break
      }
    }

    const affected = new Set<string>([svc.name, ...downstream, ...affectedDownstream.map((s) => s.name)])
    for (const inc of svcIncidents) {
      affected.add(inc.service)
    }

    candidates.set(svc.name, {
      probableRootCause,
      confidence,
      affectedServices: [...affected].slice(0, 8),
      evidence: evidence.slice(0, 5),
      service: svc.name,
    })
  }

  for (const anomaly of anomalies.filter((a) => a.severity === 'severe').slice(0, 3)) {
    if (!candidates.has(anomaly.service)) {
      candidates.set(anomaly.service, {
        probableRootCause: anomaly.message,
        confidence: Math.min(90, 60 + anomaly.score * 5),
        affectedServices: [anomaly.service],
        evidence: [{ label: 'Anomaly', detail: anomaly.message }],
        service: anomaly.service,
      })
    }
  }

  results.push(...candidates.values())
  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 5)
}

export function topRootCause(input: Parameters<typeof analyzeRootCause>[0]): RootCauseResult | null {
  return analyzeRootCause(input)[0] ?? null
}
