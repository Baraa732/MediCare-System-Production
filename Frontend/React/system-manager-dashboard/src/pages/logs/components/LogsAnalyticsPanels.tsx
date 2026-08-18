import { useMemo } from 'react'
import { Box, Grid } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import type { PlatformLogEntry, PlatformLogLevel, PlatformLogsHistogramBucket } from '../../../api/types'
import { AdvancedPanel, PbiGrid } from '../../../components/advanced/AdvancedPage'
import { buildLogFlowSankey, chartBase, chartGrid, flatBarSeries, thinLineSeries } from '../../../lib/chartTheme'
import { LOG_LEVEL_COLORS } from '../logUtils'
import LogsHistogram from './LogsHistogram'

interface LogsAnalyticsPanelsProps {
  histogram: PlatformLogsHistogramBucket[]
  services: Array<{ name: string; count: number }>
  levels: Array<{ level: PlatformLogLevel; count: number }>
  entries: PlatformLogEntry[]
}

function levelDonutOption(theme: Theme, levels: Array<{ level: PlatformLogLevel; count: number }>) {
  const data = levels.filter((l) => l.count > 0).map((l) => ({
    name: l.level,
    value: l.count,
    itemStyle: { color: LOG_LEVEL_COLORS[l.level] },
  }))

  return {
    ...chartBase(theme),
    legend: { bottom: 0, textStyle: { color: theme.palette.text.secondary, fontSize: 10 }, itemWidth: 8, itemHeight: 8 },
    series: [{
      type: 'pie',
      radius: ['50%', '68%'],
      center: ['50%', '42%'],
      label: { show: false },
      itemStyle: { borderWidth: 1, borderColor: theme.palette.background.paper },
      data: data.length ? data : [{ name: 'No data', value: 1, itemStyle: { color: theme.palette.divider } }],
    }],
  }
}

function serviceBarOption(theme: Theme, services: Array<{ name: string; count: number }>) {
  const top = [...services].sort((a, b) => b.count - a.count).slice(0, 8)
  return {
    ...chartBase(theme),
    grid: chartGrid(true),
    xAxis: { type: 'value', splitLine: { lineStyle: { color: theme.palette.divider, width: 1 } }, axisLabel: { color: theme.palette.text.disabled, fontSize: 10 } },
    yAxis: {
      type: 'category',
      data: top.map((s) => s.name).reverse(),
      axisLabel: { color: theme.palette.text.secondary, fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [flatBarSeries('Events', top.map((s) => s.count).reverse(), '#06b6d4')],
  }
}

function errorTrendOption(theme: Theme, histogram: PlatformLogsHistogramBucket[]) {
  const labels = histogram.map((b) => {
    const d = new Date(b.bucket)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  })

  return {
    ...chartBase(theme),
    legend: { top: 0, right: 0, textStyle: { color: theme.palette.text.secondary, fontSize: 10 }, itemWidth: 8, itemHeight: 8 },
    grid: chartGrid(),
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { fontSize: 10, color: theme.palette.text.disabled, interval: Math.max(0, Math.floor(labels.length / 6)) },
      axisLine: { lineStyle: { color: theme.palette.divider, width: 1 } },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 10, color: theme.palette.text.disabled }, splitLine: { lineStyle: { color: theme.palette.divider, width: 1 } } },
    series: [
      thinLineSeries('ERROR', histogram.map((b) => b.error), '#ef4444'),
      thinLineSeries('WARN', histogram.map((b) => b.warn), '#f59e0b'),
    ],
  }
}

export default function LogsAnalyticsPanels({ histogram, services, levels, entries }: LogsAnalyticsPanelsProps) {
  const theme = useTheme()

  const levelOption = useMemo(() => levelDonutOption(theme, levels), [levels, theme])
  const serviceOption = useMemo(() => serviceBarOption(theme, services), [services, theme])
  const trendOption = useMemo(() => errorTrendOption(theme, histogram), [histogram, theme])
  const sankeyOption = useMemo(
    () => ({
      ...chartBase(theme),
      ...buildLogFlowSankey(
        theme,
        services,
        levels.map((l) => ({ level: l.level, count: l.count })),
        entries.map((e) => ({ service: e.service, level: e.level })),
      ),
    }),
    [entries, levels, services, theme],
  )

  return (
    <PbiGrid spacing={1.5}>
      <Grid size={{ xs: 12, lg: 5 }}>
        <AdvancedPanel title="Log Volume Timeline" caption="Stacked severity distribution" dense>
          <LogsHistogram data={histogram} height={160} showLegend />
        </AdvancedPanel>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 2.5 }}>
        <AdvancedPanel title="Severity Mix" caption="Level composition" dense>
          <Box sx={{ height: 160 }}>
            <ReactECharts option={levelOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
          </Box>
        </AdvancedPanel>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 2.5 }}>
        <AdvancedPanel title="Error Trend" caption="ERROR vs WARN" dense>
          <Box sx={{ height: 160 }}>
            <ReactECharts option={trendOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
          </Box>
        </AdvancedPanel>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
        <AdvancedPanel title="Service → Severity" caption="Sankey flow" dense>
          <Box sx={{ height: 160 }}>
            <ReactECharts option={sankeyOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
          </Box>
        </AdvancedPanel>
      </Grid>
      <Grid size={{ xs: 12, lg: 7 }}>
        <AdvancedPanel title="Top Emitters" caption="Highest-volume services" dense>
          <Box sx={{ height: 150 }}>
            <ReactECharts option={serviceOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
          </Box>
        </AdvancedPanel>
      </Grid>
    </PbiGrid>
  )
}
