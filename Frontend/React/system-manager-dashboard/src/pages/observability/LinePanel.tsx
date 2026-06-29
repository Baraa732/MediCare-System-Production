import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import { CHART_LINE_WIDTH } from '../../lib/chartTheme'

interface LinePanelProps {
  title: string
  series: Array<{ name: string; data: number[]; color: string; dashed?: boolean }>
  height?: number
  bare?: boolean
}

export default function LinePanel({ title, series, height = 260, bare = false }: LinePanelProps) {
  const theme = useTheme()
  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.palette.background.elevated,
      borderColor: theme.palette.divider,
      textStyle: { color: theme.palette.text.primary, fontSize: 12 },
    },
    legend: title ? { bottom: 0, textStyle: { color: theme.palette.text.secondary, fontSize: 11 } } : undefined,
    grid: { top: 12, right: 12, bottom: title ? 32 : 20, left: 40 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: series[0]?.data.length ?? 0 }, (_, i) => `${i}m`),
      axisLabel: { color: theme.palette.text.disabled, fontSize: 10 },
      axisLine: { lineStyle: { color: theme.palette.divider, width: 1 } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: theme.palette.divider, width: 1 } },
      axisLabel: { color: theme.palette.text.disabled, fontSize: 10 },
    },
    series: series.map((item) => ({
      name: item.name,
      type: 'line',
      data: item.data,
      smooth: false,
      symbol: 'none',
      lineStyle: { color: item.color, width: CHART_LINE_WIDTH, type: item.dashed ? 'dashed' : 'solid' },
    })),
  }), [series, theme, title])

  if (bare) {
    return <ReactECharts option={option} style={{ height, width: '100%' }} notMerge />
  }

  return (
    <Box sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: '4px', height: '100%' }}>
      {title && <Typography variant="h4" sx={{ mb: 0.75 }}>{title}</Typography>}
      <ReactECharts option={option} style={{ height }} notMerge />
    </Box>
  )
}
