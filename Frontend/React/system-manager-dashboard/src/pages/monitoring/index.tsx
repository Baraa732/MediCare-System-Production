import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Grid, LinearProgress, Skeleton, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import { Activity, Database, ExternalLink, HardDrive, Radio, RefreshCw, Server, ShieldCheck } from 'lucide-react'
import { getPlatformHealth } from '../../api/systemManager'
import { normalizeError } from '../../api/errors'
import type { PlatformHealth } from '../../api/types'
import { useAuthStore } from '../../store/authStore'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { AdvancedPageHeader, AdvancedPanel, CommandMetric, StatusDot } from '../../components/advanced/AdvancedPage'

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL ?? 'http://localhost:3001'

function statusColor(status: string): string {
  if (status === 'up' || status === 'ok' || status === 'healthy') return '#10b981'
  if (status === 'degraded' || status === 'unknown') return '#f59e0b'
  return '#ef4444'
}

export default function Monitoring() {
  const theme = useTheme()
  const token = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const { data } = useObservabilityData('1h', true)
  const [health, setHealth] = useState<PlatformHealth | null>(null)
  const [history, setHistory] = useState<Array<{ time: string; up: number; down: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHealth = useCallback(async () => {
    if (!token) {
      setLoading(false)
      setError('Session expired. Please sign in again.')
      return
    }

    setError(null)
    try {
      const response = await getPlatformHealth(token)
      setHealth(response)
      setHistory((prev) => {
        const up = response.services.filter((service) => service.status === 'up').length
        const down = response.services.length - up
        return [...prev.slice(-23), { time: new Date(response.timestamp).toLocaleTimeString(), up, down }]
      })
    } catch (err) {
      setError(normalizeError(err, 'Could not load platform health.'))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!hasHydrated) return
    void loadHealth()
    const timer = window.setInterval(loadHealth, 5000)
    return () => window.clearInterval(timer)
  }, [hasHydrated, loadHealth])

  const servicesUp = health?.services.filter((service) => service.status === 'up').length ?? 0
  const servicesTotal = health?.services.length ?? 0
  const infra = health
    ? [
        { label: 'Database', value: health.infrastructure.database, icon: Database },
        { label: 'Kafka', value: health.infrastructure.kafka, icon: Radio },
        { label: 'Redis', value: health.infrastructure.redis, icon: HardDrive },
      ]
    : []
  const apmServices = data?.apm.services ?? []
  const slowTraces = data?.traces.items.filter((trace) => trace.status === 'slow').length ?? 0
  const errorTraces = data?.traces.summary.errors ?? 0

  const healthPercent = servicesTotal ? Math.round((servicesUp / servicesTotal) * 100) : 0

  return (
    <Box sx={{ p: 3 }}>
      <AdvancedPageHeader
        title="Monitoring"
        eyebrow="Live Platform Control"
        description="Advanced health console for services, infrastructure, Grafana metrics, latency posture, and live readiness snapshots from the real system-manager health API."
        icon={Activity}
        color={statusColor(health?.status ?? 'unknown')}
        status={health?.status ?? 'syncing'}
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshCw size={14} />} onClick={loadHealth}>Refresh</Button>
            <Button variant="outlined" startIcon={<ExternalLink size={14} />} href={GRAFANA_URL} target="_blank" rel="noopener noreferrer">Open Grafana</Button>
          </>
        }
      >
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Services Up" value={`${servicesUp}/${servicesTotal}`} helper={`${healthPercent}% healthy`} color={statusColor(health?.status ?? 'unknown')} icon={Server} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Infrastructure" value={infra.filter((item) => item.value === 'ok').length} helper="checks ok" color="#10b981" icon={Database} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Slow Traces" value={slowTraces} helper="current window" color={slowTraces ? '#f59e0b' : '#10b981'} icon={Radio} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Trace Errors" value={errorTraces} helper="current window" color={errorTraces ? '#ef4444' : '#10b981'} icon={ShieldCheck} /></Grid>
        </Grid>
      </AdvancedPageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => <Grid key={i} size={{ xs: 12, md: 3 }}><Skeleton variant="rounded" height={120} /></Grid>)}
        </Grid>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, xl: 8 }}>
            <AdvancedPanel title="Health Timeline" caption="5-second snapshots from /platform/health">
              <ReactECharts option={timelineOption(theme, history)} style={{ height: 280 }} notMerge />
            </AdvancedPanel>
          </Grid>
          <Grid size={{ xs: 12, xl: 4 }}>
            <AdvancedPanel title="Infrastructure Gauges" caption="database · kafka · redis">
              <Box sx={{ display: 'grid', gap: 1.25 }}>
                {infra.map((item) => {
                  const Icon = item.icon
                  const color = statusColor(item.value)
                  return (
                    <Box key={item.label} sx={{ p: 1.25, border: `1px solid ${alpha(color, 0.28)}`, bgcolor: alpha(color, 0.07), borderRadius: '4px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Icon size={16} color={color} />
                        <Typography variant="body2" sx={{ flex: 1 }}>{item.label}</Typography>
                        <StatusDot color={color} />
                      </Box>
                      <LinearProgress variant="determinate" value={item.value === 'ok' ? 100 : item.value === 'unknown' ? 55 : 8} sx={{ height: 6, borderRadius: 999, bgcolor: 'background.default', '& .MuiLinearProgress-bar': { bgcolor: color } }} />
                    </Box>
                  )
                })}
              </Box>
            </AdvancedPanel>
          </Grid>
          <Grid size={{ xs: 12, xl: 6 }}>
            <AdvancedPanel title="Service Readiness Matrix" caption="all probed services">
              <Grid container spacing={1}>
                {(health?.services ?? []).map((service) => {
                  const color = statusColor(service.status)
                  return (
                    <Grid key={service.name} size={{ xs: 12, sm: 6 }}>
                      <Box sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: '4px', borderLeft: `3px solid ${color}`, bgcolor: alpha(color, 0.04) }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Server size={15} color={color} />
                          <Typography variant="body2" sx={{ flex: 1, fontFamily: theme.typography.mono?.fontFamily }}>{service.name}</Typography>
                          <Typography variant="caption2" sx={{ color, textTransform: 'uppercase' }}>{service.status}</Typography>
                        </Box>
                        {service.checks && (
                          <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                            {Object.entries(service.checks).map(([key, value]) => `${key}:${value}`).join(' · ')}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  )
                })}
              </Grid>
            </AdvancedPanel>
          </Grid>
          <Grid size={{ xs: 12, xl: 6 }}>
            <AdvancedPanel title="Latency Heatmap" caption="derived from live APM service series">
              <Box sx={{ display: 'grid', gap: 0.75 }}>
                {apmServices.slice(0, 8).map((service) => (
                  <Box key={service.name} sx={{ display: 'grid', gridTemplateColumns: '130px 1fr 54px', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption2" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{service.name}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 0.35 }}>
                      {service.series.slice(-20).map((value, index) => <Box key={index} sx={{ height: 14, borderRadius: '2px', bgcolor: value > 20 ? '#ef4444' : value > 8 ? '#f59e0b' : '#10b981', opacity: 0.45 + Math.min(0.55, value / 40) }} />)}
                    </Box>
                    <Typography variant="caption2" sx={{ color: service.errorRate ? '#ef4444' : '#10b981', textAlign: 'right' }}>{service.p95 ?? 0}ms</Typography>
                  </Box>
                ))}
              </Box>
            </AdvancedPanel>
          </Grid>
        </Grid>
      )}
    </Box>
  )
}

function timelineOption(theme: Theme, history: Array<{ time: string; up: number; down: number }>) {
  const data = history.length ? history : Array.from({ length: 12 }, (_, i) => ({ time: `${i}`, up: 0, down: 0 }))
  return {
    tooltip: { trigger: 'axis', backgroundColor: theme.palette.background.elevated, borderColor: theme.palette.divider, textStyle: { color: theme.palette.text.primary, fontSize: 12 } },
    legend: { top: 0, textStyle: { color: theme.palette.text.secondary, fontSize: 12 } },
    grid: { top: 36, right: 16, bottom: 32, left: 42 },
    xAxis: { type: 'category', data: data.map((item) => item.time), axisLabel: { color: theme.palette.text.disabled, fontSize: 10 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: theme.palette.divider } }, axisLabel: { color: theme.palette.text.disabled, fontSize: 11 } },
    series: [
      { name: 'Up', type: 'line', data: data.map((item) => item.up), smooth: true, symbol: 'none', lineStyle: { color: '#10b981', width: 2 }, areaStyle: { color: 'rgba(16,185,129,0.08)' } },
      { name: 'Down', type: 'line', data: data.map((item) => item.down), smooth: true, symbol: 'none', lineStyle: { color: '#ef4444', width: 2 } },
    ],
  }
}
