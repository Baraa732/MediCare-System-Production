import { useMemo, useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Box, Chip, Drawer, Grid, IconButton, LinearProgress, MenuItem, Select, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material'
import ReactECharts from 'echarts-for-react'
import { Activity, Gauge, Search, Server, TrendingUp, X, Zap } from 'lucide-react'
import type { ApmService, PlatformMonitor } from '../../api/types'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { AdvancedPageHeader, AdvancedPanel, CommandMetric, ObservabilityPage, PbiGrid, StatusDot } from '../../components/advanced/AdvancedPage'

export default function Metrics() {
  const [tab, setTab] = useState(0)
  const { data } = useObservabilityData('1h', true)
  const services = data?.apm.services ?? []
  const hosts = data?.monitors.items ?? []
  const totalTraffic = services.reduce((sum, service) => sum + service.reqRate, 0)
  const avgP95 = Math.round(services.reduce((sum, service) => sum + (service.p95 ?? 0), 0) / Math.max(1, services.length))
  const errorRate = Number((services.reduce((sum, service) => sum + service.errorRate, 0) / Math.max(1, services.length)).toFixed(1))
  const healthyHosts = hosts.filter((host) => host.status === 'up').length

  return (
    <ObservabilityPage>
      <AdvancedPageHeader
        title="Metrics & Infrastructure"
        eyebrow="Telemetry Workbench"
        description="Service traffic, latency, monitor health, and capacity signals."
        icon={Gauge}
        color="#06b6d4"
        status="Live"
        compact
      >
        <PbiGrid spacing={1}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Traffic" value={totalTraffic} helper="events/h" color="#06b6d4" icon={Activity} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Avg P95" value={`${avgP95}ms`} helper="service latency" color={avgP95 > 800 ? '#ef4444' : avgP95 > 300 ? '#f59e0b' : '#10b981'} icon={TrendingUp} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Error Rate" value={`${errorRate}%`} helper="mean service rate" color={errorRate > 1 ? '#ef4444' : '#10b981'} icon={Zap} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Monitors" value={`${healthyHosts}/${hosts.length}`} helper="healthy checks" color="#10b981" icon={Server} /></Grid>
        </PbiGrid>
      </AdvancedPageHeader>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ flexShrink: 0, minHeight: 36 }}>
        <Tab label="Infrastructure" />
        <Tab label="Metrics Explorer" />
      </Tabs>
      {tab === 0 && <InfrastructureTab hosts={hosts} services={services} />}
      {tab === 1 && <MetricsExplorerTab services={services} />}
    </ObservabilityPage>
  )
}

