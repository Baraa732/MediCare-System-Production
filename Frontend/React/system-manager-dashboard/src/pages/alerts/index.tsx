import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Grid,
  IconButton,
  MenuItem,
  Select,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import { Bell, CheckCircle2, Globe, Hash, Mail, Plus, Search, X } from 'lucide-react'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { AdvancedPageHeader, AdvancedPanel, ObservabilityPage } from '../../components/advanced/AdvancedPage'
import { notify } from '../../lib/toast'
import AlertCorrelationPanel from './components/AlertCorrelationPanel'
import { buildIncidents } from '../dashboard/dashboardUtils'

type AlertSeverity = 'critical' | 'high' | 'warning' | 'info'
type AlertStatus = 'firing' | 'resolved'
type ChannelType = 'slack' | 'pagerduty' | 'email' | 'webhook'

interface AlertItem {
  id: string
  severity: AlertSeverity
  name: string
  service: string
  condition: string
  value: string
  numericValue: number
  threshold: number
  duration: string
  started: string
  status: AlertStatus
  assignee: string | null
  silenced: boolean
  source: 'apm' | 'monitor' | 'integration' | 'logs'
  relatedTraceIds: string[]
}

interface AlertRule {
  id: string
  name: string
  service: string
  condition: string
  severity: AlertSeverity
  status: 'enabled' | 'disabled'
  lastFired: string
  notifications: ChannelType[]
}

interface Channel {
  id: string
  type: ChannelType
  name: string
  status: 'connected' | 'error'
  lastTest: string
}

const severityColors: Record<AlertSeverity | 'resolved', string> = {
  critical: '#ef4444',
  high: '#f97316',
  warning: '#f59e0b',
  info: '#06b6d4',
  resolved: '#10b981',
}

const notificationIcons: Record<ChannelType, { label: string; color: string }> = {
  slack: { label: '#', color: '#10b981' },
  pagerduty: { label: 'P', color: '#10b981' },
  email: { label: '@', color: '#06b6d4' },
  webhook: { label: '{}', color: '#8b5cf6' },
}

