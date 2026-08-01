import { memo, useMemo } from 'react'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import type { ApmService } from '../../../api/types'
import { chartBase } from '../../../lib/chartTheme'

interface LatencyHeatmapChartProps {
  services: ApmService[]
  latencySeries?: Array<{ name: string; p50: number[]; p95: number[] }>
}

function LatencyHeatmapChart({ services, latencySeries = [] }: LatencyHeatmapChartProps) {
  const theme = useTheme()
  const option = useMemo(() => {
    const byName = new Map(latencySeries.map((row) => [row.name, row]))
    const rows = services.slice(0, 8)
    const sample = latencySeries.find((r) => r.p95.length)?.p95.length ?? 12
    const bucketCount = Math.min(12, sample || 12)
    const yLabels = rows.map((s) => s.name)
    const xLabels = Array.from({ length: bucketCount }, (_, i) => `-${bucketCount - i}`)

    const data: [number, number, number][] = []
    let maxVal = 1
    rows.forEach((service, yIndex) => {
      const latency = byName.get(service.name)
      const series = latency?.p95?.length ? latency.p95 : null
      for (let x = 0; x < bucketCount; x += 1) {
        let val = service.p95 ?? service.p50 ?? 0
        if (series) {
          const idx = Math.max(0, series.length - bucketCount + x)
          val = series[idx] ?? val
        }
        maxVal = Math.max(maxVal, val)
        data.push([x, yIndex, Math.round(val)])
      }
    })

    return {
      ...chartBase(theme),
      grid: { top: 8, right: 16, bottom: 28, left: 120 },
      tooltip: {
        ...chartBase(theme).tooltip,
        formatter: (params: { value: [number, number, number] }) => {
          const [x, y, val] = params.value
          return `${yLabels[y]} · ${xLabels[x]}: <b>${val} ms</b> p95`
        },
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        splitArea: { show: true },
        axisLabel: { color: theme.palette.text.disabled, fontSize: 9 },
      },
      yAxis: {
        type: 'category',
        data: yLabels,
        splitArea: { show: true },
        axisLabel: { color: theme.palette.text.secondary, fontSize: 10 },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 10,
        itemHeight: 80,
        inRange: { color: ['#0f766e', '#06b6d4', '#f59e0b', '#ef4444'] },
        textStyle: { color: theme.palette.text.disabled, fontSize: 10 },
      },
      series: [{
        type: 'heatmap',
        data,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.3)' } },
      }],
    }
  }, [latencySeries, services, theme])

  if (!services.length) return null

  return <ReactECharts option={option} style={{ height: 240 }} notMerge />
}

export default memo(LatencyHeatmapChart)
