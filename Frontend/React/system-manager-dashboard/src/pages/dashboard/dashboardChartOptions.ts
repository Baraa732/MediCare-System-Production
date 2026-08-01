import type { Theme } from '@mui/material/styles'
import type { ApmService, PlatformThroughput } from '../../api/types'

const CHART_PALETTE = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899']

function formatClockLabel(iso: string, dense: boolean): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(dense ? {} : { second: '2-digit' }),
  })
}

function resolveTimestamps(services: ApmService[], throughput?: PlatformThroughput): string[] {
  if (throughput?.timestamps?.length) return throughput.timestamps
  const fromService = services.find((s) => s.seriesTimestamps?.length)?.seriesTimestamps
  if (fromService?.length) return fromService
  const maxLen = Math.max(0, ...services.map((s) => s.series?.length ?? 0))
  const now = Date.now()
  const step = 60_000
  return Array.from({ length: maxLen }, (_, i) => new Date(now - (maxLen - 1 - i) * step).toISOString())
}

export function buildThroughputOption(
  services: ApmService[],
  theme: Theme,
  throughput?: PlatformThroughput,
) {
  const isDark = theme.palette.mode === 'dark'
  const timestamps = resolveTimestamps(services, throughput)
  const top = [...services]
    .filter((s) => (s.series?.length ?? 0) > 0 || s.reqRate > 0)
    .sort((a, b) => b.reqRate - a.reqRate)
    .slice(0, 6)

  const labels = timestamps.map((ts, i) => {
    const show = i === 0 || i === timestamps.length - 1 || i % Math.max(1, Math.floor(timestamps.length / 8)) === 0
    return show ? formatClockLabel(ts, true) : ''
  })

  const totalSeries = throughput?.total?.length
    ? throughput.total
    : Array.from({ length: timestamps.length }, (_, i) =>
        Math.round(top.reduce((sum, s) => sum + (s.series?.[i] ?? 0), 0) * 100) / 100,
      )

  const errorSeries = throughput?.errors?.length
    ? throughput.errors
    : Array.from({ length: timestamps.length }, (_, i) =>
        Math.round(top.reduce((sum, s) => sum + (s.errorSeries?.[i] ?? 0), 0) * 100) / 100,
      )

  const peak = throughput?.peak
    ?? totalSeries.reduce((best, v) => (v > best ? v : best), 0)
  const peakIndex = totalSeries.indexOf(peak)

  return {
    color: CHART_PALETTE,
    animationDuration: 400,
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#161b27' : '#ffffff',
      borderColor: theme.palette.divider,
      textStyle: { color: theme.palette.text.primary, fontSize: 12 },
      formatter: (params: Array<{ seriesName: string; value: number; axisValueLabel: string; color: string; dataIndex: number }>) => {
        if (!Array.isArray(params) || !params.length) return ''
        const idx = params[0].dataIndex
        const clock = timestamps[idx] ? formatClockLabel(timestamps[idx], false) : params[0].axisValueLabel
        const rows = params
          .filter((p) => typeof p.value === 'number')
          .map((p) => `${p.seriesName}: <b>${Number(p.value).toFixed(2)}</b> req/s`)
          .join('<br/>')
        return `${clock}<br/>${rows}`
      },
    },
    legend: {
      top: 0,
      right: 0,
      type: 'scroll',
      textStyle: { color: theme.palette.text.secondary, fontSize: 10 },
      itemWidth: 10,
      itemHeight: 8,
    },
    grid: { top: 36, left: 48, right: 48, bottom: 48 },
    dataZoom: [
      {
        type: 'inside',
        start: Math.max(0, 100 - Math.min(100, Math.round((20 / Math.max(timestamps.length, 1)) * 100))),
        end: 100,
        zoomOnMouseWheel: true,
      },
      {
        type: 'slider',
        height: 16,
        bottom: 4,
        borderColor: theme.palette.divider,
        fillerColor: isDark ? 'rgba(6,182,212,0.18)' : 'rgba(6,182,212,0.12)',
        handleStyle: { color: '#06b6d4' },
        textStyle: { color: theme.palette.text.disabled, fontSize: 9 },
      },
    ],
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels.length ? labels : timestamps.map((_, i) => String(i)),
      axisLine: { lineStyle: { color: theme.palette.divider } },
      axisLabel: { color: theme.palette.text.secondary, fontSize: 10 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'req/s',
        nameTextStyle: { color: theme.palette.text.disabled, fontSize: 10 },
        splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } },
        axisLabel: { color: theme.palette.text.secondary, fontSize: 10 },
      },
      {
        type: 'value',
        name: 'errors',
        nameTextStyle: { color: theme.palette.text.disabled, fontSize: 10 },
        splitLine: { show: false },
        axisLabel: { color: '#ef4444', fontSize: 10 },
      },
    ],
    series: [
      ...top.map((service) => ({
        name: service.name.replace(/-service$/, ''),
        type: 'line',
        smooth: true,
        showSymbol: false,
        stack: 'throughput',
        areaStyle: { opacity: 0.18 },
        lineStyle: { width: 1.5 },
        emphasis: { focus: 'series' },
        data: service.series ?? [],
      })),
      {
        name: 'Platform total',
        type: 'line',
        smooth: true,
        showSymbol: false,
        yAxisIndex: 0,
        z: 5,
        lineStyle: { width: 2.5, color: '#e2e8f0', type: 'solid' },
        itemStyle: { color: '#e2e8f0' },
        data: totalSeries,
        markPoint: peakIndex >= 0 && peak > 0
          ? {
              symbol: 'pin',
              symbolSize: 36,
              data: [{ name: 'Peak', value: peak, xAxis: peakIndex, yAxis: peak }],
              label: { formatter: '{c}', fontSize: 10, color: '#fff' },
              itemStyle: { color: '#06b6d4' },
            }
          : undefined,
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', color: theme.palette.text.disabled, width: 1 },
          data: [{ type: 'average', name: 'avg' }],
          label: { formatter: 'avg {c}', fontSize: 9, color: theme.palette.text.disabled },
        },
      },
      {
        name: '5xx rate',
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 6,
        itemStyle: { color: 'rgba(239,68,68,0.55)', borderRadius: [2, 2, 0, 0] },
        data: errorSeries,
      },
    ],
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
