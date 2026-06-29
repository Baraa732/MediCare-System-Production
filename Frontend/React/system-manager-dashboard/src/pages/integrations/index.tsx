import { useMemo, useState } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Box, Button, Drawer, Grid, IconButton, Tab, Tabs, Typography } from '@mui/material'
import ReactECharts from 'echarts-for-react'
import { Activity, Database, FileText, GitBranch, HeartPulse, Layers, MessageCircle, Settings, X, Zap } from 'lucide-react'
import type { PlatformIntegration } from '../../api/types'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { notify } from '../../lib/toast'
import { AdvancedPageHeader, AdvancedPanel, CommandMetric, StatusDot } from '../../components/advanced/AdvancedPage'

const categories = ['All', 'Data Sources', 'Clinical', 'Messaging']
const statusColors: Record<string, string> = { connected: '#10b981', error: '#ef4444', available: '#8b93a8' }
const iconMap: Record<string, typeof Activity> = { Prometheus: Activity, Grafana: Layers, OpenEMR: HeartPulse, 'Evolution API': MessageCircle }

export default function Integrations() {
  const theme = useTheme()
  const [tab, setTab] = useState(0)
  const [selected, setSelected] = useState<PlatformIntegration | null>(null)
  const { data, refresh } = useObservabilityData(undefined, true)
  const integrations = data?.integrations ?? []
  const filtered = useMemo(() => tab === 0 ? integrations : integrations.filter((i) => i.category === categories[tab]), [integrations, tab])
  const connected = integrations.filter((item) => item.status === 'connected').length
  const errors = integrations.filter((item) => item.status === 'error').length
  const avgLatency = Math.round(integrations.filter((item) => item.latencyMs !== null).reduce((sum, item) => sum + (item.latencyMs ?? 0), 0) / Math.max(1, connected))

  return (
    <Box sx={{ p: 3 }}>
      <AdvancedPageHeader
        title="Integrations"
        eyebrow="Connection Fabric"
        description="Advanced real-time status for Prometheus, Grafana, OpenEMR, and Evolution API. Status and latency come from system-manager-service checks."
        icon={Layers}
        color={errors ? '#ef4444' : '#10b981'}
        status={`${connected}/${integrations.length} connected`}
        actions={<Button variant="outlined" startIcon={<Zap size={14} />} onClick={refresh}>Retest</Button>}
      >
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Connected" value={connected} helper="live integrations" color="#10b981" icon={Activity} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Errors" value={errors} helper="needs attention" color={errors ? '#ef4444' : '#10b981'} icon={Zap} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Avg Latency" value={`${avgLatency || 0}ms`} helper="connected checks" color="#06b6d4" icon={Database} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Categories" value={new Set(integrations.map((item) => item.category)).size} helper="integration groups" color="#8b5cf6" icon={GitBranch} /></Grid>
        </Grid>
      </AdvancedPageHeader>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        {categories.map((category) => <Tab key={category} label={category} />)}
      </Tabs>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <Grid container spacing={2}>
            {filtered.map((item) => <Grid key={item.name} size={{ xs: 12, sm: 6 }}><IntegrationCard item={item} onSelect={setSelected} /></Grid>)}
          </Grid>
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <AdvancedPanel title="Connection Radar" caption="status-weighted integration map">
            <ReactECharts option={radarOption(theme, integrations)} style={{ height: 320 }} notMerge />
          </AdvancedPanel>
        </Grid>
      </Grid>

      <IntegrationDrawer item={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </Box>
  )
}

function IntegrationCard({ item, onSelect }: { item: PlatformIntegration; onSelect: (item: PlatformIntegration) => void }) {
  const theme = useTheme()
  const Icon = iconMap[item.name] ?? (item.category === 'Data Sources' ? Database : item.category === 'Clinical' ? FileText : item.category === 'Messaging' ? MessageCircle : GitBranch)
  const color = statusColors[item.status]
  const latency = item.latencyMs ?? 0
  const spark = Array.from({ length: 28 }, (_, i) => Math.max(0, Math.round((latency || 80) * (0.78 + Math.sin(i / 4) * 0.2))))
  return (
    <Box sx={{ p: 2, border: `1px solid ${alpha(color, 0.35)}`, borderRadius: '5px', borderLeft: `3px solid ${color}`, bgcolor: alpha(color, 0.05), height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color, bgcolor: alpha(color, 0.12) }}><Icon size={18} /></Box>
          <Box>
            <Typography variant="h4">{item.name}</Typography>
            <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{item.category}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <StatusDot color={color} />
          <Typography variant="caption2" sx={{ color, textTransform: 'capitalize' }}>{item.status}</Typography>
        </Box>
      </Box>
      <Typography variant="caption2" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 1 }}>{item.desc}</Typography>
      <Typography variant="caption2" sx={{ color: 'text.disabled', display: 'block', fontFamily: theme.typography.mono?.fontFamily, mb: 1 }}>{item.url}</Typography>
      <ReactECharts option={sparkOption(spark, color)} style={{ height: 54 }} notMerge />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{item.latencyMs !== null ? `${item.latencyMs}ms` : 'No response'} · {item.checkedAt ? new Date(item.checkedAt).toLocaleTimeString() : 'pending'}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<Settings size={12} />} onClick={() => onSelect(item)} sx={{ fontSize: 12 }}>Inspect</Button>
          {item.status !== 'available' && <Button variant="outlined" size="small" onClick={() => notify.info(`${item.name} is managed by docker-compose and service configuration.`)} sx={{ fontSize: 12, color: '#ef4444', borderColor: '#ef4444' }}>Disconnect</Button>}
        </Box>
      </Box>
    </Box>
  )
}

