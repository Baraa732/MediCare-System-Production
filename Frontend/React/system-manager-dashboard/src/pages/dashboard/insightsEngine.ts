import type { ApmService, PlatformStats } from '../../api/types'
import type { Clinic, PlatformUser } from '../../api/types'
import type { DashboardTimeRange } from '../../store/dashboardStore'

export type InsightImpact = 'high' | 'medium' | 'low'
export type InsightConfidence = 'high' | 'medium' | 'low'

export interface DashboardInsight {
  id: string
  message: string
  confidence: InsightConfidence
  impact: InsightImpact
  color: string
}

const IMPACT_RANK = { high: 3, medium: 2, low: 1 }

function windowHours(range: DashboardTimeRange): number {
  if (range === '24h') return 24
  if (range === '7d') return 168
  if (range === '30d') return 720
  return 1
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function seriesDelta(series: number[]): number {
  if (series.length < 4) return 0
  const mid = Math.floor(series.length / 2)
  const prev = series.slice(0, mid).reduce((s, v) => s + v, 0) / mid
  const curr = series.slice(mid).reduce((s, v) => s + v, 0) / (series.length - mid)
  return pctChange(curr, prev)
}

/** Heuristic anomaly detection — no ML, window-over-window comparisons. */
export function generateInsights(input: {
  services: ApmService[]
  errors: Array<{ message: string; service: string; count: number }>
  stats: PlatformStats | null
  clinics: Clinic[]
  users: PlatformUser[]
  timeRange: DashboardTimeRange
}): DashboardInsight[] {
  const insights: DashboardInsight[] = []
  const { services, errors, stats, clinics, timeRange } = input

  // Error spike by service
  const errorByService = new Map<string, number>()
  for (const err of errors) {
    errorByService.set(err.service, (errorByService.get(err.service) ?? 0) + err.count)
  }
  const topError = [...errorByService.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topError && topError[1] >= 3) {
    const svc = services.find((s) => s.name === topError[0])
    const delta = svc?.series?.length ? seriesDelta(svc.series) : Math.min(120, topError[1] * 8)
    if (delta >= 25) {
      insights.push({
        id: `err-${topError[0]}`,
        message: `Error spike +${delta}% in ${topError[0]}`,
        confidence: delta >= 60 ? 'high' : 'medium',
        impact: topError[1] > 15 ? 'high' : 'medium',
        color: '#ef4444',
      })
    }
  }

  // Latency anomaly
  const latencySvc = services
    .filter((s) => s.status !== 'healthy' || (s.p95 ?? 0) > 400)
    .sort((a, b) => (b.p95 ?? 0) - (a.p95 ?? 0))[0]
  if (latencySvc && (latencySvc.p95 ?? 0) > 300) {
    const baseline = latencySvc.series?.length
      ? latencySvc.series.slice(0, Math.max(1, Math.floor(latencySvc.series.length / 2))).reduce((s, v) => s + v, 0) / Math.max(1, Math.floor(latencySvc.series.length / 2))
      : (latencySvc.p95 ?? 0) * 0.7
    const lift = pctChange(latencySvc.p95 ?? 0, baseline)
    if (lift >= 15) {
      insights.push({
        id: `lat-${latencySvc.name}`,
        message: `Latency anomaly in ${latencySvc.name} (+${lift}% vs prior buckets)`,
        confidence: latencySvc.status === 'down' ? 'high' : 'medium',
        impact: (latencySvc.p95 ?? 0) > 800 ? 'high' : 'medium',
        color: '#f59e0b',
      })
    }
  }

  // Activation conversion drop
  if (stats) {
    const codesTotal = stats.activationCodes.total
    const codesUsed = stats.activationCodes.byStatus.USED ?? stats.activationCodes.byStatus.used ?? 0
    const conversion = codesTotal ? Math.round((codesUsed / codesTotal) * 1000) / 10 : 0
    const expected = 72
    if (codesTotal >= 5 && conversion < expected) {
      const drop = Math.round(expected - conversion)
      insights.push({
        id: 'activation-conversion',
        message: `Activation conversion dropped ${drop}% (now ${conversion}%)`,
        confidence: codesTotal >= 20 ? 'high' : 'medium',
        impact: drop >= 20 ? 'high' : 'medium',
        color: '#8b5cf6',
      })
    }
  }

  // Clinic growth acceleration
  const recent = clinics.filter((c) => {
    if (!c.createdAt) return false
    const age = Date.now() - new Date(c.createdAt).getTime()
    return age <= windowHours(timeRange) * 3_600_000
  }).length
  const prior = clinics.filter((c) => {
    if (!c.createdAt) return false
    const age = Date.now() - new Date(c.createdAt).getTime()
    const windowMs = windowHours(timeRange) * 3_600_000
    return age > windowMs && age <= windowMs * 2
  }).length
  const growthDelta = pctChange(recent, prior)
  if (recent > 0 && growthDelta >= 10) {
    insights.push({
      id: 'clinic-growth',
      message: `Clinic growth accelerated ${growthDelta}% vs prior window`,
      confidence: recent >= 3 ? 'medium' : 'low',
      impact: growthDelta >= 30 ? 'high' : 'medium',
      color: '#10b981',
    })
  }

  // Gateway-specific fallback insight if nothing else
  if (!insights.length && services.some((s) => s.name.includes('gateway') && s.errorRate > 0)) {
    const gw = services.find((s) => s.name.includes('gateway'))!
    insights.push({
      id: 'gw-errors',
      message: `Elevated error rate (${gw.errorRate}%) on ${gw.name}`,
      confidence: 'medium',
      impact: 'medium',
      color: '#f97316',
    })
  }

  return insights
    .sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact])
    .slice(0, 3)
}

