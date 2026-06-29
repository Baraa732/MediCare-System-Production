import { memo, useMemo } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Typography,
} from '@mui/material'
import { Activity, AlertTriangle, FileText, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { PlatformLogEntry } from '../../../../api/types'
import { buildLogsUrl } from '../../../../store/logsFilterStore'
import { formatDuration, severityColors, type DashboardIncident } from '../../../dashboard/dashboardUtils'
import type { ServiceMapEdgeMetrics, ServiceMapNode } from '../serviceMapUtils'
import { getDownstream, getUpstream, mapStatusLabel, saturationScore, statusColor } from '../serviceMapUtils'

interface ServiceDetailsDrawerProps {
  service: ServiceMapNode | null
  edges: ServiceMapEdgeMetrics[]
  incidents: DashboardIncident[]
  errorLogs: PlatformLogEntry[]
  open: boolean
  onClose: () => void
}

function ServiceDetailsDrawer({ service, edges, incidents, errorLogs, open, onClose }: ServiceDetailsDrawerProps) {
  const theme = useTheme()
  const navigate = useNavigate()

  const relatedIncidents = useMemo(
    () => incidents.filter((i) => i.service === service?.name).slice(0, 5),
    [incidents, service?.name],
  )

  if (!service) return null

  const upstream = getUpstream(service.name, edges)
  const downstream = getDownstream(service.name, edges)
  const color = statusColor(service.status)
  const saturation = saturationScore(service)

  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: 480, bgcolor: 'background.paper', borderLeft: 1, borderColor: 'divider' } } }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h3">{service.name}</Typography>
          <Chip label={mapStatusLabel(service.status).toUpperCase()} size="small" sx={{ mt: 0.75, height: 22, fontSize: 10, color, bgcolor: alpha(color, 0.12), border: `1px solid ${alpha(color, 0.35)}` }} />
        </Box>
        <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
      </Box>

      <Box sx={{ p: 2, display: 'grid', gap: 2, overflow: 'auto' }}>
        <Section title="Overview">
          <MetricRow label="Status" value={mapStatusLabel(service.status)} color={color} />
          <MetricRow label="Uptime" value={`${service.uptimePct}%`} />
          <MetricRow label="Owner team" value={service.ownerTeam} />
          <MetricRow label="Instances" value={String(service.instances)} />
        </Section>

        <Section title="Metrics">
          <MetricRow label="p95 latency" value={`${service.p95 ?? 0}ms`} color={(service.p95 ?? 0) > 500 ? '#ef4444' : undefined} />
          <MetricRow label="Throughput" value={`${service.reqRate}/s`} />
          <MetricRow label="Error rate" value={`${service.errorRate}%`} color={service.errorRate > 0 ? '#ef4444' : undefined} />
          <MetricRow label="Saturation" value={`${saturation}%`} color={saturation > 70 ? '#f59e0b' : undefined} />
        </Section>

        <Section title="Recent Incidents">
          {relatedIncidents.length ? relatedIncidents.map((inc) => (
            <Box key={inc.id} sx={{ py: 0.75, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{inc.title}</Typography>
              <Typography variant="caption2" sx={{ color: severityColors[inc.severity] }}>{inc.severity.toUpperCase()} · {formatDuration(inc.durationMinutes)}</Typography>
            </Box>
          )) : (
            <Typography variant="caption2" sx={{ color: 'text.secondary' }}>No active incidents for this service.</Typography>
          )}
        </Section>

        <Section title="Logs Preview">
          {errorLogs.slice(0, 4).map((log) => (
            <Box key={log.id} sx={{ py: 0.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="caption2" sx={{ color: '#ef4444' }}>{log.level}</Typography>
              <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</Typography>
            </Box>
          ))}
          {!errorLogs.length && <Typography variant="caption2" sx={{ color: 'text.secondary' }}>No recent errors.</Typography>}
        </Section>

        <Section title="Dependencies">
          <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Upstream</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {upstream.length ? upstream.map((s) => <Chip key={s} label={s} size="small" sx={{ height: 22, fontSize: 10 }} />) : <Typography variant="caption2" sx={{ color: 'text.disabled' }}>None</Typography>}
          </Box>
          <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Downstream</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {downstream.length ? downstream.map((s) => <Chip key={s} label={s} size="small" sx={{ height: 22, fontSize: 10 }} />) : <Typography variant="caption2" sx={{ color: 'text.disabled' }}>None</Typography>}
          </Box>
        </Section>

        <Divider />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" startIcon={<FileText size={14} />} onClick={() => navigate(buildLogsUrl({ services: [service.name], levels: ['ERROR', 'WARN'] }))}>
            Open Logs
          </Button>
          <Button size="small" variant="outlined" startIcon={<Activity size={14} />} onClick={() => navigate('/metrics')}>
            Open Metrics
          </Button>
          <Button size="small" variant="outlined" startIcon={<AlertTriangle size={14} />} onClick={() => navigate('/alerts')}>
            Open Incidents
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>{title}</Typography>
      {children}
    </Box>
  )
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
      <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 600, color: color ?? 'text.primary' }}>{value}</Typography>
    </Box>
  )
}

export default memo(ServiceDetailsDrawer)
