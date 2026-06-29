import type { ApmService } from '../api/types'
import type { AnomalySignal } from './anomalyEngine'

export type PredictiveSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface PredictiveFailure {
  id: string
  service: string
  message: string
  severity: PredictiveSeverity
  confidence: number
  estimatedMinutes: number
  impactedServices: string[]
  signals: string[]
}

function mean(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function trendSlope(values: number[]): number {
  if (values.length < 3) return 0
  const first = mean(values.slice(0, Math.floor(values.length / 2)))
  const second = mean(values.slice(Math.floor(values.length / 2)))
  if (first === 0) return second > 0 ? 1 : 0
  return (second - first) / first
}

function estimateMinutesToBreach(current: number, slope: number, threshold: number): number {
  if (current >= threshold) return 0
  if (slope <= 0) return 999
  const remaining = threshold - current
  const ratePerBucket = slope * current
  if (ratePerBucket <= 0) return 999
  return Math.max(5, Math.round((remaining / ratePerBucket) * 15))
}

/** Predict incidents using rolling windows and anomaly thresholds — no ML. */
export function predictFailures(input: {
  services: ApmService[]
  anomalies: AnomalySignal[]
  serviceMapEdges?: string[][]
}): PredictiveFailure[] {
  const { services, anomalies, serviceMapEdges = [] } = input
  const predictions: PredictiveFailure[] = []

  for (const svc of services) {
    const series = svc.series?.length ? svc.series : [svc.reqRate]
    const errSlope = trendSlope(series.map((v) => v * (svc.errorRate / 100 + 0.01)))
    const latSlope = trendSlope(series.map((v) => v * 2 + (svc.p95 ?? 40) / 100))
    const memProxy = trendSlope(series) * (svc.reqRate / 10)
    const signals: string[] = []

    // Error acceleration
    if (svc.errorRate > 0.5 && errSlope > 0.15) {
      signals.push(`Error rate accelerating (+${Math.round(errSlope * 100)}%)`)
    }

    // Latency degradation
    if ((svc.p95 ?? 0) > 250 && latSlope > 0.1) {
      signals.push(`Latency degrading (+${Math.round(latSlope * 100)}% trend)`)
    }

    // Memory leak trend proxy
    if (memProxy > 0.2 && svc.reqRate > 5) {
      signals.push('Memory pressure trend detected')
    }

    // Saturation
    const saturation = ((svc.p95 ?? 0) / 10) + svc.errorRate * 5 + svc.reqRate / 8
    if (saturation > 40) {
      signals.push(`Saturation index ${Math.round(saturation)}`)
    }

    // Burn-rate acceleration from anomalies
    const svcAnomalies = anomalies.filter((a) => a.service === svc.name)
    if (svcAnomalies.some((a) => a.severity === 'severe')) {
      signals.push('Severe anomaly cluster active')
    }

    if (!signals.length) continue

    const estimatedMinutes = estimateMinutesToBreach(
      saturation,
      Math.max(errSlope, latSlope, memProxy),
      80,
    )

    let severity: PredictiveSeverity = 'medium'
    if (estimatedMinutes <= 20 || svc.status === 'down') severity = 'critical'
    else if (estimatedMinutes <= 45 || svc.errorRate > 3) severity = 'high'
    else if (estimatedMinutes <= 90) severity = 'medium'
    else severity = 'low'

    const confidence = Math.min(92, 55 + signals.length * 10 + (svc.status !== 'healthy' ? 15 : 0))

    const downstream = serviceMapEdges.filter(([s]) => s === svc.name).map(([, t]) => t)

    predictions.push({
      id: `pred-${svc.name}`,
      service: svc.name,
      message: estimatedMinutes < 999
        ? `${svc.name} likely to breach SLO in ${estimatedMinutes} minutes`
        : `${svc.name} showing pre-failure signals`,
      severity,
      confidence,
      estimatedMinutes: estimatedMinutes === 999 ? 120 : estimatedMinutes,
      impactedServices: [svc.name, ...downstream].slice(0, 6),
      signals,
    })
  }

  return predictions
    .sort((a, b) => {
      const rank = { critical: 4, high: 3, medium: 2, low: 1 }
      return rank[b.severity] - rank[a.severity] || a.estimatedMinutes - b.estimatedMinutes
    })
    .slice(0, 6)
}

export function predictiveColor(severity: PredictiveSeverity): string {
  if (severity === 'critical') return '#ef4444'
  if (severity === 'high') return '#f97316'
  if (severity === 'medium') return '#f59e0b'
  return '#06b6d4'
}
