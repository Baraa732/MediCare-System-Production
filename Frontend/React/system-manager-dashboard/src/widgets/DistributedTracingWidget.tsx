import { useMemo } from 'react'
import { DashboardCard, WidgetHeader } from '../components/ui'
import ObsidianTraceGraph from '../components/observability/ObsidianTraceGraph'
import type { PlatformObservability } from '../api/types'

export default function DistributedTracingWidget({
  delay = 0,
  observability,
}: {
  delay?: number
  observability?: PlatformObservability | null
}) {
  const { nodes, edges } = useMemo(() => {
    const map = observability?.apm.serviceMap
    const services = observability?.apm.services ?? []
    const byName = new Map(services.map((s) => [s.name, s]))

    const nodes = (map?.nodes?.length
      ? map.nodes.map((n) => {
          const svc = byName.get(n.id) ?? byName.get(n.name)
          return {
            id: n.id || n.name,
            name: n.name || n.id,
            status: n.status || svc?.status || 'healthy',
            reqRate: n.reqRate ?? svc?.reqRate,
            errorRate: n.errorRate ?? svc?.errorRate,
            p95: svc?.p95,
          }
        })
      : services.map((s) => ({
          id: s.name,
          name: s.name,
          status: s.status,
          reqRate: s.reqRate,
          errorRate: s.errorRate,
          p95: s.p95,
        }))) as Array<{
      id: string
      name: string
      status: string
      reqRate?: number
      errorRate?: number
      p95?: number | null
    }>

    const rawEdges = map?.edges ?? []
    const edges = rawEdges.map((e: any) => {
      if (Array.isArray(e)) {
        return { source: e[0], target: e[1], count: 1, avgLatencyMs: 0 }
      }
      return {
        source: e.source,
        target: e.target,
        count: e.count,
        avgLatencyMs: e.avgLatencyMs,
      }
    })

    return { nodes, edges }
  }, [observability])

  return (
    <DashboardCard minHeight={520} delay={delay}>
      <WidgetHeader
        title="Distributed Tracing"
        subtitle={
          observability?.apm.serviceMap?.simulated
            ? 'Topology · estimated'
            : 'Obsidian force graph · live'
        }
      />
      <ObsidianTraceGraph nodes={nodes} edges={edges} tall />
    </DashboardCard>
  )
}
