import { memo, useMemo } from 'react'
import { Box, Grid } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import { AdvancedPanel } from '../../../components/advanced/AdvancedPage'
import type { ApmService } from '../../../api/types'
import {
  buildErrorBarOption,
  buildHealthGaugeOption,
  buildServiceDonutOption,
  buildThroughputOption,
} from '../dashboardChartOptions'

interface LiveTelemetryRowProps {
  services: ApmService[]
  errors: Array<{ service: string; count: number; message: string }>
  healthScore: number
  availability: number
}

function LiveTelemetryRow({ services, errors, healthScore, availability }: LiveTelemetryRowProps) {
  const theme = useTheme()

  const throughputOption = useMemo(
    () => buildThroughputOption(services, theme),
    [services, theme],
  )
  const errorOption = useMemo(
    () => buildErrorBarOption(errors, theme),
    [errors, theme],
  )
  const gaugeOption = useMemo(
    () => buildHealthGaugeOption(healthScore, theme),
    [healthScore, theme],
  )
  const donutOption = useMemo(
    () => buildServiceDonutOption(services, theme),
    [services, theme],
  )

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, lg: 5 }}>
        <AdvancedPanel
          title="Request throughput"
          caption="Top services · live buckets"
          dense
          bodySx={{ p: 1.25, pt: 0 }}
        >
          <Box sx={{ height: 212 }}>
            <ReactECharts option={throughputOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} lazyUpdate />
          </Box>
        </AdvancedPanel>
      </Grid>
      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <AdvancedPanel
          title="Error hotspots"
          caption="Grouped by service"
          dense
          bodySx={{ p: 1.25, pt: 0 }}
        >
          <Box sx={{ height: 212 }}>
            <ReactECharts option={errorOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} lazyUpdate />
          </Box>
        </AdvancedPanel>
      </Grid>
      <Grid size={{ xs: 12, md: 6, lg: 2 }}>
        <AdvancedPanel
          title="Platform health"
          caption={`${availability}% availability`}
          dense
          bodySx={{ p: 0.5, pt: 0 }}
        >
          <Box sx={{ height: 212 }}>
            <ReactECharts option={gaugeOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} lazyUpdate />
          </Box>
        </AdvancedPanel>
      </Grid>
      <Grid size={{ xs: 12, lg: 2 }}>
        <AdvancedPanel
          title="Service mix"
          caption="Health distribution"
          dense
          bodySx={{ p: 1.25, pt: 0 }}
        >
          <Box sx={{ height: 212 }}>
            <ReactECharts option={donutOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} lazyUpdate />
          </Box>
        </AdvancedPanel>
      </Grid>
    </Grid>
  )
}

export default memo(LiveTelemetryRow)
