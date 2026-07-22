import { memo, useMemo } from 'react'
import { Box, Grid } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ReactECharts from 'echarts-for-react'
import { AdvancedPanel } from '../../../components/advanced/AdvancedPage'
import { DashboardEntrance, dashboardStaggerDelay } from '../../../components/motion/DashboardEntrance'
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

  const panels = [
    {
      size: { xs: 12, lg: 5 } as const,
      title: 'Request throughput',
      caption: 'Top services · live buckets',
      bodyPadding: { p: 1.25, pt: 0 },
      option: throughputOption,
    },
    {
      size: { xs: 12, md: 6, lg: 3 } as const,
      title: 'Error hotspots',
      caption: 'Grouped by service',
      bodyPadding: { p: 1.25, pt: 0 },
      option: errorOption,
    },
    {
      size: { xs: 12, md: 6, lg: 2 } as const,
      title: 'Platform health',
      caption: `${availability}% availability`,
      bodyPadding: { p: 0.5, pt: 0 },
      option: gaugeOption,
    },
    {
      size: { xs: 12, lg: 2 } as const,
      title: 'Service mix',
      caption: 'Health distribution',
      bodyPadding: { p: 1.25, pt: 0 },
      option: donutOption,
    },
  ]

  return (
    <Grid container spacing={1.5}>
      {panels.map((panel, index) => (
        <Grid key={panel.title} size={panel.size}>
          <DashboardEntrance delay={dashboardStaggerDelay(0, index, 65)} variant="scaleIn">
            <AdvancedPanel
              title={panel.title}
              caption={panel.caption}
              dense
              bodySx={panel.bodyPadding}
            >
              <Box sx={{ height: 212 }}>
                <ReactECharts
                  option={panel.option}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                  lazyUpdate
                />
              </Box>
            </AdvancedPanel>
          </DashboardEntrance>
        </Grid>
      ))}
    </Grid>
  )
}

export default memo(LiveTelemetryRow)
