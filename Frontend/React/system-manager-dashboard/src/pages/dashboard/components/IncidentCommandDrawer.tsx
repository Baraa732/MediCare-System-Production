import type { ReactNode } from 'react'
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
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpCircle, CheckCircle2, FileText, GitBranch, UserPlus, X, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ApmService } from '../../../api/types'
import { getTraceForService } from '../../../api/systemManager'
import { useIncidentPersistence } from '../../../hooks/useIncidentPersistence'
import { queryKeys } from '../../../lib/queryClient'
import { resolveSessionToken } from '../../../lib/sessionToken'
import { useAuthStore } from '../../../store/authStore'
import { buildLogsUrl } from '../../../store/logsFilterStore'
import { notify } from '../../../lib/toast'
import { formatDuration, severityColors, type DashboardIncident } from '../dashboardUtils'
import { suggestRemediation, remediationPriorityColor } from '../../../lib/remediationEngine'
import { topRootCause } from '../../../lib/rootCauseEngine'
import { detectAnomalies } from '../../../lib/anomalyEngine'
import { predictFailures } from '../../../lib/predictiveEngine'

interface IncidentCommandDrawerProps {
  incident: DashboardIncident | null
  services: ApmService[]
  errors?: Array<{ message: string; service: string; count: number }>
  open: boolean
  onClose: () => void
}

function buildTimeline(incident: DashboardIncident) {
  const start = new Date(incident.startedAt)
  return [
    { time: new Date(start.getTime()).toISOString(), label: 'Incident detected', detail: incident.title },
    { time: new Date(start.getTime() + 2 * 60_000).toISOString(), label: 'Alert routed', detail: `Routed to ${incident.owner ?? 'Platform Ops'}` },
    { time: new Date(start.getTime() + 5 * 60_000).toISOString(), label: 'Correlation match', detail: `${incident.affectedSystemsCount} systems affected` },
    { time: new Date().toISOString(), label: 'Live status', detail: `${incident.severity.toUpperCase()} · ${formatDuration(incident.durationMinutes)} elapsed` },
  ]
}

function inferRootCause(incident: DashboardIncident, services: ApmService[]): string {
  const svc = services.find((s) => s.name === incident.service)
  if (incident.source === 'integration') return `External dependency failure: ${incident.service}`
  if (svc?.status === 'down') return `${incident.service} health check failing — instance unreachable`
  if ((svc?.p95 ?? 0) > 500) return `Latency saturation on ${incident.service} — p95 ${svc?.p95}ms exceeds SLO`
  if ((svc?.errorRate ?? 0) > 2) return `Elevated error rate (${svc?.errorRate}%) on ${incident.service}`
  if (incident.errorType && !['error_rate', 'latency', 'availability', 'connectivity'].includes(incident.errorType)) {
    return `Log-derived error pattern: ${incident.errorType}`
  }
  return `Degraded telemetry on ${incident.service} — investigate upstream dependencies`
}

