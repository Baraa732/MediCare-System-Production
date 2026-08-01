import { useMemo } from 'react'
import { Box, Grid } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import type { PlatformLogLevel, PlatformLogsHistogramBucket } from '../../../api/types'
import { AdvancedPanel } from '../../../components/advanced/AdvancedPage'
import { LOG_LEVEL_COLORS } from '../logUtils'
import LogsHistogram from './LogsHistogram'

interface LogsChartsRowProps {
  histogram: PlatformLogsHistogramBucket[]
  levels: Array<{ level: PlatformLogLevel; count: number }>
}

export default function LogsChartsRow({ histogram, levels }: LogsChartsRowProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const donutOption = useMemo(() => {
    const data = levels
      .filter((l) => l.count > 0)
      .map((l) => ({
        name: l.level,
        value: l.count,
        itemStyle: { color: LOG_LEVEL_COLORS[l.level] },
      }))

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
        radius: ['48%', '68%'],
        center: ['50%', '44%'],
        label: { show: false },
        itemStyle: { borderWidth: 1, borderColor: theme.palette.background.paper },
        data: data.length ? data : [{ name: 'No data', value: 1, itemStyle: { color: theme.palette.divider } }],
      }],
    }
  }, [isDark, levels, theme.palette.background.paper, theme.palette.divider, theme.palette.text.primary, theme.palette.text.secondary])

  return (
    <Grid container spacing={1.5} sx={{ flexShrink: 0 }}>
      <Grid size={{ xs: 12, md: 7 }}>
        <AdvancedPanel title="Log volume" caption="Events per time bucket" dense bodySx={{ p: 1.25, pt: 0 }}>
          <LogsHistogram data={histogram} height={168} showLegend />
        </AdvancedPanel>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <AdvancedPanel title="Severity mix" caption="Level distribution" dense bodySx={{ p: 1.25, pt: 0 }}>
          <Box sx={{ height: 168 }}>
            <ReactECharts option={donutOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
          </Box>
        </AdvancedPanel>
      </Grid>
    </Grid>
  )
}
