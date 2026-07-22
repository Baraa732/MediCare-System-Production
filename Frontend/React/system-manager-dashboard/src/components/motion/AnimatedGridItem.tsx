import type { ReactNode } from 'react'
import Grid from '@mui/material/Grid'
import { DashboardEntrance, dashboardStaggerDelay } from './DashboardEntrance'

type GridSize = React.ComponentProps<typeof Grid>['size']

type AnimatedGridItemProps = {
  children: ReactNode
  index: number
  size: GridSize
  baseDelay: number
  variant?: React.ComponentProps<typeof DashboardEntrance>['variant']
}

export function AnimatedGridItem({
  children,
  index,
  size,
  baseDelay,
  variant = 'scaleIn',
}: AnimatedGridItemProps) {
  return (
    <Grid size={size}>
      <DashboardEntrance delay={dashboardStaggerDelay(baseDelay, index)} variant={variant}>
        {children}
      </DashboardEntrance>
    </Grid>
  )
}
