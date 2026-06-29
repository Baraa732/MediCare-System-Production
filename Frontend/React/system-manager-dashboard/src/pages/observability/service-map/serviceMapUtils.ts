import type { ApmService, ObservabilityStatus, PlatformObservability } from '../../../api/types'
import { statusColor } from '../../../lib/alertCorrelation'

export interface ServiceMapEdgeMetrics {
  source: string
  target: string
  trafficVolume: number
  errorCount: number
  avgLatencyMs: number
}

export interface ServiceMapNode extends ApmService {
  ownerTeam: string
  uptimePct: number
}

/** Simulated topology until OpenTelemetry dependency discovery ships. */
export const SIMULATED_TOPOLOGY: Array<[string, string]> = [
  ['api-gateway', 'auth-service'],
  ['api-gateway', 'clinic-service'],
  ['api-gateway', 'user-service'],
  ['api-gateway', 'billing-service'],
  ['api-gateway', 'notification-service'],
  ['auth-service', 'user-service'],
  ['clinic-service', 'emr-service'],
  ['clinic-service', 'appointment-service'],
  ['appointment-service', 'scheduling-service'],
  ['notification-service', 'evolution-api'],
  ['system-manager-service', 'clinic-service'],
  ['system-manager-service', 'user-service'],
]

export const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  'api-gateway': { x: 400, y: 80 },
  'auth-service': { x: 180, y: 200 },
  'user-service': { x: 620, y: 200 },
  'clinic-service': { x: 180, y: 340 },
  'billing-service': { x: 400, y: 260 },
  'notification-service': { x: 620, y: 340 },
  'system-manager-service': { x: 620, y: 460 },
  'appointment-service': { x: 180, y: 460 },
  'scheduling-service': { x: 60, y: 560 },
  'emr-service': { x: 300, y: 460 },
  'reminder-service': { x: 400, y: 460 },
  'evolution-api': { x: 780, y: 340 },
}

const OWNER_TEAMS: Record<string, string> = {
  'api-gateway': 'Platform Core',
  'auth-service': 'Identity',
  'user-service': 'Identity',
  'clinic-service': 'Clinical Platform',
  'billing-service': 'Revenue',
  'notification-service': 'Messaging',
  'system-manager-service': 'Platform Ops',
  'appointment-service': 'Scheduling',
  'scheduling-service': 'Scheduling',
  'emr-service': 'Clinical Integrations',
}

export function mapStatusLabel(status: ObservabilityStatus): 'healthy' | 'warning' | 'critical' {
  if (status === 'healthy') return 'healthy'
  if (status === 'degraded') return 'warning'
  return 'critical'
}

export function buildServiceMapModel(
  services: ApmService[],
  serviceMap?: PlatformObservability['apm']['serviceMap'],
) {
  const serviceByName = new Map(services.map((s) => [s.name, s]))
  const simulated = serviceMap?.simulated ?? !serviceMap?.edges?.length
  const rawEdges = serviceMap?.edges?.length ? serviceMap.edges : SIMULATED_TOPOLOGY

  const nodes: ServiceMapNode[] = services.map((svc) => ({
    ...svc,
    ownerTeam: OWNER_TEAMS[svc.name] ?? 'Platform Ops',
    uptimePct: svc.status === 'healthy' ? 99.9 : svc.status === 'degraded' ? 97.5 : 85,
  }))

  const edges: ServiceMapEdgeMetrics[] = rawEdges.map(([source, target]) => {
    const srcSvc = serviceByName.get(source)
    const tgtSvc = serviceByName.get(target)
    const trafficVolume = Math.round(((srcSvc?.reqRate ?? 10) + (tgtSvc?.reqRate ?? 5)) * 0.6)
    const errorCount = Math.round(((srcSvc?.errorRate ?? 0) + (tgtSvc?.errorRate ?? 0)) * trafficVolume * 0.01)
    const avgLatencyMs = Math.round(((srcSvc?.p95 ?? 40) + (tgtSvc?.p95 ?? 40)) / 2)
    return { source, target, trafficVolume, errorCount, avgLatencyMs }
  })

  return { nodes, edges, simulated }
}

export function getUpstream(service: string, edges: ServiceMapEdgeMetrics[]): string[] {
  return edges.filter((e) => e.target === service).map((e) => e.source)
}

export function getDownstream(service: string, edges: ServiceMapEdgeMetrics[]): string[] {
  return edges.filter((e) => e.source === service).map((e) => e.target)
}

export { statusColor }

export function saturationScore(svc: ApmService): number {
  const latencyFactor = Math.min(100, (svc.p95 ?? 0) / 10)
  const errorFactor = svc.errorRate * 8
  const trafficFactor = Math.min(30, svc.reqRate / 5)
  return Math.round(Math.min(100, latencyFactor + errorFactor + trafficFactor))
}
