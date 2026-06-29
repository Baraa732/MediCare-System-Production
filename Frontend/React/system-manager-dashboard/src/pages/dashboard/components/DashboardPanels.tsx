import type { ReactNode } from 'react'
import { memo } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import { Box, Button, Chip, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  GitBranch,
  HeartPulse,
  Layers,
  MessageCircle,
  UserPlus,
  Zap,
} from 'lucide-react'
import type { ApmService, PlatformIntegration } from '../../../api/types'
import { useIncidentPersistence } from '../../../hooks/useIncidentPersistence'
import { buildLogsUrl } from '../../../store/logsFilterStore'
import { formatDuration, severityColors, statusColors, type DashboardIncident } from '../dashboardUtils'

export function Panel({ title, caption, children, fillHeight }: { title: string; caption?: string; children: ReactNode; fillHeight?: boolean }) {
  const theme = useTheme()
  return (
    <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '5px', height: fillHeight ? '100%' : undefined, overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography variant="h4">{title}</Typography>
          {caption && <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{caption}</Typography>}
        </Box>
      </Box>
      <Box sx={{ p: 1.25 }}>{children}</Box>
    </Box>
  )
}

export function SectionHeading({ title, caption }: { title: string; caption?: string }) {
  return (
    <Box sx={{ mb: 0.5 }}>
      <Typography variant="h4" sx={{ fontSize: 14, fontWeight: 600 }}>{title}</Typography>
      {caption && <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{caption}</Typography>}
    </Box>
  )
}

export function EmptyText({ children }: { children: ReactNode }) {
  return <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', p: 2, textAlign: 'center' }}>{children}</Typography>
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
      <Box sx={{ color: '#10b981', mb: 1 }}>{icon}</Box>
      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>{title}</Typography>
      <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{text}</Typography>
    </Box>
  )
}

export const ServiceHealthMatrix = memo(function ServiceHealthMatrix({ services }: { services: ApmService[] }) {
  const theme = useTheme()
  return (
    <Panel title="Service Health Matrix" caption="latency · error · traffic" fillHeight>
      <Box sx={{ display: 'grid', gap: 0.75 }}>
        {services.slice(0, 10).map((service) => {
          const color = service.status === 'healthy' ? '#10b981' : service.status === 'degraded' ? '#f59e0b' : '#ef4444'
          return (
            <Box key={service.name} sx={{ display: 'grid', gridTemplateColumns: '1fr 62px 62px 54px', gap: 1, alignItems: 'center', px: 1, height: 34, borderBottom: `1px solid ${theme.palette.divider}`, '&:hover': { bgcolor: 'background.hover' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color }} />
                <Typography variant="body2" sx={{ fontFamily: theme.typography.mono?.fontFamily, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{service.name}</Typography>
              </Box>
              <Typography variant="caption2" sx={{ color: 'text.secondary', textAlign: 'right' }}>{service.p95 ?? 0}ms</Typography>
              <Typography variant="caption2" sx={{ color: service.errorRate > 0 ? '#ef4444' : 'text.secondary', textAlign: 'right' }}>{service.errorRate}%</Typography>
              <Typography variant="caption2" sx={{ color: '#06b6d4', textAlign: 'right' }}>{service.reqRate}</Typography>
            </Box>
          )
        })}
        {services.length === 0 && <EmptyText>No service telemetry available yet.</EmptyText>}
      </Box>
    </Panel>
  )
})

const severityBadgeSx = (severity: DashboardIncident['severity'], acknowledged: boolean) => {
  const color = acknowledged ? '#8b93a8' : severityColors[severity]
  return {
    height: 22,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.06em',
    color,
    bgcolor: `${color}22`,
    border: `1px solid ${alpha(color, 0.45)}`,
    ...(severity === 'critical' && !acknowledged ? {
      boxShadow: `0 0 0 1px ${alpha(color, 0.35)}, 0 0 12px ${alpha(color, 0.25)}`,
      animation: 'pulse 2s ease-in-out infinite',
      '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.75 } },
    } : {}),
  }
}

export const IncidentPanel = memo(function IncidentPanel({ incidents, onSelectIncident }: { incidents: DashboardIncident[]; onSelectIncident?: (incident: DashboardIncident) => void }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const { acknowledge, assign, isAcknowledged, isResolved, getOwner, pending } = useIncidentPersistence()

  const visible = incidents.filter((i) => !isResolved(i.id))

  return (
    <Panel title="Active Incidents" caption="sorted by severity · blast radius · duration · click for war room">
      <Box sx={{ display: 'grid', gap: 1 }}>
        {visible.slice(0, 8).map((incident) => {
          const ack = isAcknowledged(incident.id)
          const owner = getOwner(incident.id) ?? incident.owner
          const isCritical = incident.severity === 'critical' && !ack
          const color = ack ? '#8b93a8' : severityColors[incident.severity]

          return (
            <Box
              key={incident.id}
              onClick={() => onSelectIncident?.(incident)}
              sx={{
                p: 1.25,
                borderRadius: '4px',
                border: `1px solid ${alpha(color, isCritical ? 0.55 : 0.28)}`,
                bgcolor: alpha(color, isCritical ? 0.12 : 0.06),
                borderLeft: `4px solid ${color}`,
                opacity: ack ? 0.72 : 1,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: isCritical ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {incident.title}
                  </Typography>
                  <Typography variant="caption2" sx={{ color: 'text.secondary', fontFamily: theme.typography.mono?.fontFamily }}>
                    {incident.service}
                  </Typography>
                </Box>
                <Chip label={incident.severity.toUpperCase()} size="small" sx={severityBadgeSx(incident.severity, ack)} />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75, mb: 1 }}>
                <Box>
                  <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block' }}>Duration</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{formatDuration(incident.durationMinutes)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block' }}>Owner</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner ?? 'Unassigned'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block' }}>Affected</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{incident.affectedSystemsCount} systems</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={ack || pending}
                  onClick={(e) => {
                    e.stopPropagation()
                    void acknowledge({ id: incident.id, title: incident.title, service: incident.service })
                  }}
                  sx={{ fontSize: 11, height: 26, minWidth: 0, px: 1 }}
                >
                  Acknowledge
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<UserPlus size={12} />}
                  onClick={(e) => {
                    e.stopPropagation()
                    void assign({ id: incident.id, title: incident.title, service: incident.service, assignee: 'You' })
                  }}
                  sx={{ fontSize: 11, height: 26, minWidth: 0, px: 1 }}
                >
                  Assign
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (incident.source === 'logs' || incident.errorType) {
                      navigate(buildLogsUrl({
                        services: [incident.service],
                        levels: incident.severity === 'warning' ? ['ERROR', 'WARN'] : ['ERROR'],
                        search: incident.errorType !== 'error_rate' && incident.errorType !== 'latency' && incident.errorType !== 'availability' && incident.errorType !== 'connectivity'
                          ? incident.errorType
                          : undefined,
                        severity: incident.severity === 'info' ? 'warning' : incident.severity,
                      }))
                    } else {
                      navigate('/alerts')
                    }
                  }}
                  sx={{ fontSize: 11, height: 26, minWidth: 0, px: 1.25, ml: 'auto' }}
                >
                  Open
                </Button>
              </Box>
            </Box>
          )
        })}
        {visible.length === 0 && <EmptyState icon={<CheckCircle2 size={24} />} title="No active incidents" text="Live alerts are clear in the current window." />}
      </Box>
    </Panel>
  )
})

