import type { RootCauseResult } from './rootCauseEngine'
import type { AnomalySignal } from './anomalyEngine'
import type { PredictiveFailure } from './predictiveEngine'
import type { DashboardIncident } from '../pages/dashboard/dashboardUtils'

export interface RemediationAction {
  id: string
  title: string
  description: string
  priority: 'immediate' | 'high' | 'medium'
  category: 'cache' | 'database' | 'gateway' | 'service' | 'messaging' | 'general'
}

const PLAYBOOKS: Array<{
  match: RegExp
  category: RemediationAction['category']
  actions: Omit<RemediationAction, 'id' | 'category'>[]
}> = [
  {
    match: /redis|cache/i,
    category: 'cache',
    actions: [
      { title: 'Flush stale cache keys', description: 'Remove expired keys and inspect TTL distribution', priority: 'high' },
      { title: 'Scale Redis memory', description: 'Increase maxmemory or add replica for read offload', priority: 'immediate' },
      { title: 'Inspect memory pressure', description: 'Check evicted_keys and used_memory_rss metrics', priority: 'high' },
    ],
  },
  {
    match: /database|postgres|db|slow query/i,
    category: 'database',
    actions: [
      { title: 'Inspect slow queries', description: 'Review pg_stat_statements for queries exceeding 500ms', priority: 'immediate' },
      { title: 'Increase connection pool', description: 'Raise pool size if waiting connections are elevated', priority: 'high' },
      { title: 'Verify index coverage', description: 'Check sequential scans on hot tables', priority: 'medium' },
    ],
  },
  {
    match: /gateway|upstream|5xx/i,
    category: 'gateway',
    actions: [
      { title: 'Inspect upstream dependency', description: 'Trace failing routes through api-gateway spans', priority: 'immediate' },
      { title: 'Enable circuit breaker review', description: 'Check opossum breaker state for open circuits', priority: 'high' },
      { title: 'Rate-limit burst traffic', description: 'Temporarily throttle noisy clients at gateway', priority: 'medium' },
    ],
  },
  {
    match: /kafka|broker|lag/i,
    category: 'messaging',
    actions: [
      { title: 'Check consumer lag', description: 'Inspect partition lag and consumer group health', priority: 'immediate' },
      { title: 'Scale consumer instances', description: 'Add consumers for lagging partitions', priority: 'high' },
    ],
  },
  {
    match: /latency|saturation/i,
    category: 'service',
    actions: [
      { title: 'Scale service replicas', description: 'Increase pod count for saturated service', priority: 'high' },
      { title: 'Review recent deployments', description: 'Correlate latency spike with last deploy window', priority: 'medium' },
    ],
  },
]

function defaultActions(service: string): RemediationAction[] {
  return [
    {
      id: 'inspect-logs',
      title: 'Inspect error logs',
      description: `Filter ERROR logs for ${service} and correlate trace IDs`,
      priority: 'immediate',
      category: 'general',
    },
    {
      id: 'check-health',
      title: 'Verify health probes',
      description: `Confirm /health/ready on ${service} and dependencies`,
      priority: 'high',
      category: 'general',
    },
    {
      id: 'review-traces',
      title: 'Review distributed traces',
      description: 'Open Jaeger trace for failing requests in the incident window',
      priority: 'medium',
      category: 'general',
    },
  ]
}

/** Map incidents and root causes to remediation playbooks — suggestion only. */
export function suggestRemediation(input: {
  incident?: DashboardIncident | null
  rootCause?: RootCauseResult | null
  anomalies?: AnomalySignal[]
  predictions?: PredictiveFailure[]
}): RemediationAction[] {
  const { incident, rootCause, anomalies = [], predictions = [] } = input
  const service = incident?.service ?? rootCause?.service ?? anomalies[0]?.service ?? 'platform'
  const haystack = [
    rootCause?.probableRootCause ?? '',
    incident?.title ?? '',
    incident?.errorType ?? '',
    ...anomalies.map((a) => a.message),
    ...predictions.map((p) => p.message),
  ].join(' ')

  const matched: RemediationAction[] = []
  for (const book of PLAYBOOKS) {
    if (!book.match.test(haystack)) continue
    for (const action of book.actions) {
      matched.push({
        ...action,
        id: `${book.category}-${action.title.replace(/\s+/g, '-').toLowerCase()}`,
        category: book.category,
      })
    }
  }

  const actions = matched.length ? matched : defaultActions(service)
  const seen = new Set<string>()
  return actions.filter((a) => {
    if (seen.has(a.id)) return false
    seen.add(a.id)
    return true
  }).slice(0, 5)
}

export function remediationPriorityColor(priority: RemediationAction['priority']): string {
  if (priority === 'immediate') return '#ef4444'
  if (priority === 'high') return '#f97316'
  return '#f59e0b'
}