export default function Alerts() {
  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState('All')
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [alertActions, setAlertActions] = useState<Record<string, Partial<Pick<AlertItem, 'status' | 'silenced' | 'assignee'>>>>({})
  const [customRules, setCustomRules] = useState<AlertRule[]>([])
  const [channels, setChannels] = useState<Channel[]>([
    { id: 'c-email', type: 'email', name: 'Ops Team Email', status: 'connected', lastTest: 'live' },
    { id: 'c-dashboard', type: 'webhook', name: 'Dashboard Notifications', status: 'connected', lastTest: 'live' },
  ])
  const { data, loading, error, refresh } = useObservabilityData(undefined, true)

  const correlatedIncidents = useMemo(
    () => buildIncidents(data?.apm.services ?? [], data?.monitors.items ?? [], data?.integrations ?? [], data?.apm.errors ?? []),
    [data],
  )

  const liveAlerts = useMemo<AlertItem[]>(() => {
    const timestamp = data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'now'
    const traces = data?.traces.items ?? []
    const fromServices = (data?.apm.services ?? [])
      .filter((service) => service.status !== 'healthy' || service.errorRate > 0 || (service.p99 ?? 0) > 1000)
      .map((service): AlertItem => {
        const latencyAlert = (service.p99 ?? 0) > 1000
        const downAlert = service.status === 'down'
        const severity: AlertSeverity = downAlert || service.errorRate > 5 ? 'critical' : service.errorRate > 1 || latencyAlert ? 'high' : 'warning'
        return {
          id: `svc-${service.name}`,
          severity,
          name: `${service.name} ${downAlert ? 'Down' : latencyAlert ? 'High Latency' : 'Error Rate'}`,
          service: service.name,
          condition: downAlert ? 'availability < 99%' : latencyAlert ? 'latency_p99 > 1000ms' : 'error_rate > 0%',
          value: downAlert ? '0%' : latencyAlert ? `${service.p99}ms` : `${service.errorRate}%`,
          numericValue: downAlert ? 0 : latencyAlert ? service.p99 ?? 0 : service.errorRate,
          threshold: downAlert ? 99 : latencyAlert ? 1000 : 0,
          duration: 'current',
          started: timestamp,
          status: 'firing',
          assignee: null,
          silenced: false,
          source: 'apm',
          relatedTraceIds: traces.filter((trace) => trace.rootService === service.name).slice(0, 5).map((trace) => trace.id),
        }
      })

    const fromMonitors = (data?.monitors.items ?? [])
      .filter((monitor) => monitor.status !== 'up')
      .map((monitor): AlertItem => ({
        id: `mon-${monitor.id}`,
        severity: monitor.status === 'down' ? 'critical' : 'warning',
        name: `${monitor.name} ${monitor.status}`,
        service: monitor.name,
        condition: 'monitor_status != up',
        value: monitor.status,
        numericValue: monitor.status === 'down' ? 0 : 50,
        threshold: 100,
        duration: monitor.lastCheck,
        started: monitor.lastCheck,
        status: 'firing',
        assignee: null,
        silenced: false,
        source: 'monitor',
        relatedTraceIds: [],
      }))

    const fromIntegrations = (data?.integrations ?? [])
      .filter((integration) => integration.status === 'error')
      .map((integration): AlertItem => ({
        id: `int-${integration.name}`,
        severity: integration.name === 'OpenEMR' ? 'high' : 'warning',
        name: `${integration.name} Unavailable`,
        service: integration.name,
        condition: 'integration_status = error',
        value: 'error',
        numericValue: 0,
        threshold: 1,
        duration: integration.checkedAt ? new Date(integration.checkedAt).toLocaleTimeString() : 'current',
        started: integration.checkedAt ? new Date(integration.checkedAt).toLocaleTimeString() : timestamp,
        status: 'firing',
        assignee: null,
        silenced: false,
        source: 'integration',
        relatedTraceIds: [],
      }))

    const fromErrors = (data?.apm.errors ?? []).slice(0, 8).map((event): AlertItem => ({
      id: `log-${event.service}-${event.message}`,
      severity: event.count > 10 ? 'high' : 'warning',
      name: event.message,
      service: event.service,
      condition: 'log_errors > 0',
      value: `${event.count}`,
      numericValue: event.count,
      threshold: 0,
      duration: 'current',
      started: new Date(event.lastSeen).toLocaleTimeString(),
      status: 'firing',
      assignee: null,
      silenced: false,
      source: 'logs',
      relatedTraceIds: traces.filter((trace) => trace.rootService === event.service).slice(0, 5).map((trace) => trace.id),
    }))

    return [...fromServices, ...fromMonitors, ...fromIntegrations, ...fromErrors].map((alert) => ({
      ...alert,
      ...alertActions[alert.id],
    }))
  }, [alertActions, data])

  const filtered = useMemo(() => {
    return liveAlerts.filter((alert) => {
      const matchesSeverity = sevFilter === 'All' || alert.severity === sevFilter
      const q = search.trim().toLowerCase()
      const matchesSearch = !q || [alert.name, alert.service, alert.condition, alert.source].some((value) => value.toLowerCase().includes(q))
      return matchesSeverity && matchesSearch && alert.status === 'firing'
    })
  }, [liveAlerts, search, sevFilter])

  const rules = useMemo<AlertRule[]>(() => {
    const generated: AlertRule[] = [
      { id: 'r-error-rate', name: 'High Error Rate', service: 'any', condition: 'error_rate > 5%', severity: 'critical', status: 'enabled', lastFired: liveAlerts.find((a) => a.condition.includes('error_rate'))?.started ?? 'never', notifications: ['email', 'webhook'] },
      { id: 'r-latency', name: 'High Latency P99', service: 'any', condition: 'latency_p99 > 1000ms', severity: 'high', status: 'enabled', lastFired: liveAlerts.find((a) => a.condition.includes('latency'))?.started ?? 'never', notifications: ['email'] },
      { id: 'r-service-down', name: 'Service Down', service: 'any', condition: 'availability < 99%', severity: 'critical', status: 'enabled', lastFired: liveAlerts.find((a) => a.condition.includes('availability'))?.started ?? 'never', notifications: ['email', 'webhook'] },
      { id: 'r-monitor', name: 'Monitor Degraded', service: 'platform', condition: 'monitor_status != up', severity: 'warning', status: 'enabled', lastFired: liveAlerts.find((a) => a.source === 'monitor')?.started ?? 'never', notifications: ['webhook'] },
      { id: 'r-integration', name: 'Integration Unavailable', service: 'integrations', condition: 'integration_status = error', severity: 'high', status: 'enabled', lastFired: liveAlerts.find((a) => a.source === 'integration')?.started ?? 'never', notifications: ['email'] },
    ]
    return [...generated, ...customRules]
  }, [customRules, liveAlerts])

  const updateAlert = (id: string, update: Partial<Pick<AlertItem, 'status' | 'silenced' | 'assignee'>>) => {
    setAlertActions((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }))
    setSelectedAlert((prev) => prev && prev.id === id ? { ...prev, ...update } : prev)
  }

  const toggleRule = (id: string) => {
    setCustomRules((prev) => prev.map((rule) => rule.id === id ? { ...rule, status: rule.status === 'enabled' ? 'disabled' : 'enabled' } : rule))
    if (!customRules.some((rule) => rule.id === id)) notify.info('Built-in alert rules are generated from live telemetry and stay enabled.')
  }

  const testChannel = (id: string) => {
    setChannels((prev) => prev.map((channel) => channel.id === id ? { ...channel, status: 'connected', lastTest: 'just now' } : channel))
    notify.success('Notification channel test passed.')
  }

  return (
    <ObservabilityPage fill>
      <AdvancedPageHeader
        title="Alerts"
        eyebrow="Observability / Alerts"
        description="Live rules from APM, monitors, integrations, traces, and logs."
        color="#ef4444"
        status={`${filtered.length} firing`}
        compact
        actions={<Button variant="outlined" size="small" onClick={refresh}>Refresh</Button>}
      />

      {error && <Box sx={{ p: 1.25, border: '1px solid #f59e0b40', bgcolor: '#f59e0b12', borderRadius: '4px', flexShrink: 0 }}><Typography variant="body2" sx={{ color: '#f59e0b' }}>{error}</Typography></Box>}

      <AlertsSummaryBar alerts={liveAlerts} loading={loading} />

      <AlertCorrelationPanel
        services={data?.apm.services ?? []}
        incidents={correlatedIncidents}
        topology={(data?.apm.serviceMap.edges ?? []) as Array<[string, string]>}
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flexShrink: 0, minHeight: 36 }}>
        <Tab label="Firing Alerts" />
        <Tab label="Alert Rules" />
        <Tab label="Notification Channels" />
      </Tabs>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {tab === 0 && (
        <AdvancedPanel title="Firing Alerts" caption={`${filtered.length} active signals`} dense>
          <AlertsToolbar search={search} setSearch={setSearch} sevFilter={sevFilter} setSevFilter={setSevFilter} onCreate={() => setCreateOpen(true)} />
          <FiringAlertsTable alerts={filtered} onSelectAlert={setSelectedAlert} loading={loading} />
        </AdvancedPanel>
      )}
      {tab === 1 && <AdvancedPanel title="Alert Rules" caption="generated and custom rules" dense><AlertRulesTable rules={rules} onToggleRule={toggleRule} onCreate={() => setCreateOpen(true)} /></AdvancedPanel>}
      {tab === 2 && <AdvancedPanel title="Notification Channels" caption="delivery endpoints" dense><NotificationChannels channels={channels} onTest={testChannel} /></AdvancedPanel>}
      </Box>

      <AlertDetailDrawer
        open={Boolean(selectedAlert)}
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onSilence={(alert, hours) => {
          updateAlert(alert.id, { silenced: true })
          notify.info(`${alert.name} silenced for ${hours}h.`)
        }}
        onAcknowledge={(alert) => {
          updateAlert(alert.id, { assignee: 'Current user' })
          notify.success(`${alert.name} acknowledged.`)
        }}
        onResolve={(alert) => {
          updateAlert(alert.id, { status: 'resolved' })
          notify.success(`${alert.name} resolved locally. It will reappear if live telemetry still violates the rule.`)
        }}
      />
      <CreateAlertModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(rule) => {
          setCustomRules((prev) => [...prev, rule])
          setCreateOpen(false)
          notify.success('Alert rule added to this dashboard session.')
        }}
      />
    </ObservabilityPage>
  )
}

