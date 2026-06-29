import type { ApmService, PlatformStats } from '../api/types'
import type { DashboardIncident } from '../pages/dashboard/dashboardUtils'
import type { RootCauseResult } from './rootCauseEngine'
import type { PredictiveFailure } from './predictiveEngine'

export interface ExecutiveSummary {
  periodLabel: string
  availability: number
  incidentCount: number
  criticalIncidents: number
  rootCause: string
  rootCauseConfidence: number
  predictedRisks: string[]
  recommendedPriority: string
  highlights: string[]
  generatedAt: string
}

export interface DailyReportJson {
  summary: ExecutiveSummary
  services: Array<{ name: string; status: string; errorRate: number; p95: number | null }>
  incidents: Array<{ id: string; title: string; severity: string; service: string }>
}

/** Generate concise operational summary for the past window. */
export function generateExecutiveSummary(input: {
  availability: number
  incidents: DashboardIncident[]
  services: ApmService[]
  rootCause: RootCauseResult | null
  predictions: PredictiveFailure[]
  stats: PlatformStats | null
  periodLabel?: string
}): ExecutiveSummary {
  const { availability, incidents, services, rootCause, predictions, stats, periodLabel = 'Past 24h' } = input
  const criticalIncidents = incidents.filter((i) => i.severity === 'critical').length
  const degraded = services.filter((s) => s.status !== 'healthy')

  const predictedRisks = predictions
    .filter((p) => p.severity === 'high' || p.severity === 'critical')
    .slice(0, 3)
    .map((p) => p.service.replace(/-service$/, '') + ' latency')

  let recommendedPriority = 'Monitor baseline — no urgent action'
  if (rootCause?.probableRootCause.toLowerCase().includes('redis')) {
    recommendedPriority = 'Scale cache cluster'
  } else if (rootCause?.probableRootCause.toLowerCase().includes('database')) {
    recommendedPriority = 'Optimize database queries and pool sizing'
  } else if (criticalIncidents > 0) {
    recommendedPriority = `Resolve ${incidents[0]?.service ?? 'critical'} incident`
  } else if (predictedRisks.length) {
    recommendedPriority = `Mitigate ${predictedRisks[0]} risk before SLO breach`
  }

  const highlights: string[] = [
    `Availability: ${availability}%`,
    `Incidents: ${incidents.length} (${criticalIncidents} critical)`,
    `Services degraded: ${degraded.length}`,
  ]
  if (stats?.clinics.total) {
    highlights.push(`Active clinics: ${stats.clinics.byStatus.ACTIVE ?? stats.clinics.total}`)
  }

  return {
    periodLabel,
    availability,
    incidentCount: incidents.length,
    criticalIncidents,
    rootCause: rootCause?.probableRootCause ?? 'No dominant root cause identified',
    rootCauseConfidence: rootCause?.confidence ?? 0,
    predictedRisks: predictedRisks.length ? predictedRisks : ['None above threshold'],
    recommendedPriority,
    highlights,
    generatedAt: new Date().toISOString(),
  }
}

export function toDailyReportJson(summary: ExecutiveSummary, services: ApmService[], incidents: DashboardIncident[]): DailyReportJson {
  return {
    summary,
    services: services.map((s) => ({
      name: s.name,
      status: s.status,
      errorRate: s.errorRate,
      p95: s.p95,
    })),
    incidents: incidents.slice(0, 20).map((i) => ({
      id: i.id,
      title: i.title,
      severity: i.severity,
      service: i.service,
    })),
  }
}

export function downloadDailyReport(report: DailyReportJson) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `medicare-ops-summary-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
