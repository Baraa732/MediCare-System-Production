import { useMemo } from 'react'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, CanvasRenderer])

interface MetricChartProps {
  data: number[]
  color: string
  height?: number
  showArea?: boolean
}

export default function MetricChart({ data, color, height = 140 }: MetricChartProps) {
  const safeData = data.length ? data : [0]

  const option = useMemo(() => ({
    grid: { top: 4, right: 4, bottom: 16, left: 40 },
    xAxis: { show: false, data: safeData.map((_, i) => i) },
    yAxis: {
      show: false,
      min: Math.min(...safeData) * 0.9,
      max: Math.max(...safeData) * 1.1 || 1,
    },
    series: [{
      type: 'line',
      data: safeData,
      smooth: false,
      symbol: 'none',
      lineStyle: { color, width: 1 },
    }],
  }), [safeData, color])

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height }}
      notMerge
    />
  )
}
