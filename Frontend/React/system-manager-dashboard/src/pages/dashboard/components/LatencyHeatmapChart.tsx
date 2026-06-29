import { memo, useMemo } from 'react'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import type { ApmService } from '../../../api/types'
import { chartBase } from '../../../lib/chartTheme'

function LatencyHeatmapChart({ services }: { services: ApmService[] }) {
  const theme = useTheme()
  const option = useMemo(() => {
    const rows = services.slice(0, 8)
    const maxLen = Math.max(0, ...rows.map((s) => s.series?.length ?? 0))
    const bucketCount = Math.min(12, maxLen || 12)
    const yLabels = rows.map((s) => s.name)
    const xLabels = Array.from({ length: bucketCount }, (_, i) => `-${bucketCount - i}m`)

    const data: [number, number, number][] = []
    let maxVal = 1
    rows.forEach((service, yIndex) => {
      const series = service.series ?? []
      for (let x = 0; x < bucketCount; x += 1) {
        const idx = Math.max(0, series.length - bucketCount + x)
        const val = series[idx] ?? service.p95 ?? 0
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
          return `${yLabels[y]} · ${xLabels[x]}: ${val}ms`
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
  }, [services, theme])

  if (!services.length) return null

  return <ReactECharts option={option} style={{ height: 240 }} notMerge />
}

export default memo(LatencyHeatmapChart)
