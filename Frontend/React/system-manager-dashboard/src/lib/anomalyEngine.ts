import type { ApmService } from '../api/types'

export type AnomalySeverity = 'mild' | 'warning' | 'severe'

export interface AnomalySignal {
  id: string
  metric: 'latency' | 'throughput' | 'error_rate' | 'cpu' | 'memory' | 'auth_failures'
  service: string
  severity: AnomalySeverity
  score: number
  message: string
  current: number
  baseline: number
  deviationPct: number
}

function mean(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function stddev(values: number[], avg = mean(values)): number {
  if (values.length < 2) return 0
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function zScore(current: number, values: number[]): number {
  const avg = mean(values)
  const sd = stddev(values, avg)
  if (sd === 0) return current > avg ? 2 : 0
  return (current - avg) / sd
}

function classifyZ(z: number): AnomalySeverity {
  if (z >= 3) return 'severe'
  if (z >= 2) return 'warning'
  return 'mild'
}

function severityColor(severity: AnomalySeverity): string {
  if (severity === 'severe') return '#ef4444'
  if (severity === 'warning') return '#f59e0b'
  return '#06b6d4'
}

function seriesDeltaPct(series: number[]): number {
  if (series.length < 4) return 0
  const mid = Math.floor(series.length / 2)
  const prev = mean(series.slice(0, mid))
  const curr = mean(series.slice(mid))
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

/** Rolling z-score + moving-average deviation anomaly detection. */
export function detectAnomalies(services: ApmService[]): AnomalySignal[] {
  const signals: AnomalySignal[] = []

  for (const svc of services) {
    const series = svc.series?.length ? svc.series : [svc.reqRate]

    // Latency
    const p95 = svc.p95 ?? 0
    const latencyBaseline = mean(series) * 8 + 40
    const latZ = zScore(p95, series.map((v) => v * 8 + 40))
    if (p95 > 0 && latZ >= 1.5) {
      const severity = classifyZ(latZ)
      const deviationPct = latencyBaseline > 0 ? Math.round(((p95 - latencyBaseline) / latencyBaseline) * 100) : 0
      signals.push({
        id: `lat-${svc.name}`,
        metric: 'latency',
        service: svc.name,
        severity,
        score: Math.round(latZ * 100) / 100,
        message: `${svc.name} latency ${deviationPct >= 0 ? '+' : ''}${deviationPct}% abnormal`,
        current: p95,
        baseline: Math.round(latencyBaseline),
        deviationPct,
      })
    }

    // Throughput
    const throughput = svc.reqRate
    const tpZ = zScore(throughput, series)
    const tpDelta = seriesDeltaPct(series)
    if (Math.abs(tpZ) >= 2 || Math.abs(tpDelta) >= 40) {
      const severity = Math.abs(tpZ) >= 3 || Math.abs(tpDelta) >= 80 ? 'severe' : 'warning'
      signals.push({
        id: `tp-${svc.name}`,
        metric: 'throughput',
        service: svc.name,
        severity,
        score: Math.round(Math.max(Math.abs(tpZ), Math.abs(tpDelta) / 30) * 100) / 100,
        message: `${svc.name} throughput ${tpDelta >= 0 ? '+' : ''}${tpDelta}% vs prior window`,
        current: throughput,
        baseline: Math.round(mean(series)),
        deviationPct: tpDelta,
      })
    }

    // Error rate
    if (svc.errorRate > 0.5) {
      const errZ = zScore(svc.errorRate, series.map((v) => Math.min(100, v * 0.5)))
      const severity: AnomalySeverity = svc.errorRate > 5 ? 'severe' : svc.errorRate > 2 ? 'warning' : 'mild'
      signals.push({
        id: `err-${svc.name}`,
        metric: 'error_rate',
        service: svc.name,
        severity,
        score: Math.round(Math.max(errZ, svc.errorRate / 2) * 100) / 100,
        message: `${svc.name} error rate ${svc.errorRate}% (${severity})`,
        current: svc.errorRate,
        baseline: 0.5,
        deviationPct: Math.round(svc.errorRate * 10),
      })
    }

    // CPU / memory proxies from extended ApmService fields
    const cpu = (svc as ApmService & { cpuPercent?: number | null }).cpuPercent
    if (cpu !== null && cpu !== undefined && cpu > 60) {
      signals.push({
        id: `cpu-${svc.name}`,
        metric: 'cpu',
        service: svc.name,
        severity: cpu > 85 ? 'severe' : cpu > 70 ? 'warning' : 'mild',
        score: cpu / 20,
        message: `${svc.name} CPU at ${cpu}%`,
        current: cpu,
        baseline: 35,
        deviationPct: Math.round(((cpu - 35) / 35) * 100),
      })
    }

    const memory = (svc as ApmService & { memoryBytes?: number | null }).memoryBytes
    if (memory !== null && memory !== undefined && memory > 200_000_000) {
      const mb = Math.round(memory / 1_048_576)
      signals.push({
        id: `mem-${svc.name}`,
        metric: 'memory',
        service: svc.name,
        severity: mb > 450 ? 'severe' : mb > 300 ? 'warning' : 'mild',
        score: mb / 100,
        message: `${svc.name} memory ${mb}MB`,
        current: mb,
        baseline: 180,
        deviationPct: Math.round(((mb - 180) / 180) * 100),
      })
    }

    // Auth failures proxy
    if (svc.name.includes('auth') && svc.errorRate > 1) {
      signals.push({
        id: `auth-${svc.name}`,
        metric: 'auth_failures',
        service: svc.name,
        severity: svc.errorRate > 3 ? 'severe' : 'warning',
        score: svc.errorRate,
        message: `Auth failure rate elevated (${svc.errorRate}%)`,
        current: svc.errorRate,
        baseline: 0.2,
        deviationPct: Math.round(svc.errorRate * 20),
      })
    }
  }

  return signals
    .sort((a, b) => {
      const rank = { severe: 3, warning: 2, mild: 1 }
      return rank[b.severity] - rank[a.severity] || b.score - a.score
    })
    .slice(0, 12)
}

export function anomalyColor(severity: AnomalySeverity): string {
  return severityColor(severity)
}
