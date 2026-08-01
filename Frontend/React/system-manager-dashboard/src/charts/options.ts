import type { EChartsOption } from 'echarts'
import { CC_CHART, baseTooltip } from './chartTokens'

export function sparklineOption(
  data: number[],
  color: string = CC_CHART.cyan,
): EChartsOption {
  return {
    grid: { left: 0, right: 0, top: 2, bottom: 2 },
    xAxis: { type: 'category', show: false, data: data.map((_, i) => i) },
    yAxis: { type: 'value', show: false, min: 'dataMin', max: 'dataMax' },
    series: [
      {
        type: 'line',
        data,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.6, color },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}55` },
              { offset: 1, color: `${color}00` },
            ],
          },
        },
      },
    ],
  }
}

export function multiLineOption(params: {
  labels: string[]
  series: Array<{ name: string; data: number[]; color: string }>
}): EChartsOption {
  return {
    color: params.series.map((s) => s.color),
    tooltip: { ...baseTooltip(), trigger: 'axis' },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: CC_CHART.text, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 6,
    },
    grid: { left: 36, right: 12, top: 28, bottom: 24 },
    xAxis: {
      type: 'category',
      data: params.labels,
      axisLine: { lineStyle: { color: CC_CHART.grid } },
      axisLabel: { color: CC_CHART.text, fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: CC_CHART.grid } },
      axisLabel: { color: CC_CHART.text, fontSize: 10 },
      axisLine: { show: false },
    },
    series: params.series.map((s) => ({
      name: s.name,
      type: 'line' as const,
      data: s.data,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: s.color },
    })),
  }
}

export function horizontalBarOption(params: {
  labels: string[]
  values: number[]
  color?: string
}): EChartsOption {
  const color: string = params.color ?? CC_CHART.cyan
  return {
    tooltip: {
      ...baseTooltip(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: { left: 100, right: 28, top: 8, bottom: 8 },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: CC_CHART.grid } },
      axisLabel: {
        color: CC_CHART.text,
        fontSize: 10,
        formatter: (v: number) =>
          v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
      },
    },
    yAxis: {
      type: 'category',
      data: params.labels,
      axisLabel: { color: CC_CHART.textStrong, fontSize: 11 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: params.values,
        barWidth: 12,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: `${color}99` },
              { offset: 1, color },
            ],
          },
        },
      },
    ],
  }
}

export function gaugeOption(value: number, color: string = CC_CHART.cyan): EChartsOption {
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        radius: '92%',
        progress: {
          show: true,
          width: 12,
          itemStyle: { color },
        },
        axisLine: {
          lineStyle: {
            width: 12,
            color: [[1, '#1f2535']],
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          color: CC_CHART.textStrong,
          fontSize: 22,
          fontWeight: 700,
          offsetCenter: [0, '8%'],
        },
        title: {
          offsetCenter: [0, '36%'],
          color: CC_CHART.text,
          fontSize: 11,
        },
        data: [{ value, name: 'Load' }],
      },
    ],
  }
}

export function areaDualOption(params: {
  labels: string[]
  a: { name: string; data: number[]; color: string }
  b: { name: string; data: number[]; color: string }
}): EChartsOption {
  return {
    tooltip: { ...baseTooltip(), trigger: 'axis' },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: CC_CHART.text, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 6,
    },
    grid: { left: 36, right: 12, top: 28, bottom: 24 },
    xAxis: {
      type: 'category',
      data: params.labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: CC_CHART.grid } },
      axisLabel: { color: CC_CHART.text, fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: CC_CHART.grid } },
      axisLabel: { color: CC_CHART.text, fontSize: 10 },
      axisLine: { show: false },
    },
    series: [params.a, params.b].map((s) => ({
      name: s.name,
      type: 'line' as const,
      data: s.data,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: s.color },
      areaStyle: {
        color: {
          type: 'linear' as const,
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: `${s.color}40` },
            { offset: 1, color: `${s.color}00` },
          ],
        },
      },
    })),
  }
}