export interface ErrorBudgetResult {
  remainingPct: number
  burnRate: number
  state: 'healthy' | 'warning' | 'critical'
  color: string
  label: string
  /** Projected minutes until budget exhausted at current burn rate. */
  exhaustionMinutes: number | null
  exhaustionLabel: string
}

const SLO_TARGET = 99.9

/** Error budget remaining based on availability vs SLO target. */
export function computeErrorBudget(availability: number, totalErrors: number, timeRange: DashboardTimeRange): ErrorBudgetResult {
  const allowedMiss = 100 - SLO_TARGET
  const actualMiss = Math.max(0, SLO_TARGET - availability)
  const consumedRatio = allowedMiss > 0 ? actualMiss / allowedMiss : 0
  const remainingPct = Math.round(Math.max(0, Math.min(100, (1 - consumedRatio) * 100)) * 10) / 10

  const hours = windowHours(timeRange)
  const burnRate = Math.round((totalErrors / Math.max(1, hours)) * 10) / 10

  let state: ErrorBudgetResult['state'] = 'healthy'
  let color = '#10b981'
  if (remainingPct < 50) {
    state = 'critical'
    color = '#ef4444'
  } else if (remainingPct < 80) {
    state = 'warning'
    color = '#f59e0b'
  }

  const label = state === 'healthy' ? 'Within budget' : state === 'warning' ? 'Burn accelerating' : 'Budget exhausted'

  // Project exhaustion: budget consumed per hour vs remaining budget fraction
  const budgetRemainingFraction = remainingPct / 100
  const burnPerHour = burnRate
  let exhaustionMinutes: number | null = null
  let exhaustionLabel = 'Stable burn rate'
  if (burnPerHour > 0 && budgetRemainingFraction > 0 && state !== 'healthy') {
    const hoursLeft = (budgetRemainingFraction * allowedMiss * 10) / Math.max(0.1, burnPerHour)
    exhaustionMinutes = Math.round(hoursLeft * 60)
    if (exhaustionMinutes < 24 * 60) {
      const h = Math.floor(exhaustionMinutes / 60)
      const m = exhaustionMinutes % 60
      exhaustionLabel = h > 0 ? `Exhausted in ${h}h ${m}m` : `Exhausted in ${m}m`
    } else {
      exhaustionLabel = 'Exhaustion > 24h at current burn'
      exhaustionMinutes = null
    }
  } else if (state === 'critical') {
    exhaustionLabel = 'Budget exhausted'
    exhaustionMinutes = 0
  }

  return { remainingPct, burnRate, state, color, label, exhaustionMinutes, exhaustionLabel }
}