function InfrastructureTab({ hosts, services }: { hosts: PlatformMonitor[]; services: ApmService[] }) {
  const [selected, setSelected] = useState<PlatformMonitor | null>(null)
  const cards = [
    { label: 'Checks', value: hosts.length, color: '#06b6d4' },
    { label: 'Up', value: hosts.filter((h) => h.status === 'up').length, color: '#10b981' },
    { label: 'Degraded', value: hosts.filter((h) => h.status === 'degraded').length, color: '#f59e0b' },
    { label: 'Down', value: hosts.filter((h) => h.status === 'down').length, color: '#ef4444' },
  ]
  return (
    <PbiGrid spacing={1.5}>
      <Grid size={{ xs: 12, xl: 8 }}>
        <PbiGrid spacing={1}>
          {cards.map((card) => <Grid key={card.label} size={{ xs: 12, sm: 6, md: 3 }}><Box sx={{ p: 1.25, border: `1px solid ${alpha(card.color, 0.22)}`, bgcolor: alpha(card.color, 0.05), borderRadius: '4px', borderLeft: `3px solid ${card.color}`, height: '100%' }}><Typography variant="caption" sx={{ color: 'text.secondary' }}>{card.label}</Typography><Typography variant="metricSm">{card.value}</Typography></Box></Grid>)}
        </PbiGrid>
        <Box sx={{ mt: 1.5 }}>
          <AdvancedPanel title="Infrastructure Matrix" caption="click a row to inspect monitor details" dense>
            <HostsTable hosts={hosts} services={services} onSelect={setSelected} />
          </AdvancedPanel>
        </Box>
      </Grid>
      <Grid size={{ xs: 12, xl: 4 }}>
        <AdvancedPanel title="Capacity Radar" caption="traffic, latency, errors, monitor health" dense>
          <ReactECharts option={capacityOption(services, hosts)} style={{ height: 320 }} notMerge />
        </AdvancedPanel>
      </Grid>
      <HostDrawer host={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </PbiGrid>
  )
}

function HostsTable({ hosts, services, onSelect }: { hosts: PlatformMonitor[]; services: ApmService[]; onSelect: (h: PlatformMonitor) => void }) {
  return (
    <TableContainer sx={{ background: 'transparent', boxShadow: 'none' }}>
      <Table size="small">
        <TableHead><TableRow><TableCell sx={headSx}>Host</TableCell><TableCell sx={headSx}>Type</TableCell><TableCell sx={headSx}>Req/min</TableCell><TableCell sx={headSx}>Error %</TableCell><TableCell sx={headSx}>Status</TableCell><TableCell sx={headSx}>Latency</TableCell></TableRow></TableHead>
        <TableBody>{hosts.map((host, i) => {
          const svc = services[i % Math.max(1, services.length)]
          const reqRate = svc?.reqRate ?? 0
          const errorRate = svc?.errorRate ?? 0
          const color = statusColor(host.status)
          return <TableRow hover key={host.id} onClick={() => onSelect(host)} sx={{ cursor: 'pointer', height: 38 }}><TableCell sx={cellSx}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><StatusDot color={color} />{host.name}</Box></TableCell><TableCell sx={cellSx}><Chip label={host.type} size="small" sx={{ height: 20, fontSize: 10 }} /></TableCell><TableCell sx={cellSx}><UsageBar value={Math.min(99, reqRate)} /></TableCell><TableCell sx={cellSx}><UsageBar value={Math.min(99, errorRate)} /></TableCell><TableCell sx={{ ...cellSx, color }}>{host.status}</TableCell><TableCell sx={cellSx}>{host.avgDuration ?? 0}ms</TableCell></TableRow>
        })}</TableBody>
      </Table>
    </TableContainer>
  )
}

function MetricsExplorerTab({ services }: { services: ApmService[] }) {
  const theme = useTheme()
  const [query, setQuery] = useState('service.latency.p95')
  const [service, setService] = useState('all')
  const filtered = service === 'all' ? services : services.filter((s) => s.name === service)
  const option = useMemo(() => explorerOption(theme, filtered, query), [filtered, query, theme])
  return (
    <PbiGrid spacing={1.5}>
      <Grid size={{ xs: 12, xl: 9 }}>
        <AdvancedPanel title="Metrics Explorer" caption="query real service series" dense>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <TextField size="small" value={query} onChange={(e) => setQuery(e.target.value)} slotProps={{ input: { startAdornment: <Search size={14} color="#8b93a8" style={{ marginRight: 6 }} /> } }} sx={{ width: 320 }} />
            <Select size="small" value={service} onChange={(e) => setService(e.target.value)} sx={{ minWidth: 180 }}>
              <MenuItem value="all">All Services</MenuItem>
              {services.map((s) => <MenuItem key={s.name} value={s.name}>{s.name}</MenuItem>)}
            </Select>
          </Box>
          <ReactECharts option={option} style={{ height: 320 }} notMerge />
        </AdvancedPanel>
      </Grid>
      <Grid size={{ xs: 12, xl: 3 }}>
        <AdvancedPanel title="Metric Presets" caption="quick query targets" dense>
          {[
            ['service.req_rate', '#06b6d4'],
            ['service.error_rate', '#ef4444'],
            ['service.latency.p95', '#8b5cf6'],
            ['service.instances', '#10b981'],
          ].map(([preset, color]) => <Box key={preset} onClick={() => setQuery(preset)} sx={{ p: 1.25, mb: 1, border: `1px solid ${alpha(color, 0.25)}`, bgcolor: query === preset ? alpha(color, 0.12) : 'transparent', borderRadius: '4px', cursor: 'pointer' }}><Typography variant="body2">{preset}</Typography><Typography variant="caption2" sx={{ color }}>avg {preset.includes('latency') ? 'ms' : 'count'}</Typography></Box>)}
        </AdvancedPanel>
      </Grid>
    </PbiGrid>
  )
}

function HostDrawer({ host, open, onClose }: { host: PlatformMonitor | null; open: boolean; onClose: () => void }) {
  if (!host) return null
  return <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: 440, bgcolor: 'background.paper' } } }}><Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}><Typography variant="h3">{host.name}</Typography><IconButton onClick={onClose}><X size={18} /></IconButton></Box><Box sx={{ p: 2, display: 'grid', gap: 1.5 }}>{Object.entries(host).map(([k, v]) => <Box key={k}><Typography variant="caption2" sx={{ color: 'text.disabled' }}>{k}</Typography><Typography variant="body2">{String(v)}</Typography></Box>)}</Box></Drawer>
}