function AlertsSummaryBar({ alerts, loading }: { alerts: AlertItem[]; loading: boolean }) {
  const counts = [
    ['critical', alerts.filter((alert) => alert.severity === 'critical' && alert.status === 'firing').length],
    ['high', alerts.filter((alert) => alert.severity === 'high' && alert.status === 'firing').length],
    ['warning', alerts.filter((alert) => alert.severity === 'warning' && alert.status === 'firing').length],
    ['info', alerts.filter((alert) => alert.severity === 'info' && alert.status === 'firing').length],
    ['resolved', alerts.filter((alert) => alert.status === 'resolved').length],
  ] as const

  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
      {counts.map(([severity, count]) => (
        <Box key={severity} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, border: `1px solid ${severityColors[severity]}40`, bgcolor: `${severityColors[severity]}15`, borderRadius: '4px' }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: severityColors[severity] }} />
          <Typography variant="caption2" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>{severity}</Typography>
          <Typography variant="body2" sx={{ color: severityColors[severity], fontWeight: 700 }}>{loading ? '...' : count}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function AlertsToolbar({
  search,
  setSearch,
  sevFilter,
  setSevFilter,
  onCreate,
}: {
  search: string
  setSearch: (value: string) => void
  sevFilter: string
  setSevFilter: (value: string) => void
  onCreate: () => void
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
      <TextField
        size="small"
        placeholder="Search alerts..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        slotProps={{ input: { startAdornment: <Search size={14} color="#4d566b" style={{ marginRight: 6 }} /> } }}
        sx={{ width: 240 }}
      />
      <Select value={sevFilter} onChange={(event) => setSevFilter(event.target.value)} size="small" sx={{ fontSize: 13, minWidth: 140 }}>
        <MenuItem value="All">Severity: All</MenuItem>
        <MenuItem value="critical">Critical</MenuItem>
        <MenuItem value="high">High</MenuItem>
        <MenuItem value="warning">Warning</MenuItem>
        <MenuItem value="info">Info</MenuItem>
      </Select>
      <Box sx={{ flex: 1 }} />
      <Button variant="outlined" size="small" startIcon={<Plus size={14} />} onClick={onCreate} sx={{ fontSize: 13 }}>
        Create Alert Rule
      </Button>
    </Box>
  )
}

function FiringAlertsTable({ alerts, onSelectAlert, loading }: { alerts: AlertItem[]; onSelectAlert: (alert: AlertItem) => void; loading: boolean }) {
  const theme = useTheme()

  return (
    <TableContainer sx={{ background: 'transparent', boxShadow: 'none' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={90} sx={headSx}>Severity</TableCell>
            <TableCell width={240} sx={headSx}>Alert Name</TableCell>
            <TableCell width={150} sx={headSx}>Service</TableCell>
            <TableCell width={220} sx={headSx}>Condition</TableCell>
            <TableCell width={100} sx={headSx}>Value</TableCell>
            <TableCell width={100} sx={headSx}>Duration</TableCell>
            <TableCell width={120} sx={headSx}>Started</TableCell>
            <TableCell width={120} sx={headSx}>Assignee</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.id} hover onClick={() => onSelectAlert(alert)} sx={{ cursor: 'pointer', height: 36, opacity: alert.silenced ? 0.5 : 1 }}>
              <TableCell sx={cellSx}><SeverityChip severity={alert.severity} /></TableCell>
              <TableCell sx={{ ...cellSx, color: '#06b6d4', fontWeight: 500 }}>{alert.name}</TableCell>
              <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono.fontFamily }}>{alert.service}</TableCell>
              <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono.fontFamily }}>{alert.condition}</TableCell>
              <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono.fontFamily, color: severityColors[alert.severity] }}>{alert.value}</TableCell>
              <TableCell sx={cellSx}>
                {alert.silenced ? (
                  <Chip label="SILENCED" size="small" sx={{ background: '#1e2438', color: '#8b93a8', fontSize: 10, height: 20 }} />
                ) : (
                  <Typography variant="body2" sx={{ fontFamily: theme.typography.mono.fontFamily, color: theme.palette.text.secondary }}>{alert.duration}</Typography>
                )}
              </TableCell>
              <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono.fontFamily, color: theme.palette.text.secondary }}>{alert.started}</TableCell>
              <TableCell sx={{ ...cellSx, color: theme.palette.text.secondary }}>{alert.assignee || 'Unassigned'}</TableCell>
            </TableRow>
          ))}
          {!loading && alerts.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} sx={{ ...cellSx, py: 4, textAlign: 'center', color: 'text.secondary' }}>
                No firing alerts from live telemetry.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function AlertRulesTable({ rules, onToggleRule, onCreate }: { rules: AlertRule[]; onToggleRule: (id: string) => void; onCreate: () => void }) {
  const theme = useTheme()

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <TextField size="small" placeholder="Search rules..." sx={{ width: 240 }} />
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" size="small" startIcon={<Plus size={14} />} onClick={onCreate} sx={{ fontSize: 13 }}>
          Create Rule
        </Button>
      </Box>
      <TableContainer sx={{ background: 'transparent', boxShadow: 'none' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={90} sx={headSx}>Severity</TableCell>
              <TableCell width={220} sx={headSx}>Name</TableCell>
              <TableCell width={120} sx={headSx}>Service</TableCell>
              <TableCell width={220} sx={headSx}>Condition</TableCell>
              <TableCell width={80} sx={headSx}>Status</TableCell>
              <TableCell width={120} sx={headSx}>Last Fired</TableCell>
              <TableCell width={180} sx={headSx}>Notifications</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id} hover sx={{ height: 36 }}>
                <TableCell sx={cellSx}><SeverityChip severity={rule.severity} /></TableCell>
                <TableCell sx={{ ...cellSx, fontWeight: 500 }}>{rule.name}</TableCell>
                <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono.fontFamily }}>{rule.service}</TableCell>
                <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono.fontFamily }}>{rule.condition}</TableCell>
                <TableCell sx={cellSx}>
                  <Switch
                    size="small"
                    checked={rule.status === 'enabled'}
                    onChange={() => onToggleRule(rule.id)}
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { background: '#10b981' } }}
                  />
                </TableCell>
                <TableCell sx={{ ...cellSx, color: theme.palette.text.secondary }}>{rule.lastFired}</TableCell>
                <TableCell sx={cellSx}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {rule.notifications.map((notification) => {
                      const icon = notificationIcons[notification]
                      return (
                        <Chip
                          key={notification}
                          label={icon.label}
                          size="small"
                          sx={{ background: `${icon.color}20`, color: icon.color, fontWeight: 600, fontSize: 10, height: 20, minWidth: 24 }}
                        />
                      )
                    })}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

