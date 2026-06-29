import { useMemo } from 'react'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@mui/material/styles'
import type { PlatformObservability } from '../../../api/types'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

interface LatencyChartProps {
  latencySeries: PlatformObservability['apm']['latencySeries']
}

export default function LatencyChart({ latencySeries }: LatencyChartProps) {
  const theme = useTheme()

  const option = useMemo(() => {
    const colors = ['#06b6d4', '#10b981', '#8b5cf6', '#f59e0b']
    const series = latencySeries.slice(0, 2).flatMap((item, index) => [
      { name: `${item.name} P50`, type: 'line', data: item.p50, smooth: true, symbol: 'none', lineStyle: { color: colors[index], width: 2 } },
      { name: `${item.name} P95`, type: 'line', data: item.p95, smooth: true, symbol: 'none', lineStyle: { color: colors[index], width: 1, type: 'dashed' as const } },
    ])

    return {
      tooltip: { trigger: 'axis' as const, backgroundColor: theme.palette.background.elevated, borderColor: theme.palette.divider, textStyle: { color: theme.palette.text.primary, fontSize: 12 } },
      legend: { bottom: 0, textStyle: { color: theme.palette.text.secondary, fontSize: 12 } },
      grid: { top: 16, right: 16, bottom: 36, left: 48 },
      xAxis: { type: 'category' as const, data: Array.from({ length: latencySeries[0]?.p50.length ?? 60 }, (_, i) => `${i}m`), axisLabel: { color: theme.palette.text.disabled, fontSize: 11 }, axisLine: { lineStyle: { color: theme.palette.divider } } },
      yAxis: { type: 'value' as const, name: 'ms', splitLine: { lineStyle: { color: theme.palette.divider } }, axisLabel: { color: theme.palette.text.disabled, fontSize: 11 }, nameTextStyle: { color: theme.palette.text.disabled } },
      series,
    }
  }, [latencySeries, theme])

  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: 280 }} notMerge />
}
