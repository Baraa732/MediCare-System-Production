import { memo, useMemo } from 'react'
import { alpha } from '@mui/material/styles'
import { Box, Chip, Grid, Typography } from '@mui/material'
import { GitBranch } from 'lucide-react'
import { AdvancedPanel } from '../../../components/advanced/AdvancedPage'
import { alertsFromIncidents, alertsFromServices, correlateAlerts, type AlertCluster } from '../../../lib/alertCorrelation'
import type { ApmService } from '../../../api/types'
import type { DashboardIncident } from '../../dashboard/dashboardUtils'
import { SIMULATED_TOPOLOGY } from '../../observability/service-map/serviceMapUtils'

interface AlertCorrelationPanelProps {
  services: ApmService[]
  incidents: DashboardIncident[]
  topology?: Array<[string, string]>
}

function ClusterCard({ cluster }: { cluster: AlertCluster }) {
  const color = cluster.severity === 'critical' ? '#ef4444' : cluster.severity === 'high' ? '#f97316' : '#f59e0b'
  return (
    <Box sx={{ p: 1.25, border: 1, borderColor: alpha(color, 0.35), borderRadius: '4px', borderLeft: `3px solid ${color}`, bgcolor: alpha(color, 0.06) }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{cluster.label}</Typography>
        <Chip label={`${cluster.confidence} confidence`} size="small" sx={{ height: 20, fontSize: 10, color, bgcolor: alpha(color, 0.12) }} />
      </Box>
      <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        Root cause: {cluster.rootCause}
      </Typography>
      <Typography variant="caption2" sx={{ color: 'text.disabled' }}>
        {cluster.affectedServices.join(' · ')} · {cluster.signals.length} signals
      </Typography>
    </Box>
  )
}

function AlertCorrelationPanel({ services, incidents, topology }: AlertCorrelationPanelProps) {
  const clusters = useMemo(() => {
    const signals = [...alertsFromServices(services), ...alertsFromIncidents(incidents)]
    return correlateAlerts(signals, topology?.length ? topology : SIMULATED_TOPOLOGY)
  }, [services, incidents, topology])

  if (!clusters.length) return null

  return (
    <AdvancedPanel title="Alert Correlation" caption="noise reduction · grouped incident clusters" dense>
      <Grid container spacing={1.5}>
        {clusters.slice(0, 3).map((cluster) => (
          <Grid size={{ xs: 12, md: 4 }} key={cluster.id}>
            <ClusterCard cluster={cluster} />
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
        <GitBranch size={13} color="#8b93a8" />
        <Typography variant="caption2" sx={{ color: 'text.secondary' }}>
          Heuristic grouping by timestamp proximity, shared services, and dependency graph.
        </Typography>
      </Box>
    </AdvancedPanel>
  )
}

export default memo(AlertCorrelationPanel)