function IntegrationDrawer({ item, open, onClose }: { item: PlatformIntegration | null; open: boolean; onClose: () => void }) {
  const theme = useTheme()
  if (!item) return null
  const color = statusColors[item.status]
  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: 460, bgcolor: 'background.paper' } } }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
        <Box><Typography variant="h3">{item.name}</Typography><Typography variant="caption2" sx={{ color }}>{item.status}</Typography></Box>
        <IconButton onClick={onClose}><X size={18} /></IconButton>
      </Box>
      <Box sx={{ p: 2, display: 'grid', gap: 1.5 }}>
        {Object.entries(item).map(([key, value]) => (
          <Box key={key} sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 1 }}>
            <Typography variant="caption2" sx={{ color: 'text.disabled' }}>{key}</Typography>
            <Typography variant="body2" sx={{ fontFamily: key === 'url' ? theme.typography.mono?.fontFamily : undefined }}>{String(value ?? '—')}</Typography>
          </Box>
        ))}
      </Box>
    </Drawer>
  )
}

function sparkOption(data: number[], color: string) {
  return { grid: { top: 2, right: 0, bottom: 2, left: 0 }, xAxis: { show: false, data: data.map((_, i) => i) }, yAxis: { show: false }, series: [{ type: 'line', data, smooth: true, symbol: 'none', lineStyle: { color, width: 1.6 }, areaStyle: { color: `${color}22` } }] }
}

function radarOption(theme: Theme, integrations: PlatformIntegration[]) {
  return {
    tooltip: { backgroundColor: theme.palette.background.elevated, borderColor: theme.palette.divider, textStyle: { color: theme.palette.text.primary } },
    radar: { indicator: integrations.map((item) => ({ name: item.name, max: 100 })), axisName: { color: theme.palette.text.secondary, fontSize: 11 }, splitLine: { lineStyle: { color: theme.palette.divider } }, splitArea: { areaStyle: { color: ['transparent'] } }, axisLine: { lineStyle: { color: theme.palette.divider } } },
    series: [{ type: 'radar', data: [{ value: integrations.map((item) => item.status === 'connected' ? 100 : item.status === 'available' ? 55 : 10), areaStyle: { color: 'rgba(6,182,212,0.12)' }, lineStyle: { color: '#06b6d4', width: 2 }, itemStyle: { color: '#06b6d4' } }] }],
  }
}
