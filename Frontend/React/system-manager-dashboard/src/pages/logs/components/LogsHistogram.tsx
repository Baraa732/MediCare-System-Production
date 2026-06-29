import { useMemo } from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import type { PlatformLogsHistogramBucket } from '../../../api/types'

interface LogsHistogramProps {
  data: PlatformLogsHistogramBucket[]
  height?: number
  showLegend?: boolean
}

export default function LogsHistogram({ data, height = 160, showLegend = false }: LogsHistogramProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const option = useMemo(() => {
    const labels = data.map((b) => {
      const d = new Date(b.bucket)
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    })

    const gridColor = theme.palette.chart?.grid ?? theme.palette.divider
    const axisColor = theme.palette.chart?.axis ?? theme.palette.text.disabled

    return {
      grid: { top: showLegend ? 28 : 8, right: 8, bottom: 24, left: 40 },
      legend: showLegend
        ? { top: 0, right: 0, textStyle: { color: theme.palette.text.secondary, fontSize: 10 }, itemWidth: 10, itemHeight: 8 }
        : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: isDark ? '#161b27' : '#ffffff',
        borderColor: theme.palette.divider,
        textStyle: { color: theme.palette.text.primary, fontSize: 12 },
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { fontSize: 10, color: axisColor, interval: Math.max(0, Math.floor(labels.length / 8)) },
        axisLine: { lineStyle: { color: gridColor } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { fontSize: 10, color: axisColor },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: [
        { name: 'ERROR', type: 'bar', stack: 'logs', barMaxWidth: 8, data: data.map((b) => b.error), itemStyle: { color: '#ef4444cc' } },
        { name: 'WARN', type: 'bar', stack: 'logs', barMaxWidth: 8, data: data.map((b) => b.warn), itemStyle: { color: '#f59e0bcc' } },
        { name: 'INFO', type: 'bar', stack: 'logs', barMaxWidth: 8, data: data.map((b) => b.info), itemStyle: { color: '#06b6d4cc' } },
        { name: 'DEBUG', type: 'bar', stack: 'logs', barMaxWidth: 8, data: data.map((b) => b.debug + b.trace), itemStyle: { color: isDark ? '#4d566b99' : '#9ca3af99' } },
      ],
    }
  }, [data, isDark, showLegend, theme.palette.chart?.axis, theme.palette.chart?.grid, theme.palette.divider, theme.palette.text.disabled, theme.palette.text.primary, theme.palette.text.secondary])

  return (
    <Box sx={{ height, flexShrink: 0 }}>
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
    </Box>
  )
}
