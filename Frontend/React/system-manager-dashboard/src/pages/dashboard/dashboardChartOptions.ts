import type { Theme } from '@mui/material/styles'
import type { ApmService } from '../../api/types'

const CHART_PALETTE = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

export function buildThroughputOption(services: ApmService[], theme: Theme) {
  const isDark = theme.palette.mode === 'dark'
  const top = [...services]
    .sort((a, b) => b.reqRate - a.reqRate)
    .slice(0, 5)
    .filter((s) => s.series?.length)

  const maxLen = Math.max(0, ...top.map((s) => s.series.length))
  const labels = Array.from({ length: maxLen }, (_, i) => `T-${maxLen - i}`)

  return {
    color: CHART_PALETTE,
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#161b27' : '#ffffff',
      borderColor: theme.palette.divider,
      textStyle: { color: theme.palette.text.primary, fontSize: 12 },
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: theme.palette.text.secondary, fontSize: 10 },
      itemWidth: 10,
      itemHeight: 8,
    },
    grid: { top: 28, left: 40, right: 12, bottom: 24 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: theme.palette.divider } },
      axisLabel: { color: theme.palette.text.secondary, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } },
      axisLabel: { color: theme.palette.text.secondary, fontSize: 10 },
    },
    series: top.map((service) => ({
      name: service.name,
      type: 'line',
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.12 },
      lineStyle: { width: 2 },
      data: service.series,
    })),
  }
}

export function buildErrorBarOption(
  errors: Array<{ service: string; count: number }>,
  theme: Theme,
) {
  const isDark = theme.palette.mode === 'dark'
  const sorted = [...errors].sort((a, b) => b.count - a.count).slice(0, 8)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDark ? '#161b27' : '#ffffff',
      borderColor: theme.palette.divider,
      textStyle: { color: theme.palette.text.primary, fontSize: 12 },
    },
    grid: { top: 8, left: 88, right: 16, bottom: 8 },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } },
      axisLabel: { color: theme.palette.text.secondary, fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: sorted.map((e) => e.service),
      axisLabel: {
        color: theme.palette.text.secondary,
        fontSize: 10,
        width: 72,
        overflow: 'truncate',
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: sorted.map((e) => e.count),
      barWidth: 12,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 1,
          y2: 0,
          colorStops: [
            { offset: 0, color: '#ef4444' },
            { offset: 1, color: '#f97316' },
          ],
        },
      },
    }],
  }
}

export function buildHealthGaugeOption(score: number, theme: Theme) {
  const color = score >= 85 ? '#10b981' : score >= 65 ? '#f59e0b' : '#ef4444'

  return {
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      splitNumber: 5,
      radius: '92%',
      center: ['50%', '58%'],
      axisLine: {
        lineStyle: {
          width: 14,
          color: [
            [0.65, '#ef4444'],
            [0.85, '#f59e0b'],
            [1, '#10b981'],
          ],
        },
      },
      pointer: { show: true, length: '58%', width: 5, itemStyle: { color } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        valueAnimation: true,
        fontSize: 28,
        fontWeight: 700,
        color: theme.palette.text.primary,
        offsetCenter: [0, '28%'],
        formatter: '{value}',
      },
      title: {
        offsetCenter: [0, '52%'],
        fontSize: 11,
        color: theme.palette.text.secondary,
      },
      data: [{ value: score, name: 'Health Score' }],
    }],
    backgroundColor: 'transparent',
  }
}

export function buildServiceDonutOption(services: ApmService[], theme: Theme) {
  const isDark = theme.palette.mode === 'dark'
  const healthy = services.filter((s) => s.status === 'healthy').length
  const degraded = services.filter((s) => s.status === 'degraded').length
  const down = services.filter((s) => s.status === 'down').length

  const data = [
    { name: 'Healthy', value: healthy, itemStyle: { color: '#10b981' } },
    { name: 'Degraded', value: degraded, itemStyle: { color: '#f59e0b' } },
    { name: 'Down', value: down, itemStyle: { color: '#ef4444' } },
  ].filter((d) => d.value > 0)

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark ? '#161b27' : '#ffffff',
      borderColor: theme.palette.divider,
      textStyle: { color: theme.palette.text.primary, fontSize: 12 },
    },
    legend: {
      bottom: 0,
      textStyle: { color: theme.palette.text.secondary, fontSize: 10 },
      itemWidth: 8,
      itemHeight: 8,
    },
    series: [{
      type: 'pie',
      radius: ['50%', '72%'],
      center: ['50%', '44%'],
      label: { show: false },
      itemStyle: { borderWidth: 2, borderColor: theme.palette.background.paper },
      data: data.length ? data : [{ name: 'No services', value: 1, itemStyle: { color: theme.palette.divider } }],
    }],
  }
}
