import type { ApmService, PlatformIntegration, PlatformMonitor } from '../../api/types'

export type Severity = 'critical' | 'high' | 'warning' | 'info'

export interface DashboardIncident {
  id: string
  title: string
  service: string
  severity: Severity
  value: string
  source: string
  durationMinutes: number
  owner: string | null
  affectedSystemsCount: number
  blastRadius: number
  startedAt: string
  errorType?: string
}

export const severityColors: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  warning: '#f59e0b',
  info: '#06b6d4',
}

export const statusColors = {
  healthy: '#10b981',
  degraded: '#f59e0b',
  down: '#ef4444',
  up: '#10b981',
  connected: '#10b981',
  error: '#ef4444',
  available: '#8b93a8',
}

function severityRank(severity: Severity) {
  return severity === 'critical' ? 4 : severity === 'high' ? 3 : severity === 'warning' ? 2 : 1
}

function defaultOwner(source: string, severity: Severity): string {
  if (severity === 'critical') return 'On-call Engineer'
  if (source === 'integration') return 'Integrations Team'
  if (source === 'monitor') return 'SRE'
  return 'Platform Ops'
}

function estimateDuration(source: string, severity: Severity, count?: number): number {
  const base = severity === 'critical' ? 45 : severity === 'high' ? 25 : 12
  if (source === 'logs' && count) return base + Math.min(120, count * 2)
  return base
}

function countAffectedSystems(serviceName: string, services: ApmService[], integrations: PlatformIntegration[]): number {
  const relatedServices = services.filter((s) => s.status !== 'healthy' && s.name !== serviceName).length
  const relatedIntegrations = integrations.filter((i) => i.status === 'error').length
  return 1 + relatedServices + (relatedIntegrations > 0 ? 1 : 0)
}

export function sortIncidents(incidents: DashboardIncident[]): DashboardIncident[] {
  return [...incidents].sort((a, b) => {
    const sev = severityRank(b.severity) - severityRank(a.severity)
    if (sev !== 0) return sev
    const blast = b.blastRadius - a.blastRadius
    if (blast !== 0) return blast
    return b.durationMinutes - a.durationMinutes
  })
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function buildIncidents(
  services: ApmService[],
  monitors: PlatformMonitor[],
  integrations: PlatformIntegration[],
  errors: Array<{ message: string; service: string; count: number }>,
): DashboardIncident[] {
  const now = Date.now()
  const serviceIncidents = services
    .filter((service) => service.status !== 'healthy' || service.errorRate > 0 || (service.p99 ?? 0) > 1000)
    .map((service) => {
      const severity = service.status === 'down' || service.errorRate > 5 ? 'critical' as const : service.errorRate > 1 || (service.p99 ?? 0) > 1000 ? 'high' as const : 'warning' as const
      const durationMinutes = estimateDuration('apm', severity)
      const affected = countAffectedSystems(service.name, services, integrations)
      return {
        id: `svc-${service.name}`,
        title: service.status === 'down' ? `${service.name} is down` : (service.p99 ?? 0) > 1000 ? `${service.name} has high latency` : `${service.name} error rate`,
        service: service.name,
        severity,
        value: service.status === 'down' ? 'down' : service.errorRate > 0 ? `${service.errorRate}%` : `${service.p99}ms`,
        source: 'apm',
        durationMinutes,
        owner: defaultOwner('apm', severity),
        affectedSystemsCount: affected,
        blastRadius: affected * (severity === 'critical' ? 3 : severity === 'high' ? 2 : 1),
        startedAt: new Date(now - durationMinutes * 60_000).toISOString(),
        errorType: service.errorRate > 0 ? 'error_rate' : 'latency',
      }
    })
  const monitorIncidents = monitors.filter((monitor) => monitor.status !== 'up').map((monitor) => {
    const severity = monitor.status === 'down' ? 'critical' as const : 'warning' as const
    const durationMinutes = estimateDuration('monitor', severity)
    return {
      id: `mon-${monitor.id}`,
      title: `${monitor.name} ${monitor.status}`,
      service: monitor.name,
      severity,
      value: monitor.status,
      source: 'monitor',
      durationMinutes,
      owner: defaultOwner('monitor', severity),
      affectedSystemsCount: 1,
      blastRadius: severity === 'critical' ? 3 : 1,
      startedAt: monitor.lastCheck ?? new Date(now - durationMinutes * 60_000).toISOString(),
      errorType: 'availability',
    }
  })
  const integrationIncidents = integrations.filter((integration) => integration.status === 'error').map((integration) => {
    const severity = integration.name === 'OpenEMR' ? 'high' as const : 'warning' as const
    const durationMinutes = estimateDuration('integration', severity)
    return {
      id: `int-${integration.name}`,
      title: `${integration.name} unavailable`,
      service: integration.name,
      severity,
      value: 'error',
      source: 'integration',
      durationMinutes,
      owner: defaultOwner('integration', severity),
      affectedSystemsCount: 2,
      blastRadius: integration.name === 'OpenEMR' ? 4 : 2,
      startedAt: integration.checkedAt || new Date(now - durationMinutes * 60_000).toISOString(),
      errorType: 'connectivity',
    }
  })
  const errorIncidents = errors.slice(0, 6).map((error) => {
    const severity = error.count > 10 ? 'high' as const : 'warning' as const
    const durationMinutes = estimateDuration('logs', severity, error.count)
    return {
      id: `err-${error.service}-${error.message}`,
      title: error.message,
      service: error.service,
      severity,
      value: `${error.count}`,
      source: 'logs',
      durationMinutes,
      owner: defaultOwner('logs', severity),
      affectedSystemsCount: 1,
      blastRadius: error.count > 10 ? 3 : 1,
      startedAt: new Date(now - durationMinutes * 60_000).toISOString(),
      errorType: error.message.slice(0, 64),
    }
  })
  return sortIncidents([...serviceIncidents, ...monitorIncidents, ...integrationIncidents, ...errorIncidents])
}

export function computePlatformHealthScore(availability: number, serviceHealth: number, criticalIncidents: number, totalErrors: number) {
  const incidentPenalty = Math.min(40, criticalIncidents * 12 + totalErrors * 0.5)
  const score = Math.round((availability * 0.35 + serviceHealth * 0.45 + (100 - incidentPenalty) * 0.2))
  return Math.max(0, Math.min(100, score))
}

export function sparkOption(data: number[], color: string) {
  return {
    grid: { top: 2, right: 0, bottom: 2, left: 0 },
    xAxis: { show: false, data: data.map((_, i) => i) },
    yAxis: { show: false },
    series: [{ type: 'line', data, smooth: false, symbol: 'none', lineStyle: { color, width: 1 } }],
  }
}

export function seriesFromReal(values: number[]) {
  if (!values.length) return []
  return values
}

export function aggregateSeries(seriesList: number[][]) {
  const max = Math.max(0, ...seriesList.map((series) => series.length))
  return Array.from({ length: max }, (_, index) => seriesList.reduce((sum, series) => sum + (series[index] ?? 0), 0))
}