function TraceTimeline({ spans }: { spans: Array<{ service: string; operation: string; durationMs: number; status: string }> }) {
  const theme = useTheme()
  const maxDuration = Math.max(...spans.map((s) => s.durationMs), 1)

  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      {spans.map((span, index) => {
        const widthPct = Math.max(8, Math.round((span.durationMs / maxDuration) * 100))
        const color = span.status === 'error' ? '#ef4444' : span.status === 'slow' ? '#f59e0b' : '#06b6d4'
        return (
          <Box key={`${span.service}-${index}`} sx={{ display: 'grid', gridTemplateColumns: '120px 1fr 56px', gap: 1, alignItems: 'center' }}>
            <Typography variant="caption2" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {index > 0 ? '→ ' : ''}{span.service}
            </Typography>
            <Box sx={{ height: 18, bgcolor: alpha(theme.palette.divider, 0.35), borderRadius: '2px', overflow: 'hidden' }}>
              <Box sx={{ width: `${widthPct}%`, height: '100%', bgcolor: alpha(color, 0.75) }} title={span.operation} />
            </Box>
            <Typography variant="caption2" sx={{ fontWeight: 700, color, textAlign: 'right' }}>{span.durationMs}ms</Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function IncidentCommandDrawer({ incident, services, errors = [], open, onClose }: IncidentCommandDrawerProps) {
  const theme = useTheme()
  const navigate = useNavigate()
  const token = resolveSessionToken(useAuthStore((s) => s.token))
  const {
    acknowledge,
    assign,
    resolve,
    escalate,
    getOwner,
    isAcknowledged,
    isResolved,
    isEscalated,
    pending,
  } = useIncidentPersistence()

  const traceQuery = useQuery({
    queryKey: [...queryKeys.platformIncidents(), 'trace', incident?.service ?? ''],
    queryFn: () => getTraceForService(token!, incident!.service),
    enabled: open && Boolean(incident?.service) && Boolean(token),
    staleTime: 15_000,
  })

  const timeline = useMemo(() => (incident ? buildTimeline(incident) : []), [incident])
  const rootCause = useMemo(() => (incident ? inferRootCause(incident, services) : ''), [incident, services])

  const remediation = useMemo(() => {
    if (!incident) return []
    const anomalies = detectAnomalies(services)
    const predictions = predictFailures({ services, anomalies })
    const rc = topRootCause({
      services,
      errors,
      incidents: [incident],
      anomalies,
    })
    return suggestRemediation({ incident, rootCause: rc, anomalies, predictions })
  }, [incident, services, errors])

  if (!incident) return null

  const color = severityColors[incident.severity]
  const owner = getOwner(incident.id) ?? incident.owner
  const ack = isAcknowledged(incident.id)
  const resolved = isResolved(incident.id)
  const escalated = isEscalated(incident.id)
  const svc = services.find((s) => s.name === incident.service)
  const trace = traceQuery.data
  const incidentMeta = { id: incident.id, title: incident.title, service: incident.service }

  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: 520, bgcolor: 'background.paper', borderLeft: `3px solid ${color}` } } }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: alpha(color, 0.06) }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0, pr: 1 }}>
            <Typography variant="caption2" sx={{ color: 'text.secondary' }}>Incident Command</Typography>
            <Typography variant="h3" sx={{ mt: 0.25 }}>{incident.title}</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
              <Chip label={incident.severity.toUpperCase()} size="small" sx={{ height: 22, fontSize: 10, fontWeight: 800, color, bgcolor: alpha(color, 0.15) }} />
              {escalated && <Chip label="ESCALATED" size="small" sx={{ height: 22, fontSize: 10, color: '#ef4444', bgcolor: alpha('#ef4444', 0.12) }} />}
              {resolved && <Chip label="RESOLVED" size="small" sx={{ height: 22, fontSize: 10, color: '#10b981', bgcolor: alpha('#10b981', 0.12) }} />}
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mt: 1.5 }}>
          <MiniStat label="Duration" value={formatDuration(incident.durationMinutes)} />
          <MiniStat label="Owner" value={owner ?? 'Unassigned'} />
          <MiniStat label="Affected" value={`${incident.affectedSystemsCount} svc`} />
        </Box>
      </Box>

      <Box sx={{ p: 2, display: 'grid', gap: 2, overflow: 'auto' }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: 13, mb: 1 }}>Timeline</Typography>
          {timeline.map((evt, i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: 1, pb: 1.25 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: i === timeline.length - 1 ? color : theme.palette.divider, mt: 0.5 }} />
              <Box>
                <Typography variant="caption2" sx={{ color: 'text.disabled' }}>{new Date(evt.time).toLocaleTimeString()}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{evt.label}</Typography>
                <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{evt.detail}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {trace?.spans?.length ? (
          <Box sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: '4px' }}>
            <Typography variant="h4" sx={{ fontSize: 13, mb: 0.75 }}>Distributed Trace Timeline</Typography>
            <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              {trace.traceId} · {trace.durationMs}ms total · {trace.status}
            </Typography>
            <TraceTimeline spans={trace.spans} />
          </Box>
        ) : null}

        <Box sx={{ p: 1.25, border: 1, borderColor: alpha(color, 0.3), borderRadius: '4px', bgcolor: alpha(color, 0.05) }}>
          <Typography variant="h4" sx={{ fontSize: 13, mb: 0.5 }}>Root Cause (heuristic)</Typography>
          <Typography variant="body2">{rootCause}</Typography>
        </Box>

        <Box>
          <Typography variant="h4" sx={{ fontSize: 13, mb: 1 }}>Correlated Signals</Typography>
          <SignalRow icon={<FileText size={14} />} label="Error logs" value={incident.source === 'logs' ? incident.value : '—'} color="#ef4444" />
          <SignalRow icon={<Zap size={14} />} label="Latency p95" value={svc?.p95 ? `${svc.p95}ms` : '—'} color="#f59e0b" />
          <SignalRow icon={<GitBranch size={14} />} label="Service status" value={svc?.status ?? 'unknown'} color={svc?.status === 'healthy' ? '#10b981' : '#ef4444'} />
        </Box>

        {remediation.length ? (
          <Box>
            <Typography variant="h4" sx={{ fontSize: 13, mb: 1 }}>Recommended Actions</Typography>
            {remediation.map((action) => (
              <Box key={action.id} sx={{ py: 0.6, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Chip label={action.priority} size="small" sx={{ height: 18, fontSize: 9, color: remediationPriorityColor(action.priority), bgcolor: alpha(remediationPriorityColor(action.priority), 0.12) }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{action.title}</Typography>
                </Box>
                <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, pl: 0.5 }}>
                  {action.description}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}

        <Divider />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" disabled={ack || resolved || pending} onClick={async () => {
            try {
              await acknowledge(incidentMeta)
              notify.success('Incident acknowledged')
            } catch {
              notify.error('Failed to acknowledge incident')
            }
          }}>
            Acknowledge
          </Button>
          <Button size="small" variant="outlined" startIcon={<UserPlus size={14} />} disabled={resolved || pending} onClick={async () => {
            try {
              await assign({ ...incidentMeta, assignee: 'You' })
              notify.success('Assigned to you')
            } catch {
              notify.error('Failed to assign incident')
            }
          }}>
            Assign
          </Button>
          <Button size="small" variant="outlined" startIcon={<CheckCircle2 size={14} />} disabled={resolved || pending} onClick={async () => {
            try {
              await resolve(incidentMeta)
              notify.success('Incident resolved')
            } catch {
              notify.error('Failed to resolve incident')
            }
          }}>
            Resolve
          </Button>
          <Button size="small" variant="contained" color="error" startIcon={<ArrowUpCircle size={14} />} disabled={escalated || resolved || pending} onClick={async () => {
            try {
              await escalate(incidentMeta)
              notify.warning('Incident escalated to on-call')
            } catch {
              notify.error('Failed to escalate incident')
            }
          }}>
            Escalate
          </Button>
          <Button size="small" variant="outlined" startIcon={<AlertTriangle size={14} />} sx={{ ml: 'auto' }} onClick={() => navigate(buildLogsUrl({ services: [incident.service], levels: ['ERROR'], severity: incident.severity === 'info' ? 'warning' : incident.severity }))}>
            Open Logs
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>{value}</Typography>
    </Box>
  )
}

function SignalRow({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
      <Box sx={{ color }}>{icon}</Box>
      <Typography variant="caption2" sx={{ color: 'text.secondary', flex: 1 }}>{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 600, color }}>{value}</Typography>
    </Box>
  )
}

export default memo(IncidentCommandDrawer)