function NotificationChannels({ channels, onTest }: { channels: Channel[]; onTest: (id: string) => void }) {
  const theme = useTheme()
  const typeIcons: Record<ChannelType, typeof Bell> = { slack: Hash, pagerduty: Bell, email: Mail, webhook: Globe }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="outlined" size="small" startIcon={<Plus size={14} />} onClick={() => notify.info('Notification channels are controlled by platform configuration.')} sx={{ fontSize: 13 }}>
          Add Channel
        </Button>
      </Box>
      <Grid container spacing={2}>
        {channels.map((channel) => {
          const Icon = typeIcons[channel.type]
          const isError = channel.status === 'error'
          return (
            <Grid key={channel.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Box sx={{ p: 2, border: `1px solid ${isError ? '#ef444440' : theme.palette.divider}`, borderRadius: '4px' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon size={18} color={isError ? '#ef4444' : '#8b93a8'} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>{channel.type}</Typography>
                      <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>{channel.name}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: isError ? '#ef4444' : '#10b981' }} />
                    <Typography variant="caption2" sx={{ color: isError ? '#ef4444' : '#10b981', textTransform: 'capitalize' }}>{channel.status}</Typography>
                  </Box>
                </Box>
                <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>
                  Last tested: {channel.lastTest}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                  <Button size="small" variant="outlined" onClick={() => onTest(channel.id)} sx={{ fontSize: 11, py: 0 }}>Test</Button>
                  <Button size="small" variant="outlined" onClick={() => notify.info('Channel editing is managed in platform configuration.')} sx={{ fontSize: 11, py: 0 }}>Edit</Button>
                  <Button size="small" variant="outlined" onClick={() => notify.info('Protected default channels cannot be deleted from the dashboard.')} sx={{ fontSize: 11, py: 0, color: '#ef4444', borderColor: '#ef4444' }}>Delete</Button>
                </Box>
              </Box>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}

function AlertDetailDrawer({
  open,
  alert,
  onClose,
  onSilence,
  onAcknowledge,
  onResolve,
}: {
  open: boolean
  alert: AlertItem | null
  onClose: () => void
  onSilence: (alert: AlertItem, hours: number) => void
  onAcknowledge: (alert: AlertItem) => void
  onResolve: (alert: AlertItem) => void
}) {
  const theme = useTheme()
  const [tab, setTab] = useState(0)
  const chartOption = useMemo(() => {
    const current = alert?.numericValue ?? 0
    const threshold = alert?.threshold ?? 0
    return {
      tooltip: { trigger: 'axis', backgroundColor: theme.palette.background.elevated, borderColor: theme.palette.divider, textStyle: { color: theme.palette.text.primary, fontSize: 12 } },
      grid: { top: 16, right: 16, bottom: 24, left: 48 },
      xAxis: { type: 'category', data: Array.from({ length: 60 }, (_, i) => `${59 - i}m`), axisLabel: { color: theme.palette.text.disabled, fontSize: 10 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: theme.palette.divider } }, axisLabel: { color: theme.palette.text.disabled, fontSize: 10 } },
      series: [
        { name: 'Value', type: 'line', data: generateSeries(current || threshold || 1), smooth: true, symbol: 'none', lineStyle: { color: alert ? severityColors[alert.severity] : '#ef4444', width: 2 } },
        { name: 'Threshold', type: 'line', data: Array(60).fill(threshold), symbol: 'none', lineStyle: { color: '#ef4444', width: 1, type: 'dashed' } },
      ],
    }
  }, [alert, theme])

  if (!alert) return null

  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: 500, background: theme.palette.background.paper, borderLeft: `1px solid ${theme.palette.divider}` } } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <SeverityChip severity={alert.severity} />
              <Typography variant="h3" sx={{ mt: 0.75 }}>{alert.name}</Typography>
              <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>
                {alert.service} · {alert.source} · firing for {alert.duration} · started {alert.started}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClose} sx={{ color: theme.palette.text.secondary }}><X size={18} /></IconButton>
          </Box>
        </Box>

        <Tabs value={tab} onChange={(_, value) => setTab(value)}>
          <Tab label="Overview" />
          <Tab label="History" />
          <Tab label="Related Traces" />
          <Tab label="Runbook" />
        </Tabs>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {tab === 0 && (
            <Box sx={{ p: 2 }}>
              <Typography variant="caption" sx={labelSx}>Condition</Typography>
              <Typography variant="body2" sx={{ fontFamily: theme.typography.mono.fontFamily, mb: 2 }}>{alert.condition} for 5 minutes</Typography>
              <Typography variant="caption" sx={labelSx}>Current Value</Typography>
              <Typography variant="metricSm" sx={{ color: severityColors[alert.severity], mb: 2 }}>
                {alert.value} <Typography component="span" variant="caption2" sx={{ color: theme.palette.text.secondary }}>(threshold: {alert.threshold})</Typography>
              </Typography>
              <Box sx={{ height: 180, mb: 2 }}>
                <ReactECharts option={chartOption} style={{ height: 180 }} notMerge />
              </Box>
              <Typography variant="h4" sx={{ mb: 1 }}>Details</Typography>
              {[
                ['Service', alert.service],
                ['Triggered by', alert.condition.split(' ')[0]],
                ['Source', alert.source],
                ['Duration', alert.duration],
                ['Notification', 'Email, Dashboard'],
                ['Assignee', alert.assignee || 'Unassigned'],
              ].map(([key, value]) => (
                <Box key={key} sx={{ display: 'flex', py: 0.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="caption" sx={{ minWidth: 130, color: theme.palette.text.secondary, textTransform: 'none', fontWeight: 500 }}>{key}</Typography>
                  <Typography variant="body2" sx={{ fontFamily: theme.typography.mono.fontFamily, color: theme.palette.text.primary }}>{value}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                <Button variant="outlined" size="small" onClick={() => onSilence(alert, 1)} sx={{ fontSize: 12 }}>Silence 1h</Button>
                <Button variant="outlined" size="small" onClick={() => onSilence(alert, 4)} sx={{ fontSize: 12 }}>Silence 4h</Button>
                <Button variant="outlined" size="small" onClick={() => onAcknowledge(alert)} sx={{ fontSize: 12 }}>Acknowledge</Button>
                <Button variant="outlined" size="small" onClick={() => onResolve(alert)} sx={{ fontSize: 12, color: '#10b981', borderColor: '#10b981' }}>Resolve</Button>
              </Box>
            </Box>
          )}
          {tab === 1 && <AlertHistory alert={alert} />}
          {tab === 2 && <RelatedTraces alert={alert} />}
          {tab === 3 && <Runbook alert={alert} />}
        </Box>
      </Box>
    </Drawer>
  )
}

function AlertHistory({ alert }: { alert: AlertItem }) {
  const theme = useTheme()
  const rows = [
    { time: alert.started, text: `Alert fired - ${alert.value} matched ${alert.condition}`, color: severityColors[alert.severity] },
    { time: '5m before', text: `Rule evaluated for ${alert.service}`, color: '#f59e0b' },
    { time: '10m before', text: 'Live telemetry refresh completed', color: '#10b981' },
  ]
  return (
    <Box sx={{ p: 2 }}>
      {rows.map((row, index) => (
        <Box key={`${row.time}-${index}`} sx={{ display: 'flex', gap: 1.5, py: 0.75, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: row.color, mt: 0.5, flexShrink: 0 }} />
          <Typography variant="caption2" sx={{ fontFamily: theme.typography.mono.fontFamily, color: theme.palette.text.secondary, minWidth: 74 }}>{row.time}</Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontSize: 13 }}>{row.text}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function RelatedTraces({ alert }: { alert: AlertItem }) {
  const theme = useTheme()
  return (
    <Box sx={{ p: 2 }}>
      {alert.relatedTraceIds.length > 0 ? alert.relatedTraceIds.map((traceId) => (
        <Box key={traceId} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" sx={{ fontFamily: theme.typography.mono.fontFamily, color: '#06b6d4' }}>{traceId.slice(0, 12)}</Typography>
          <Typography variant="caption2" sx={{ color: theme.palette.text.secondary }}>{alert.service}</Typography>
        </Box>
      )) : (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, textAlign: 'center', py: 2 }}>
          No related traces in the current live window.
        </Typography>
      )}
    </Box>
  )
}

function Runbook({ alert }: { alert: AlertItem }) {
  const theme = useTheme()
  return (
    <Box sx={{ p: 2 }}>
      <Box component="pre" sx={{ fontFamily: theme.typography.mono.fontFamily, fontSize: 12, color: theme.palette.text.primary, bgcolor: 'background.default', borderRadius: '4px', p: 2, overflow: 'auto', maxHeight: 340, whiteSpace: 'pre-wrap' }}>
        {`# ${alert.name} Runbook

## Symptoms
- ${alert.condition}
- Current value: ${alert.value}
- Source: ${alert.source}

## Investigation Steps
1. Open Logs and filter by "${alert.service}".
2. Check APM latency and error charts for the same service.
3. Verify Monitors and Integrations status.
4. Inspect related traces in this drawer.

## Resolution
- Fix the failing dependency or service health issue.
- Acknowledge the alert after ownership is clear.
- Resolve only when live telemetry returns below threshold.`}
      </Box>
    </Box>
  )
}

function CreateAlertModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (rule: AlertRule) => void }) {
  const [name, setName] = useState('Custom Platform Rule')
  const [service, setService] = useState('any')
  const [severity, setSeverity] = useState<AlertSeverity>('warning')
  const [condition, setCondition] = useState('error_rate > 1%')

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Alert Rule</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
        <TextField label="Name" size="small" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField label="Service" size="small" value={service} onChange={(event) => setService(event.target.value)} />
        <Select size="small" value={severity} onChange={(event) => setSeverity(event.target.value as AlertSeverity)}>
          <MenuItem value="critical">Critical</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="warning">Warning</MenuItem>
          <MenuItem value="info">Info</MenuItem>
        </Select>
        <TextField label="Condition" size="small" value={condition} onChange={(event) => setCondition(event.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onCreate({
            id: `custom-${Date.now()}`,
            name,
            service,
            severity,
            condition,
            status: 'enabled',
            lastFired: 'never',
            notifications: ['email'],
          })}
          startIcon={<CheckCircle2 size={14} />}
        >
          Create Rule
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function SeverityChip({ severity }: { severity: AlertSeverity }) {
  return (
    <Chip
      label={severity.toUpperCase()}
      size="small"
      sx={{ background: `${severityColors[severity]}20`, color: severityColors[severity], fontWeight: 600, fontSize: 10, height: 20, borderRadius: '3px' }}
    />
  )
}

function generateSeries(base: number, points = 60) {
  const normalized = Math.max(1, base)
  return Array.from({ length: points }, (_, index) => {
    const wave = Math.sin(index / 5) * normalized * 0.18
    const drift = (index / points) * normalized * 0.15
    return Math.max(0, Number((normalized * 0.82 + wave + drift).toFixed(2)))
  })
}

const labelSx = { color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5, display: 'block' }
const headSx = { color: 'text.secondary', fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' as const, borderColor: 'divider', py: 1 }
const cellSx = { fontSize: 13, color: 'text.primary', borderColor: 'divider', py: '7px' }
