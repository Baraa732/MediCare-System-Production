import { useMemo } from 'react'
import { Box, Grid } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import { BarChart3 } from 'lucide-react'
import { AdvancedPageHeader, AdvancedPanel, ObservabilityPage, PbiGrid } from '../../components/advanced/AdvancedPage'
import { usePlatformData } from '../../hooks/usePlatformData'
import { usePlatformStats } from '../../hooks/usePlatformStats'
import { chartBase, chartGrid, thinLineSeries } from '../../lib/chartTheme'
import type { Clinic, PlatformUser } from '../../api/types'

function buildCohortMatrix(clinics: Clinic[], users: PlatformUser[]) {
  const cohorts = new Map<string, { clinics: Clinic[]; users: PlatformUser[] }>()
  for (const clinic of clinics) {
    if (!clinic.createdAt) continue
    const d = new Date(clinic.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = cohorts.get(key) ?? { clinics: [], users: [] }
    entry.clinics.push(clinic)
    cohorts.set(key, entry)
  }
  for (const user of users) {
    if (!user.createdAt) continue
    const d = new Date(user.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = cohorts.get(key) ?? { clinics: [], users: [] }
    entry.users.push(user)
    cohorts.set(key, entry)
  }

  const labels = [...cohorts.keys()].sort().slice(-6)
  return labels.map((label) => {
    const { clinics: cList, users: uList } = cohorts.get(label)!
    const clinicActive = cList.filter((c) => c.status === 'ACTIVE').length
    const userActive = uList.filter((u) => u.status === 'ACTIVE').length
    const clinicRetention = cList.length ? Math.round((clinicActive / cList.length) * 100) : 0
    const userRetention = uList.length ? Math.round((userActive / uList.length) * 100) : 0
    return { label, clinicRetention, userRetention, size: cList.length + uList.length }
  })
}

function buildGeoDistribution(clinics: Clinic[]) {
  const map = new Map<string, number>()
  for (const clinic of clinics) {
    const region = clinic.governorate || clinic.city || 'Unknown'
    map.set(region, (map.get(region) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
}

function buildForecast(clinics: Clinic[]) {
  const daily = new Map<string, number>()
  for (const clinic of clinics) {
    if (!clinic.createdAt) continue
    const key = clinic.createdAt.slice(0, 10)
    daily.set(key, (daily.get(key) ?? 0) + 1)
  }
  const sorted = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b))
  const history = sorted.slice(-30).map(([, count]) => count)
  const labels = sorted.slice(-30).map(([date]) => date.slice(5))

  if (history.length < 3) {
    return { labels: [], history: [], forecast: [], forecastLabels: [] }
  }

  const n = history.length
  const sumX = history.reduce((s, _, i) => s + i, 0)
  const sumY = history.reduce((s, v) => s + v, 0)
  const sumXY = history.reduce((s, v, i) => s + i * v, 0)
  const sumX2 = history.reduce((s, _, i) => s + i * i, 0)
  const slope = (n * sumXY - sumX * sumY) / Math.max(1, n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const forecast: number[] = []
  const forecastLabels: string[] = []
  for (let i = 1; i <= 30; i += 1) {
    forecast.push(Math.max(0, Math.round(intercept + slope * (n - 1 + i))))
    const d = new Date()
    d.setDate(d.getDate() + i)
    forecastLabels.push(d.toISOString().slice(5, 10))
  }

  return { labels, history, forecast, forecastLabels }
}

export default function BusinessIntelligencePage() {
  const theme = useTheme()
  const { clinics, users } = usePlatformData()
  const { stats } = usePlatformStats()

  const cohorts = useMemo(() => buildCohortMatrix(clinics, users), [clinics, users])
  const geo = useMemo(() => buildGeoDistribution(clinics), [clinics])
  const forecast = useMemo(() => buildForecast(clinics), [clinics])

  const cohortOption = useMemo(() => ({
    ...chartBase(theme),
    grid: chartGrid(true),
    legend: { top: 0, textStyle: { color: theme.palette.text.secondary, fontSize: 11 } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: cohorts.map((c) => c.label), axisLabel: { color: theme.palette.text.disabled, fontSize: 10 } },
    yAxis: { type: 'value', max: 100, axisLabel: { color: theme.palette.text.disabled, fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: theme.palette.divider } } },
    series: [
      { name: 'Clinic Retention', type: 'bar', data: cohorts.map((c) => c.clinicRetention), itemStyle: { color: '#06b6d4', borderRadius: [2, 2, 0, 0] }, barMaxWidth: 18 },
      { name: 'User Retention', type: 'bar', data: cohorts.map((c) => c.userRetention), itemStyle: { color: '#8b5cf6', borderRadius: [2, 2, 0, 0] }, barMaxWidth: 18 },
    ],
  }), [cohorts, theme])

  const geoOption = useMemo(() => ({
    ...chartBase(theme),
    grid: chartGrid(true),
    xAxis: { type: 'value', splitLine: { lineStyle: { color: theme.palette.divider } }, axisLabel: { color: theme.palette.text.disabled, fontSize: 10 } },
    yAxis: { type: 'category', data: geo.map(([r]) => r), axisLabel: { color: theme.palette.text.secondary, fontSize: 10 } },
    series: [{ type: 'bar', data: geo.map(([, count]) => count), itemStyle: { color: '#10b981', borderRadius: [0, 2, 2, 0] }, barMaxWidth: 14 }],
  }), [geo, theme])

  const forecastOption = useMemo(() => {
    const allLabels = [...forecast.labels, ...forecast.forecastLabels]
    const historyPadded = [...forecast.history, ...Array(forecast.forecast.length).fill(null)]
    const forecastPadded = [...Array(forecast.history.length).fill(null), ...forecast.forecast]
    return {
      ...chartBase(theme),
      grid: chartGrid(),
      legend: { top: 0, textStyle: { color: theme.palette.text.secondary, fontSize: 11 } },
      xAxis: { type: 'category', data: allLabels, axisLabel: { color: theme.palette.text.disabled, fontSize: 9, interval: 4 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: theme.palette.divider } }, axisLabel: { color: theme.palette.text.disabled, fontSize: 10 } },
      series: [
        thinLineSeries('Actual', historyPadded as number[], '#06b6d4'),
        { ...thinLineSeries('Forecast', forecastPadded as number[], '#f59e0b'), lineStyle: { color: '#f59e0b', width: 1, type: 'dashed' } },
      ],
    }
  }, [forecast, theme])

  return (
    <ObservabilityPage>
      <AdvancedPageHeader
        title="Business Intelligence"
        eyebrow="Platform Analytics"
        description="Cohort retention, geographic clinic distribution, and 30-day growth forecast."
        icon={BarChart3}
        color="#8b5cf6"
        status={`${stats?.clinics.total ?? clinics.length} clinics`}
        compact
      />

      <PbiGrid spacing={1.5}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <AdvancedPanel title="Cohort Retention Matrix" caption="monthly signup cohorts · active retention %" dense>
            {cohorts.length ? (
              <ReactECharts option={cohortOption} style={{ height: 320 }} notMerge />
            ) : (
              <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>Cohort data requires createdAt on clinics and users.</Box>
            )}
          </AdvancedPanel>
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <AdvancedPanel title="Geographic Clinic Distribution" caption="by governorate / city" dense>
            {geo.length ? (
              <ReactECharts option={geoOption} style={{ height: 320 }} notMerge />
            ) : (
              <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>No location data on clinics yet.</Box>
            )}
          </AdvancedPanel>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <AdvancedPanel title="30-Day Growth Forecast" caption="linear projection from daily clinic signups" dense>
            {forecast.history.length >= 3 ? (
              <ReactECharts option={forecastOption} style={{ height: 340 }} notMerge />
            ) : (
              <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>Need at least 3 days of clinic signup history.</Box>
            )}
          </AdvancedPanel>
        </Grid>
      </PbiGrid>
    </ObservabilityPage>
  )
}
