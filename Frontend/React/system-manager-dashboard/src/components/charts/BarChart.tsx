import { useMemo } from 'react'
import { Card, CardContent, CardHeader, Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { BarChart as EBarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([EBarChart, GridComponent, TooltipComponent, CanvasRenderer])

interface BarChartProps {
  title: string
  data: { name: string; value: number }[]
  color?: string
  height?: number
}

export default function BarChart({ title, data, color, height = 240 }: BarChartProps) {
  const theme = useTheme()
  const barColor = color ?? theme.palette.primary.main

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: theme.palette.background.elevated,
        borderColor: theme.palette.divider,
        textStyle: { color: theme.palette.text.primary, fontSize: 12 },
      },
      grid: { top: 16, right: 16, bottom: 28, left: 40 },
      xAxis: {
        type: 'category' as const,
        data: data.map((d) => d.name.replace(/_/g, ' ')),
        axisLine: { lineStyle: { color: theme.palette.divider } },
        axisLabel: { color: theme.palette.text.disabled, fontSize: 11, interval: 0 },
      },
      yAxis: {
        type: 'value' as const,
        minInterval: 1,
        splitLine: { lineStyle: { color: theme.palette.divider } },
        axisLabel: { color: theme.palette.text.disabled, fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: data.map((d) => d.value),
          barWidth: '46%',
          itemStyle: { color: barColor, borderRadius: [3, 3, 0, 0] },
        },
      ],
    }),
    [theme, data, barColor],
  )

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader title={title} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }} />
      <CardContent>
        {data.length === 0 ? (
          <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption2" sx={{ color: 'text.disabled' }}>No data</Typography>
          </Box>
        ) : (
          <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge />
        )}
      </CardContent>
    </Card>
  )
}