function UsageBar({ value }: { value: number }) {
  const color = value > 80 ? '#ef4444' : value > 55 ? '#f59e0b' : '#10b981'
  return <LinearProgress variant="determinate" value={value} sx={{ height: 6, borderRadius: 4, bgcolor: 'background.default', '& .MuiLinearProgress-bar': { bgcolor: color } }} />
}

function statusColor(status: string) { return status === 'up' ? '#10b981' : status === 'degraded' ? '#f59e0b' : '#ef4444' }

function explorerOption(theme: Theme, services: ApmService[], query: string) {
  return { tooltip: { trigger: 'axis', backgroundColor: theme.palette.background.elevated, borderColor: theme.palette.divider, textStyle: { color: theme.palette.text.primary, fontSize: 12 } }, legend: { bottom: 0, type: 'scroll', textStyle: { color: theme.palette.text.secondary, fontSize: 11 } }, grid: { top: 12, right: 12, bottom: 40, left: 44 }, xAxis: { type: 'category', data: Array.from({ length: 30 }, (_, i) => `${i * 2}m`), axisLabel: { color: theme.palette.text.disabled, fontSize: 10 } }, yAxis: { type: 'value', splitLine: { lineStyle: { color: theme.palette.divider, width: 1 } }, axisLabel: { color: theme.palette.text.disabled, fontSize: 10 } }, series: services.slice(0, 7).map((s, i) => ({ name: s.name, type: 'line', data: query.includes('error') ? s.series.map((v) => Math.round(v * s.errorRate / 10)) : query.includes('instances') ? s.series.map(() => s.instances) : s.series, smooth: false, symbol: 'none', lineStyle: { color: ['#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#f97316'][i], width: 1 } })) }
}

function capacityOption(services: ApmService[], hosts: PlatformMonitor[]) {
  const traffic = Math.min(100, services.reduce((sum, s) => sum + s.reqRate, 0))
  const latency = Math.min(100, services.reduce((sum, s) => sum + (s.p95 ?? 0), 0) / Math.max(1, services.length) / 10)
  const errors = Math.min(100, services.reduce((sum, s) => sum + s.errorRate, 0) * 10)
  const health = hosts.length ? (hosts.filter((h) => h.status === 'up').length / hosts.length) * 100 : 100
  return { radar: { indicator: [{ name: 'Traffic', max: 100 }, { name: 'Latency', max: 100 }, { name: 'Errors', max: 100 }, { name: 'Monitor Health', max: 100 }, { name: 'Instances', max: 100 }], axisName: { color: '#8b93a8', fontSize: 10 }, splitLine: { lineStyle: { color: '#2a3147', width: 1 } }, splitArea: { show: false }, axisLine: { lineStyle: { color: '#2a3147', width: 1 } } }, series: [{ type: 'radar', data: [{ value: [traffic, latency, errors, health, Math.min(100, services.reduce((sum, s) => sum + s.instances, 0) * 20)], lineStyle: { color: '#06b6d4', width: 1 }, itemStyle: { color: '#06b6d4' } }] }] }
}

const headSx = { color: 'text.secondary', fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' as const, borderColor: 'divider', py: 1 }
const cellSx = { fontSize: 13, color: 'text.primary', borderColor: 'divider', py: '7px' }