export const IntegrationPanel = memo(function IntegrationPanel({ integrations }: { integrations: PlatformIntegration[] }) {
  const iconMap: Record<string, ReactNode> = {
    Prometheus: <Activity size={16} />,
    Grafana: <Layers size={16} />,
    OpenEMR: <HeartPulse size={16} />,
    'Evolution API': <MessageCircle size={16} />,
  }
  return (
    <Panel title="Integration Status" caption="live connection checks">
      <Box sx={{ display: 'grid', gap: 1 }}>
        {integrations.map((integration) => {
          const color = statusColors[integration.status as keyof typeof statusColors] ?? '#8b93a8'
          return (
            <Box key={integration.name} sx={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 1, alignItems: 'center', p: 1, border: 1, borderColor: 'divider', borderRadius: '4px', borderLeft: `3px solid ${color}` }}>
              <Box sx={{ color }}>{iconMap[integration.name] ?? <Zap size={16} />}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">{integration.name}</Typography>
                <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{integration.latencyMs !== null ? `${integration.latencyMs}ms` : 'no response'}</Typography>
              </Box>
              <Typography variant="caption2" sx={{ color, textTransform: 'capitalize' }}>{integration.status}</Typography>
            </Box>
          )
        })}
        {integrations.length === 0 && <EmptyText>No integration checks returned yet.</EmptyText>}
      </Box>
    </Panel>
  )
})

export const OperationsQueue = memo(function OperationsQueue({ incidents, slowTraceCount }: { incidents: DashboardIncident[]; slowTraceCount: number }) {
  const items = [
    { label: 'Triage live incidents', value: incidents.length, color: incidents.length ? '#ef4444' : '#10b981', icon: <AlertTriangle size={15} /> },
    { label: 'Review slow operations', value: slowTraceCount, color: '#f59e0b', icon: <GitBranch size={15} /> },
    { label: 'Verify integrations', value: incidents.filter((incident) => incident.source === 'integration').length, color: '#06b6d4', icon: <Database size={15} /> },
  ]
  return (
    <Panel title="Operations Queue" caption="next best actions">
      <Box sx={{ display: 'grid', gap: 1 }}>
        {items.map((item) => (
          <Box key={item.label} sx={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 1, alignItems: 'center', p: 1, border: `1px solid ${alpha(item.color, 0.25)}`, bgcolor: alpha(item.color, 0.06), borderRadius: '4px' }}>
            <Box sx={{ color: item.color }}>{item.icon}</Box>
            <Typography variant="body2">{item.label}</Typography>
            <Typography variant="metricSm" sx={{ color: item.color }}>{item.value}</Typography>
          </Box>
        ))}
      </Box>
    </Panel>
  )
})

export function TelemetryPlaceholder({ label }: { label?: string }) {
  return (
    <EmptyText>{label ?? 'Real telemetry coming in Phase 4'}</EmptyText>
  )
}
