import type { ApmService, PlatformObservability, PlatformStats } from '../api/types'
import type { DashboardTimeRange } from '../store/dashboardStore'
import type { DashboardIncident } from '../pages/dashboard/dashboardUtils'
import { detectAnomalies } from './anomalyEngine'
import { analyzeRootCause, topRootCause } from './rootCauseEngine'
import { predictFailures } from './predictiveEngine'
import { suggestRemediation } from './remediationEngine'
import { generateExecutiveSummary } from './executiveSummaryEngine'

export type AIOpsInsightKind = 'anomaly' | 'prediction' | 'root_cause' | 'action'

export interface AIOpsInsight {
  id: string
  kind: AIOpsInsightKind
  message: string
  confidence: number
  severity: 'info' | 'warning' | 'high' | 'critical'
  recommendedAction?: string
  color: string
}

export interface AIOpsSnapshot {
  anomalies: ReturnType<typeof detectAnomalies>
  predictions: ReturnType<typeof predictFailures>
  rootCauses: ReturnType<typeof analyzeRootCause>
  topRootCause: ReturnType<typeof topRootCause>
  insights: AIOpsInsight[]
  remediationForTop: ReturnType<typeof suggestRemediation>
  executiveSummary: ReturnType<typeof generateExecutiveSummary>
}

const SEV_COLOR = {
  info: '#06b6d4',
  warning: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
}

function confidenceLabel(value: number): number {
  return Math.round(Math.max(0, Math.min(99, value)))
}

/** Orchestrate all AIOps engines into a single snapshot. */
export function buildAIOpsSnapshot(input: {
  services: ApmService[]
  errors: PlatformObservability['apm']['errors']
  incidents: DashboardIncident[]
  serviceMap?: PlatformObservability['apm']['serviceMap']
  traces?: PlatformObservability['traces']['items']
  availability: number
  stats: PlatformStats | null
  timeRange: DashboardTimeRange
}): AIOpsSnapshot {
  const anomalies = detectAnomalies(input.services)
  const predictions = predictFailures({
    services: input.services,
    anomalies,
    serviceMapEdges: input.serviceMap?.edges,
  })
  const rootCauses = analyzeRootCause({
    services: input.services,
    errors: input.errors,
    incidents: input.incidents,
    anomalies,
    serviceMap: input.serviceMap,
    traces: input.traces,
  })
  const topRc = rootCauses[0] ?? null

  const insights: AIOpsInsight[] = []

  for (const a of anomalies.slice(0, 3)) {
    insights.push({
      id: a.id,
      kind: 'anomaly',
      message: a.message,
      confidence: confidenceLabel(50 + a.score * 12),
      severity: a.severity === 'severe' ? 'critical' : a.severity === 'warning' ? 'warning' : 'info',
      recommendedAction: `Inspect ${a.service} metrics and correlated traces`,
      color: a.severity === 'severe' ? SEV_COLOR.critical : a.severity === 'warning' ? SEV_COLOR.warning : SEV_COLOR.info,
    })
  }

  for (const p of predictions.slice(0, 2)) {
    insights.push({
      id: p.id,
      kind: 'prediction',
      message: p.message,
      confidence: confidenceLabel(p.confidence),
      severity: p.severity === 'critical' ? 'critical' : p.severity === 'high' ? 'high' : 'warning',
      recommendedAction: `Pre-emptively scale or throttle ${p.service}`,
      color: p.severity === 'critical' || p.severity === 'high' ? SEV_COLOR.high : SEV_COLOR.warning,
    })
  }

  if (topRc) {
    insights.push({
      id: `rc-${topRc.service}`,
      kind: 'root_cause',
      message: `Root cause likely ${topRc.probableRootCause} (${topRc.confidence}%)`,
      confidence: confidenceLabel(topRc.confidence),
      severity: topRc.confidence >= 80 ? 'high' : 'warning',
      recommendedAction: topRc.evidence[0]?.detail,
      color: topRc.confidence >= 80 ? '#8b5cf6' : SEV_COLOR.warning,
    })
  }

  const remediationForTop = suggestRemediation({
    rootCause: topRc,
    anomalies,
    predictions,
    incident: input.incidents[0] ?? null,
  })

  for (const action of remediationForTop.slice(0, 2)) {
    insights.push({
      id: action.id,
      kind: 'action',
      message: action.title,
      confidence: action.priority === 'immediate' ? 88 : 72,
      severity: action.priority === 'immediate' ? 'critical' : action.priority === 'high' ? 'high' : 'warning',
      recommendedAction: action.description,
      color: action.priority === 'immediate' ? SEV_COLOR.critical : SEV_COLOR.high,
    })
  }

  const periodLabel = input.timeRange === '24h' ? 'Past 24h' : input.timeRange === '7d' ? 'Past 7 days' : 'Current window'
  const executiveSummary = generateExecutiveSummary({
    availability: input.availability,
    incidents: input.incidents,
    services: input.services,
    rootCause: topRc,
    predictions,
    stats: input.stats,
    periodLabel,
  })

  return {
    anomalies,
    predictions,
    rootCauses,
    topRootCause: topRc,
    insights: insights.slice(0, 8),
    remediationForTop,
    executiveSummary,
  }
}

export { SEV_COLOR }
