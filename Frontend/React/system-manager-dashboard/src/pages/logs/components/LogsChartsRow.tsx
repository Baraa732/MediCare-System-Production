import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import type { PlatformLogLevel, PlatformLogsHistogramBucket } from '../../../api/types'
import { LOG_LEVEL_COLORS, LOG_LEVEL_LABELS } from '../logUtils'
import LogsHistogram from './LogsHistogram'

interface LogsChartsRowProps {
  histogram: PlatformLogsHistogramBucket[]
  levels: Array<{ level: PlatformLogLevel; count: number }>
  totalEvents: number
}

export default function LogsChartsRow({ histogram, levels, totalEvents }: LogsChartsRowProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const levelTotal = useMemo(
    () => levels.reduce((sum, item) => sum + item.count, 0),
    [levels],
  )

  const peakBucket = useMemo(
    () => histogram.reduce(
      (best, bucket) => {
        const sum = bucket.error + bucket.warn + bucket.info + bucket.debug + bucket.trace
        return sum > best ? sum : best
      },
      0,
    ),
    [histogram],
  )

  const donutOption = useMemo(() => {
    const data = levels
      .filter((l) => l.count > 0)
      .map((l) => ({
        name: LOG_LEVEL_LABELS[l.level],
        value: l.count,
        itemStyle: { color: LOG_LEVEL_COLORS[l.level] },
      }))

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
        backgroundColor: isDark ? '#161b27' : '#ffffff',
        borderColor: theme.palette.divider,
        textStyle: { color: theme.palette.text.primary, fontSize: 11 },
      },
      legend: {
        bottom: 0,
        textStyle: { color: theme.palette.text.secondary, fontSize: 10 },
        itemWidth: 8,
        itemHeight: 8,
      },
      series: [{
        type: 'pie',
        radius: ['42%', '62%'],
        center: ['50%', '42%'],
        label: { show: false },
        itemStyle: { borderWidth: 1, borderColor: theme.palette.background.paper },
        data: data.length ? data : [{ name: 'Empty', value: 1, itemStyle: { color: theme.palette.divider } }],
      }],
      graphic: [{
        type: 'text',
        left: 'center',
        top: '36%',
        style: {
          text: levelTotal.toLocaleString(),
          fill: theme.palette.text.primary,
          fontSize: 18,
          fontWeight: 700,
          textAlign: 'center',
        },
      }, {
        type: 'text',
        left: 'center',
        top: '48%',
        style: {
          text: 'events',
          fill: theme.palette.text.secondary,
          fontSize: 10,
          fontWeight: 600,
          textAlign: 'center',
        },
      }],
    }
  }, [isDark, levelTotal, levels, theme.palette.background.paper, theme.palette.divider, theme.palette.text.primary, theme.palette.text.secondary])

  return (
    <div className="logs-charts">
      <div className="logs-chart-card">
        <div className="logs-chart-card__head">
          <span className="logs-chart-card__title">Volume</span>
          <span className="logs-chart-card__total">
            {totalEvents.toLocaleString()} events · peak {peakBucket}
          </span>
        </div>
        <LogsHistogram data={histogram} height={148} showLegend />
      </div>

      <div className="logs-chart-card">
        <div className="logs-chart-card__head">
          <span className="logs-chart-card__title">Severity</span>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {levels.filter((l) => l.count > 0 && (l.level === 'ERROR' || l.level === 'WARN')).map((l) => (
              <Typography key={l.level} sx={{ fontSize: 11, fontWeight: 700, color: LOG_LEVEL_COLORS[l.level] }}>
                {l.count} {l.level}
              </Typography>
            ))}
          </Box>
        </div>
        <Box sx={{ height: 148 }}>
          <ReactECharts option={donutOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
        </Box>
      </div>
    </div>
  )
}
