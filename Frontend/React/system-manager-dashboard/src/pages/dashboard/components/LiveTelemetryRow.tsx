import { memo, useMemo } from 'react'
import { Box, Grid, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import { AdvancedPanel } from '../../../components/advanced/AdvancedPage'
import { DashboardEntrance, dashboardStaggerDelay } from '../../../components/motion/DashboardEntrance'
import type { ApmService, PlatformThroughput } from '../../../api/types'
import {
  buildErrorBarOption,
  buildHealthGaugeOption,
  buildServiceDonutOption,
  buildThroughputOption,
} from '../dashboardChartOptions'

interface LiveTelemetryRowProps {
  services: ApmService[]
  errors: Array<{ service: string; count: number; message: string }>
  healthScore: number
  availability: number
  throughput?: PlatformThroughput
  live?: boolean
}

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 64 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: color ?? 'text.primary', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.disabled' }}>
        {label}
      </Typography>
    </Box>
  )
}

function LiveTelemetryRow({
  services,
  errors,
  healthScore,
  availability,
  throughput,
  live,
}: LiveTelemetryRowProps) {
  const theme = useTheme()

  const throughputOption = useMemo(
    () => buildThroughputOption(services, theme, throughput),
    [services, theme, throughput],
  )
  const errorOption = useMemo(
    () => buildErrorBarOption(errors, theme),
    [errors, theme],
  )
  const gaugeOption = useMemo(
    () => buildHealthGaugeOption(healthScore, theme),
    [healthScore, theme],
  )
  const donutOption = useMemo(
    () => buildServiceDonutOption(services, theme),
    [services, theme],
  )

  const topEmitter = useMemo(() => {
    const sorted = [...services].sort((a, b) => b.reqRate - a.reqRate)
    return sorted[0] ?? null
  }, [services])

  const current = throughput?.current
    ?? services.reduce((sum, s) => sum + (s.series?.[s.series.length - 1] ?? 0), 0)
  const peak = throughput?.peak
    ?? services.reduce((best, s) => {
      const local = Math.max(0, ...(s.series ?? [0]))
      return local > best ? local : best
    }, 0)
  const avg = throughput?.avg
    ?? (services.length
      ? Math.round((services.reduce((sum, s) => sum + s.reqRate, 0)) * 100) / 100
      : 0)

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, lg: 5 }}>
        <DashboardEntrance delay={dashboardStaggerDelay(0, 0, 65)} variant="scaleIn">
          <AdvancedPanel
            title="Request throughput"
            caption={`${live ? 'LIVE · ' : ''}${throughput?.unit ?? 'req/s'} · stacked services + platform total`}
            dense
            bodySx={{ p: 1.25, pt: 0 }}
            actions={
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <StatChip label="Now" value={current.toFixed(2)} color="#06b6d4" />
                <StatChip label="Peak" value={peak.toFixed(2)} color="#8b5cf6" />
                <StatChip label="Avg" value={avg.toFixed(2)} />
                {topEmitter && (
                  <StatChip
                    label="Top"
                    value={topEmitter.name.replace(/-service$/, '')}
                    color="#10b981"
                  />
                )}
              </Box>
            }
          >
            <Box sx={{ height: 248 }}>
              <ReactECharts
                option={throughputOption}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge
                lazyUpdate
              />
            </Box>
          </AdvancedPanel>
        </DashboardEntrance>
      </Grid>

      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <DashboardEntrance delay={dashboardStaggerDelay(0, 1, 65)} variant="scaleIn">
          <AdvancedPanel title="Error hotspots" caption="Grouped by service" dense bodySx={{ p: 1.25, pt: 0 }}>
            <Box sx={{ height: 248 }}>
              <ReactECharts option={errorOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} lazyUpdate />
            </Box>
          </AdvancedPanel>
        </DashboardEntrance>
      </Grid>

      <Grid size={{ xs: 12, md: 6, lg: 2 }}>
        <DashboardEntrance delay={dashboardStaggerDelay(0, 2, 65)} variant="scaleIn">
          <AdvancedPanel title="Platform health" caption={`${availability}% availability`} dense bodySx={{ p: 0.5, pt: 0 }}>
            <Box sx={{ height: 248 }}>
              <ReactECharts option={gaugeOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} lazyUpdate />
            </Box>
          </AdvancedPanel>
        </DashboardEntrance>
      </Grid>

      <Grid size={{ xs: 12, lg: 2 }}>
        <DashboardEntrance delay={dashboardStaggerDelay(0, 3, 65)} variant="scaleIn">
          <AdvancedPanel title="Service mix" caption="Health distribution" dense bodySx={{ p: 1.25, pt: 0 }}>
            <Box sx={{ height: 248 }}>
              <ReactECharts option={donutOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} lazyUpdate />
            </Box>
          </AdvancedPanel>
        </DashboardEntrance>
      </Grid>
    </Grid>
  )
}

export default memo(LiveTelemetryRow)
