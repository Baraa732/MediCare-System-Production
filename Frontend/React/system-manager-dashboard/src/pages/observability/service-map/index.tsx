import { useMemo, useState } from 'react'
import { Alert, Box, Chip, Grid, Typography } from '@mui/material'
import { GitBranch, Network } from 'lucide-react'
import { AdvancedPageHeader, AdvancedPanel, ObservabilityPage, PbiGrid } from '../../../components/advanced/AdvancedPage'
import { useObservabilityData } from '../../../hooks/useObservabilityData'
import { usePlatformLogs } from '../../../hooks/usePlatformLogs'
import { buildIncidents } from '../../dashboard/dashboardUtils'
import { useObservabilityStore } from '../../../store/observabilityStore'
import ServiceMapGraph from './components/ServiceMapGraph'
import ServiceDetailsDrawer from './components/ServiceDetailsDrawer'
import { buildServiceMapModel, type ServiceMapEdgeMetrics, type ServiceMapNode } from './serviceMapUtils'

export default function ServiceMapPage() {
  const { data, loading } = useObservabilityData(undefined, true)
  const setSelectedServiceName = useObservabilityStore((s) => s.setSelectedServiceName)
  const selectedServiceName = useObservabilityStore((s) => s.selectedServiceName)
  const selectedEdge = useObservabilityStore((s) => s.selectedEdge)
  const setSelectedEdge = useObservabilityStore((s) => s.setSelectedEdge)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeService, setActiveService] = useState<ServiceMapNode | null>(null)

  const services = data?.apm.services ?? []
  const { nodes, edges, simulated } = useMemo(
    () => buildServiceMapModel(services, data?.apm.serviceMap),
    [services, data?.apm.serviceMap],
  )

  const incidents = useMemo(
    () => buildIncidents(services, data?.monitors.items ?? [], data?.integrations ?? [], data?.apm.errors ?? []),
    [services, data],
  )

  const { entries: errorLogs } = usePlatformLogs({
    services: activeService ? [activeService.name] : undefined,
    levels: ['ERROR'],
    range: '1h',
    limit: 20,
  }, Boolean(activeService))

  const handleNodeClick = (node: ServiceMapNode) => {
    setActiveService(node)
    setSelectedServiceName(node.name)
    setDrawerOpen(true)
  }

  const handleEdgeClick = (edge: ServiceMapEdgeMetrics) => {
    setSelectedEdge({ source: edge.source, target: edge.target })
  }

  const activeEdge = edges.find((e) => e.source === selectedEdge?.source && e.target === selectedEdge?.target)

  return (
    <ObservabilityPage>
      <AdvancedPageHeader
        title="Service Map"
        eyebrow="Observability / Topology"
        description="Interactive dependency graph — hover for metrics, click nodes for service drill-down."
        icon={Network}
        color="#06b6d4"
        status={loading ? 'Syncing…' : `${nodes.length} services`}
        compact
      />

      {simulated && (
        <Alert severity="info" sx={{ flexShrink: 0 }}>
          Dependency discovery simulated until OpenTelemetry integration — edge metrics are inferred from live service telemetry.
        </Alert>
      )}

      <PbiGrid spacing={1.5}>
        <Grid size={{ xs: 12, lg: activeEdge ? 9 : 12 }}>
          <AdvancedPanel title="Service Dependency Map" caption="nodes = services · edges = communication · live health colors" dense>
            <ServiceMapGraph nodes={nodes} edges={edges} onNodeClick={handleNodeClick} onEdgeClick={handleEdgeClick} />
          </AdvancedPanel>
        </Grid>

        {activeEdge && (
          <Grid size={{ xs: 12, lg: 3 }}>
            <AdvancedPanel title="Dependency Metrics" caption={`${activeEdge.source} → ${activeEdge.target}`} dense>
              <Box sx={{ display: 'grid', gap: 1.25 }}>
                <Metric label="Traffic volume" value={`${activeEdge.trafficVolume}/s`} />
                <Metric label="Error count" value={String(activeEdge.errorCount)} color={activeEdge.errorCount > 0 ? '#ef4444' : undefined} />
                <Metric label="Avg latency" value={`${activeEdge.avgLatencyMs}ms`} color={activeEdge.avgLatencyMs > 300 ? '#f59e0b' : undefined} />
                <Chip icon={<GitBranch size={12} />} label="Click another edge to compare" size="small" variant="outlined" sx={{ fontSize: 10, mt: 1 }} onDelete={() => setSelectedEdge(null)} />
              </Box>
            </AdvancedPanel>
          </Grid>
        )}
      </PbiGrid>

      <ServiceDetailsDrawer
        service={activeService ?? nodes.find((n) => n.name === selectedServiceName) ?? null}
        edges={edges}
        incidents={incidents}
        errorLogs={errorLogs}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setActiveService(null); setSelectedServiceName(null) }}
      />
    </ObservabilityPage>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: '4px' }}>
      <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="metricSm" sx={{ color: color ?? 'text.primary' }}>{value}</Typography>
    </Box>
  )
}
