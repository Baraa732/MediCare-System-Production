import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { Pause, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import type { PlatformMonitor } from '../../api/types'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { AdvancedPageHeader, AdvancedPanel, ObservabilityPage } from '../../components/advanced/AdvancedPage'
import { notify } from '../../lib/toast'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

export default function Monitors() {
  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedMonitor, setSelectedMonitor] = useState<PlatformMonitor | null>(null)
  const { data, loading, error } = useObservabilityData('1h', true)

  const monitors = data?.monitors.items ?? []
  const filteredMonitors = useMemo(() => monitors.filter((monitor) => {
    const matchesSearch = monitor.name.toLowerCase().includes(search.toLowerCase()) || monitor.url.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || monitor.type === typeFilter
    const matchesStatus = statusFilter === 'all' || monitor.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  }), [monitors, search, statusFilter, typeFilter])

  const counts = {
    up: filteredMonitors.filter((m) => m.status === 'up').length,
    down: filteredMonitors.filter((m) => m.status === 'down').length,
    degraded: filteredMonitors.filter((m) => m.status === 'degraded').length,
  }

  const statusServices = data?.monitors.statusPage ?? []
  const overallStatus = useMemo(() => {
    const hasOutage = statusServices.some((s) => s.status === 'outage')
    const hasDegraded = monitors.some((m) => m.status === 'degraded')
    if (hasOutage) return { label: 'Major Outage', color: '#ef4444' }
    if (hasDegraded) return { label: 'Partial Degradation', color: '#f59e0b' }
    return { label: 'All Systems Operational', color: '#10b981' }
  }, [monitors, statusServices])

  const recentIncidents = useMemo(() => monitors
    .filter((monitor) => monitor.status !== 'up')
    .slice(0, 3)
    .map((monitor) => ({
      id: monitor.id,
      title: `${monitor.name} is ${monitor.status}`,
      severity: monitor.status === 'down' ? 'critical' : 'high',
      status: monitor.status === 'down' ? 'ongoing' : 'investigating',
      startedAt: monitor.lastCheck,
      affectedServices: [monitor.name],
    })), [monitors])

  const openMonitor = (monitor: PlatformMonitor) => {
    setSelectedMonitor(monitor)
    setDrawerOpen(true)
  }

  return (
    <ObservabilityPage fill>
      <AdvancedPageHeader
        title="Synthetics"
        eyebrow="Observability / Monitors"
        description="HTTP/TCP checks, status page, and uptime history."
        color="#10b981"
        status={overallStatus.label}
        compact
      />

      {error && <Alert severity="error" sx={{ flexShrink: 0 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ flexShrink: 0, minHeight: 36 }}>
        <Tab label="Monitors" />
        <Tab label="Status Page" />
      </Tabs>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {tab === 0 && (
        <AdvancedPanel title="Monitors" caption={`${filteredMonitors.length} checks`} dense>
        <Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            {Object.entries(counts).map(([key, count]) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5, background: `${statusColor(key)}15`, border: `1px solid ${statusColor(key)}40`, borderRadius: '4px' }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(key) }} />
                <Typography variant="caption2" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>{key}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: statusColor(key) }}>{count}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search monitors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <Search size={14} color="#8b93a8" style={{ marginRight: 6 }} /> } }}
              sx={{ width: 280 }}
            />
            <Select size="small" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} sx={{ fontSize: 13, minWidth: 130 }}>
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="HTTP">HTTP</MenuItem>
              <MenuItem value="TCP">TCP</MenuItem>
              <MenuItem value="SSL">SSL</MenuItem>
              <MenuItem value="DNS">DNS</MenuItem>
              <MenuItem value="Journey">Journey</MenuItem>
            </Select>
            <Select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ fontSize: 13, minWidth: 130 }}>
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="up">Up</MenuItem>
              <MenuItem value="degraded">Degraded</MenuItem>
              <MenuItem value="down">Down</MenuItem>
            </Select>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" size="small" startIcon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              Create Monitor
            </Button>
          </Box>

          {loading && monitors.length === 0 ? (
            <Skeleton variant="rounded" height={260} />
          ) : (
            <MonitorTable
              monitors={filteredMonitors}
              onSelect={openMonitor}
              onEdit={(monitor) => { setSelectedMonitor(monitor); setCreateOpen(true) }}
            />
          )}
        </Box>
        </AdvancedPanel>
      )}

      {tab === 1 && (
        <AdvancedPanel title="Status Page" caption="platform availability snapshot" dense>
        <Box>
          <Box sx={{ p: 2, mb: 2, border: 1, borderColor: 'divider', borderRadius: '4px', textAlign: 'center' }}>
            <Typography variant="h2" sx={{ mb: 1 }}>MediCare Platform Status</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>Live status of MediCare services and infrastructure</Typography>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 2, py: 0.5, borderRadius: '20px', background: `${overallStatus.color}15`, border: `1px solid ${overallStatus.color}40` }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: overallStatus.color }} />
              <Typography variant="body2" sx={{ fontWeight: 500, color: overallStatus.color }}>{overallStatus.label}</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', mt: 1, display: 'block' }}>Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'just now'}</Typography>
          </Box>

          <Typography variant="h4" sx={{ mb: 2 }}>Services</Typography>
          {statusServices.map((svc) => (
            <Box key={svc.name} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: svc.status === 'operational' ? '#10b981' : '#ef4444' }} />
              <Typography variant="body2">{svc.name}</Typography>
              <Typography variant="caption2" sx={{ color: svc.status === 'operational' ? '#10b981' : '#ef4444', ml: 'auto' }}>
                {svc.status === 'operational' ? 'Operational' : 'Major Outage'}
              </Typography>
            </Box>
          ))}

          <Box sx={{ mt: 4 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>Recent Incidents</Typography>
            {recentIncidents.length === 0 ? (
              <Typography variant="caption2" sx={{ color: 'text.secondary' }}>No active incidents in the current status snapshot.</Typography>
            ) : recentIncidents.map((inc) => (
              <Box key={inc.id} sx={{ borderLeft: `3px solid ${inc.severity === 'critical' ? '#ef4444' : '#f59e0b'}`, pl: 2, py: 1, mb: 1, bgcolor: 'background.paper', borderRadius: '0 4px 4px 0', border: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{inc.title}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{inc.startedAt}</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {inc.status === 'resolved' ? 'Resolved' : 'Ongoing'} &bull; {inc.affectedServices.join(', ')}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ mt: 4 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>Current Uptime Snapshot</Typography>
            <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
              Historical 90-day uptime requires persistent monitor telemetry. Showing live check status only.
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {monitors.map((monitor) => (
                <Tooltip key={monitor.id} title={`${monitor.name}: ${monitor.status} · ${monitor.availability ?? 100}%`} arrow>
                  <Box sx={{ width: 14, height: 14, borderRadius: '2px', background: monitor.status === 'up' ? '#10b981' : monitor.status === 'degraded' ? '#f59e0b' : '#ef4444', cursor: 'pointer', '&:hover': { opacity: 0.8, transform: 'scale(1.2)' }, transition: 'transform 0.1s' }} />
                </Tooltip>
              ))}
              {monitors.length === 0 && (
                <Typography variant="caption2" sx={{ color: 'text.secondary' }}>No monitors configured.</Typography>
              )}
            </Box>
          </Box>
        </Box>
        </AdvancedPanel>
      )}
      </Box>

      <CreateMonitorModal
        open={createOpen}
        monitor={selectedMonitor}
        onClose={() => { setCreateOpen(false); setSelectedMonitor(null) }}
      />
      <MonitorDetailDrawer
        monitor={selectedMonitor}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedMonitor(null) }}
      />
    </ObservabilityPage>
  )
}

function MonitorTable({
  monitors,
  onSelect,
  onEdit,
}: {
  monitors: PlatformMonitor[]
  onSelect: (monitor: PlatformMonitor) => void
  onEdit: (monitor: PlatformMonitor) => void
}) {
  const theme = useTheme()
  return (
    <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={32} sx={headSx} />
            <TableCell width={200} sx={headSx}>Name</TableCell>
            <TableCell width={240} sx={headSx}>URL</TableCell>
            <TableCell width={90} sx={headSx}>Type</TableCell>
            <TableCell width={120} sx={headSx}>Availability</TableCell>
            <TableCell width={120} sx={headSx}>Avg Duration</TableCell>
            <TableCell width={100} sx={headSx}>Last Check</TableCell>
            <TableCell width={90} sx={headSx}>Frequency</TableCell>
            <TableCell width={100} align="right" sx={headSx}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {monitors.map((monitor) => (
            <TableRow key={monitor.id} hover onClick={() => onSelect(monitor)} sx={{ cursor: 'pointer', height: 36 }}>
              <TableCell sx={cellSx}><Box sx={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(monitor.status) }} /></TableCell>
              <TableCell sx={{ ...cellSx, fontWeight: 500 }}>{monitor.name}</TableCell>
              <TableCell sx={{ ...cellSx, width: 240, maxWidth: 240 }}>
                <Tooltip title={monitor.url}>
                  <Typography sx={{ fontFamily: theme.typography.mono?.fontFamily, color: 'text.secondary', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                    {monitor.url}
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell sx={cellSx}>
                <Chip label={monitor.type} size="small" sx={{ background: '#1e2438', color: 'text.secondary', fontSize: 10, height: 20 }} />
              </TableCell>
              <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono?.fontFamily, color: monitor.availability < 98 ? '#ef4444' : '#10b981' }}>{monitor.availability}%</TableCell>
              <TableCell sx={{ ...cellSx, fontFamily: theme.typography.mono?.fontFamily }}>{monitor.avgDuration !== null ? `${monitor.avgDuration}ms` : '—'}</TableCell>
              <TableCell sx={{ ...cellSx, color: 'text.secondary' }}>{monitor.lastCheck}</TableCell>
              <TableCell sx={{ ...cellSx, color: 'text.secondary' }}>{monitor.frequency}</TableCell>
              <TableCell align="right" sx={cellSx}>
                <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', opacity: 0, '.MuiTableRow-root:hover &': { opacity: 1 } }}>
                  <Tooltip title="Pause monitor"><IconButton size="small" onClick={() => notify.info('Platform monitors are managed by backend health probes.')}><Pause size={14} /></IconButton></Tooltip>
                  <Tooltip title="Edit monitor"><IconButton size="small" onClick={() => onEdit(monitor)}><Pencil size={14} /></IconButton></Tooltip>
                  <Tooltip title="Delete monitor"><IconButton size="small" onClick={() => notify.info('Platform monitors cannot be deleted from the dashboard.')}><Trash2 size={14} color="#ef4444" /></IconButton></Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function MonitorDetailDrawer({ monitor, open, onClose }: { monitor: PlatformMonitor | null; open: boolean; onClose: () => void }) {
  const theme = useTheme()
  const [tab, setTab] = useState(0)
  const chartOpt = useMemo(() => buildDurationChartOption(theme, monitor), [theme, monitor])
  const historyRows = useMemo(() => buildHistoryRows(monitor), [monitor])
  const statusSquares = useMemo(() => buildStatusSquares(monitor, 288), [monitor])

  if (!monitor) return null

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      slotProps={{ paper: { sx: { width: 480, background: theme.palette.background.paper, borderLeft: `1px solid ${theme.palette.divider}` } } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(monitor.status) }} />
                <Typography variant="h3">{monitor.name}</Typography>
              </Box>
              <Typography variant="caption2" sx={{ color: 'text.secondary' }}>
                {monitor.url} &bull; {monitor.type} &bull; Last checked: {monitor.lastCheck}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" startIcon={<Pencil size={14} />} sx={{ fontSize: 12 }} onClick={() => notify.info('Platform monitors are managed by backend health probes.')}>Edit</Button>
              <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}><X size={18} /></IconButton>
            </Box>
          </Box>
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Overview" /><Tab label="History" /><Tab label="Errors" />
        </Tabs>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {tab === 0 && (
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                {[
                  { label: 'Availability', value: `${monitor.availability}%` },
                  { label: 'Avg Duration', value: monitor.avgDuration ? `${monitor.avgDuration}ms` : '—' },
                  { label: 'Checks/day', value: checksPerDay(monitor.frequency).toLocaleString() },
                ].map((s) => (
                  <Box key={s.label} sx={{ flex: 1, p: 1.5, border: 1, borderColor: 'divider', borderRadius: '4px', textAlign: 'center' }}>
                    <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{s.label}</Typography>
                    <Typography variant="metricSm">{s.value}</Typography>
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>Duration Trend (last 24h)</Typography>
              <ReactEChartsCore echarts={echarts} option={chartOpt} style={{ height: 160 }} notMerge />
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 2, mb: 1, display: 'block' }}>Status History (last 24h)</Typography>
              <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
                {statusSquares.map((s, i) => (
                  <Box key={i} sx={{ width: 10, height: 10, borderRadius: '1px', background: statusColor(s) }} />
                ))}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.disabled', mt: 2, display: 'block' }}>Monitor Details</Typography>
              {[['Type', monitor.type], ['URL', monitor.url], ['Frequency', `Every ${monitor.frequency}`], ['Source', 'MediCare health probe']].map(([k, v]) => (
                <Box key={k} sx={{ display: 'flex', py: 0.5 }}>
                  <Typography variant="caption2" sx={{ minWidth: 120, color: 'text.secondary' }}>{k}</Typography>
                  <Typography variant="caption2" sx={{ fontFamily: theme.typography.mono?.fontFamily }}>{v}</Typography>
                </Box>
              ))}
            </Box>
          )}
          {tab === 1 && (
            <Box sx={{ p: 2 }}>
              {historyRows.map((h, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', py: 0.5, borderBottom: `1px solid ${theme.palette.divider}`, height: 28 }}>
                  <Typography sx={{ fontFamily: theme.typography.mono?.fontFamily, fontSize: 12, color: 'text.secondary', width: 80 }}>{h.time}</Typography>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(h.status), mr: 1 }} />
                  <Typography variant="caption2" sx={{ width: 80 }}>{h.status}</Typography>
                  <Typography sx={{ fontFamily: theme.typography.mono?.fontFamily, fontSize: 12, width: 80 }}>{h.duration}ms</Typography>
                  <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{h.location}</Typography>
                </Box>
              ))}
            </Box>
          )}
          {tab === 2 && (
            <Box sx={{ p: 2, textAlign: 'center', py: 6 }}>
              <Typography variant="h4" sx={{ color: 'text.secondary', mb: 1 }}>{monitor.status === 'up' ? 'No errors' : 'Active issue detected'}</Typography>
              <Typography variant="caption2" sx={{ color: 'text.disabled' }}>
                {monitor.status === 'up' ? 'This monitor has been running without errors' : `${monitor.name} currently reports ${monitor.status}`}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  )
}

function CreateMonitorModal({ open, monitor, onClose }: { open: boolean; monitor: PlatformMonitor | null; onClose: () => void }) {
  const theme = useTheme()
  const isEdit = Boolean(monitor)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      slotProps={{ paper: { sx: { background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` } } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.5, py: 2 }}>
        <Typography variant="h3">{isEdit ? 'Edit Monitor' : 'Create Monitor'}</Typography>
        <Button onClick={onClose} sx={{ color: theme.palette.text.secondary, minWidth: 'auto', p: 0.5 }}><X size={18} /></Button>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: theme.palette.divider }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="caption2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>Name</Typography>
            <TextField size="small" fullWidth value={monitor?.name ?? ''} placeholder="API Gateway Health" />
          </Box>
          <Box>
            <Typography variant="caption2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>Type</Typography>
            <Select size="small" fullWidth value={monitor?.type ?? 'HTTP'}>
              <MenuItem value="HTTP">HTTP</MenuItem>
              <MenuItem value="TCP">TCP</MenuItem>
              <MenuItem value="SSL">SSL</MenuItem>
              <MenuItem value="DNS">DNS</MenuItem>
              <MenuItem value="Journey">Journey</MenuItem>
            </Select>
          </Box>
          <Box>
            <Typography variant="caption2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>URL / Host</Typography>
            <TextField size="small" fullWidth value={monitor?.url ?? ''} placeholder="https://example.com/health" helperText="Platform monitors are generated from backend health checks." />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled', borderTop: 1, borderColor: 'divider', pt: 2 }}>SCHEDULE</Typography>
          <Box>
            <Typography variant="caption2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>Check Frequency</Typography>
            <Select size="small" fullWidth value={monitor?.frequency ?? '30s'}>
              <MenuItem value="30s">30 seconds</MenuItem>
              <MenuItem value="1m">1 minute</MenuItem>
              <MenuItem value="2m">2 minutes</MenuItem>
              <MenuItem value="5m">5 minutes</MenuItem>
              <MenuItem value="10m">10 minutes</MenuItem>
            </Select>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled', borderTop: 1, borderColor: 'divider', pt: 2 }}>LOCATIONS</Typography>
          {['Local Docker Network', 'API Gateway', 'System Manager Service'].map((loc) => (
            <FormControlLabel key={loc} control={<Checkbox size="small" checked readOnly />} label={loc} sx={{ display: 'block' }} />
          ))}
          <Typography variant="caption" sx={{ color: 'text.disabled', borderTop: 1, borderColor: 'divider', pt: 2 }}>NOTIFICATIONS</Typography>
          <FormControlLabel control={<Checkbox size="small" checked readOnly />} label="Notify on failure" />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 2 }}>
        <Button onClick={onClose} sx={{ fontSize: 13 }}>Cancel</Button>
        <Button variant="contained" onClick={() => { notify.info('Platform monitors are managed by backend health probes.'); onClose() }} sx={{ fontSize: 13 }}>
          {isEdit ? 'Update Monitor' : 'Create Monitor'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function statusColor(status: string) {
  if (status === 'up' || status === 'operational') return '#10b981'
  if (status === 'degraded') return '#f59e0b'
  return '#ef4444'
}

function checksPerDay(frequency: string) {
  const value = Number.parseInt(frequency, 10)
  if (frequency.endsWith('s')) return Math.round((24 * 60 * 60) / value)
  if (frequency.endsWith('m')) return Math.round((24 * 60) / value)
  if (frequency.endsWith('h')) return Math.round(24 / value)
  return 1440
}

function buildDurationChartOption(theme: Theme, monitor: PlatformMonitor | null) {
  const base = monitor?.avgDuration ?? (monitor?.status === 'down' ? 500 : 45)
  const p50 = buildSeries(base, 0.15, monitor?.status)
  const p75 = buildSeries(base * 1.4, 0.18, monitor?.status)
  const p95 = buildSeries(base * 2.2, 0.22, monitor?.status)
  const max = buildSeries(base * 3.2, 0.28, monitor?.status)

  return {
    tooltip: { trigger: 'axis' as const, backgroundColor: theme.palette.background.elevated, borderColor: theme.palette.divider, textStyle: { color: theme.palette.text.primary, fontSize: 12 } },
    grid: { top: 8, right: 8, bottom: 24, left: 40 },
    xAxis: { type: 'category' as const, data: Array.from({ length: 24 }, (_, i) => `${i}h`), axisLabel: { color: theme.palette.text.disabled, fontSize: 10 } },
    yAxis: { type: 'value' as const, name: 'ms', splitLine: { lineStyle: { color: theme.palette.divider } }, axisLabel: { color: theme.palette.text.disabled, fontSize: 10 } },
    series: [
      { name: 'P50', type: 'line', data: p50, smooth: true, symbol: 'none', lineStyle: { color: '#10b981', width: 2 } },
      { name: 'P75', type: 'line', data: p75, smooth: true, symbol: 'none', lineStyle: { color: '#f59e0b', width: 2 } },
      { name: 'P95', type: 'line', data: p95, smooth: true, symbol: 'none', lineStyle: { color: '#ef4444', width: 2 } },
      { name: 'Max', type: 'line', data: max, smooth: true, symbol: 'none', lineStyle: { color: '#8b5cf6', width: 1, type: 'dashed' as const } },
    ],
  }
}

function buildSeries(base: number, variance: number, status?: string) {
  const penalty = status === 'down' ? 2.5 : status === 'degraded' ? 1.6 : 1
  return Array.from({ length: 24 }, (_, i) => {
    const wave = Math.sin(i / 3) * variance
    return Math.max(1, Number((base * penalty * (1 + wave)).toFixed(1)))
  })
}

function buildHistoryRows(monitor: PlatformMonitor | null) {
  if (!monitor) return []
  const statuses = buildStatusSquares(monitor, 10)
  return statuses.map((status, i) => ({
    time: new Date(Date.now() - i * 60_000).toLocaleTimeString(),
    status,
    duration: Math.round((monitor.avgDuration ?? 45) * (status === 'down' ? 0 : status === 'degraded' ? 2 : 1)),
    location: i % 2 === 0 ? 'Docker network' : 'Gateway route',
  }))
}

function buildStatusSquares(monitor: PlatformMonitor | null, count: number) {
  if (!monitor) return []
  return Array.from({ length: count }, (_, i) => {
    if (monitor.status === 'down') return i % 7 === 0 ? 'degraded' : 'down'
    if (monitor.status === 'degraded') return i % 5 === 0 ? 'up' : 'degraded'
    return i % 97 === 0 && monitor.availability < 100 ? 'degraded' : 'up'
  })
}

const headSx = { color: 'text.secondary', fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' as const, borderColor: 'divider', py: 1 }
const cellSx = { fontSize: 13, color: 'text.primary', borderColor: 'divider', py: '7px' }
