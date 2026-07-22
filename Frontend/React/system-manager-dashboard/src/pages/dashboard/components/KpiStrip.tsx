import { memo } from 'react'
import { alpha } from '@mui/material/styles'
import { Box, Grid, Typography } from '@mui/material'
import ReactECharts from 'echarts-for-react'
import { ArrowDown, ArrowUp, Flame } from 'lucide-react'
import { DashboardEntrance, DASHBOARD_MOTION, dashboardStaggerDelay } from '../../../components/motion/DashboardEntrance'
import { sparkOption } from '../dashboardUtils'

export interface KpiItem {
  label: string
  value: string
  unit?: string
  color: string
  trend: string
  positive: boolean
  series?: number[]
  /** Optional burn-rate label for error budget KPI. */
  burnRate?: string
  /** Projected budget exhaustion label. */
  exhaustionLabel?: string
  state?: 'healthy' | 'warning' | 'critical'
}

function KpiCard({ label, value, unit, color, trend, positive, series, burnRate, exhaustionLabel, state, index }: KpiItem & { index: number }) {
  const hasSparkline = series && series.length > 1
  const borderAccent = state === 'critical' ? '#ef4444' : state === 'warning' ? '#f59e0b' : color

  return (
    <DashboardEntrance
      delay={dashboardStaggerDelay(DASHBOARD_MOTION.kpiBaseDelayMs, index, 55)}
      variant="scaleIn"
      sx={{ height: '100%' }}
    >
    <Box sx={{
      background: alpha(color, 0.06),
      border: `1px solid ${alpha(borderAccent, state ? 0.45 : 0.2)}`,
      borderLeft: state ? `3px solid ${borderAccent}` : undefined,
      borderRadius: '4px',
      p: 1.5,
      height: '100%',
    }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
        <Typography variant="metricSm">
          {value}
          {unit && (
            <Typography component="span" variant="caption2" sx={{ ml: 0.5, color: 'text.secondary' }}>{unit}</Typography>
          )}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {positive ? <ArrowUp size={12} color="#10b981" /> : <ArrowDown size={12} color="#ef4444" />}
          <Typography variant="caption2" sx={{ color: positive ? '#10b981' : '#ef4444' }}>{trend}</Typography>
        </Box>
      </Box>
      {burnRate && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <Flame size={11} color={color} />
          <Typography variant="caption2" sx={{ color: 'text.secondary' }}>Burn {burnRate}/hr</Typography>
        </Box>
      )}
      {exhaustionLabel && state !== 'healthy' && (
        <Typography variant="caption2" sx={{ color: state === 'critical' ? '#ef4444' : '#f59e0b', mt: 0.35, display: 'block', fontWeight: 600 }}>
          {exhaustionLabel}
        </Typography>
      )}
      {hasSparkline && (
        <Box sx={{ height: 36, mt: 0.5 }}>
          <ReactECharts option={sparkOption(series!, color)} style={{ height: 36 }} lazyUpdate />
        </Box>
      )}
    </Box>
    </DashboardEntrance>
  )
}

function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <Box
      sx={{
        position: { md: 'sticky' },
        top: { md: 48 },
        zIndex: 100,
        bgcolor: 'background.default',
        py: 0.5,
        mx: -0.5,
        px: 0.5,
      }}
    >
      <Grid container spacing={1.5}>
        {items.map((item, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 4, xl: 2.4 }} key={item.label}>
            <KpiCard {...item} index={index} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

export default memo(KpiStrip)
