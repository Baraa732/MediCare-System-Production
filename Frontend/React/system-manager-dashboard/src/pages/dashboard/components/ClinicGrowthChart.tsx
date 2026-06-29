import { memo, useMemo } from 'react'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import type { Clinic } from '../../../api/types'
import { chartBase, chartGrid, thinLineSeries } from '../../../lib/chartTheme'

function buildGrowthSeries(clinics: Clinic[]) {
  const buckets = new Map<string, number>()
  for (const clinic of clinics) {
    if (!clinic.createdAt) continue
    const date = new Date(clinic.createdAt)
    if (Number.isNaN(date.getTime())) continue
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
  if (!sorted.length) return { labels: [] as string[], cumulative: [] as number[] }
  let running = 0
  const labels: string[] = []
  const cumulative: number[] = []
  for (const [key, count] of sorted) {
    running += count
    labels.push(key)
    cumulative.push(running)
  }
  return { labels, cumulative }
}

function ClinicGrowthChart({ clinics }: { clinics: Clinic[] }) {
  const theme = useTheme()
  const { labels, cumulative } = useMemo(() => buildGrowthSeries(clinics), [clinics])

  const option = useMemo(() => ({
    ...chartBase(theme),
    grid: chartGrid(true),
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: theme.palette.text.disabled, fontSize: 10 },
      axisLine: { lineStyle: { color: theme.palette.divider } },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: theme.palette.divider } },
      axisLabel: { color: theme.palette.text.disabled, fontSize: 10 },
    },
    series: cumulative.length
      ? [thinLineSeries('Active Clinics', cumulative, '#10b981')]
      : [],
  }), [cumulative, labels, theme])

  if (!cumulative.length) {
    return null
  }

  return <ReactECharts option={option} style={{ height: 220 }} notMerge />
}

export default memo(ClinicGrowthChart)
