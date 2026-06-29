import { useMemo } from 'react'
import { Card, CardContent, CardHeader, Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

interface DonutChartProps {
  title: string
  data: { name: string; value: number }[]
  height?: number
}

export default function DonutChart({ title, data, height = 240 }: DonutChartProps) {
  const theme = useTheme()
  const palette = theme.palette.chart.colors

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: theme.palette.background.elevated,
        borderColor: theme.palette.divider,
        textStyle: { color: theme.palette.text.primary, fontSize: 12 },
      },
      legend: {
        type: 'scroll' as const,
        orient: 'horizontal' as const,
        bottom: 0,
        textStyle: { color: theme.palette.text.secondary, fontSize: 11 },
        icon: 'circle',
      },
      series: [
        {
          type: 'pie',
          radius: ['52%', '74%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: false,
          itemStyle: { borderColor: theme.palette.background.paper, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: data.map((d, i) => ({
            name: d.name.replace(/_/g, ' '),
            value: d.value,
            itemStyle: { color: palette[i % palette.length] },
          })),
        },
      ],
    }),
    [theme, data, palette],
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
