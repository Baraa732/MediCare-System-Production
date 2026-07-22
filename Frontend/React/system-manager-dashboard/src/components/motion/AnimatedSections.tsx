import { Box, Grid } from '@mui/material'
import type { ReactNode } from 'react'
import { MotionReveal } from './MotionReveal'

export function MotionMetric({ children, index }: { children: ReactNode; index: number }) {
  return (
    <MotionReveal pageSection="metric" index={index} variant="scaleIn" staggerStep={0.06}>
      {children}
    </MotionReveal>
  )
}

export function MotionPanel({ children, index = 0 }: { children: ReactNode; index?: number }) {
  return (
    <MotionReveal index={index} variant="fadeUp" staggerStep={0.09}>
      <Box sx={{ height: '100%' }}>{children}</Box>
    </MotionReveal>
  )
}

export function MotionHeader({ children }: { children: ReactNode }) {
  return (
    <MotionReveal pageSection="header" variant="slideRight" duration={0.65}>
      {children}
    </MotionReveal>
  )
}

export function MotionTabs({ children }: { children: ReactNode }) {
  return (
    <MotionReveal pageSection="tabs" variant="fadeUp" delay={0.2}>
      {children}
    </MotionReveal>
  )
}

export function MotionToolbar({ children }: { children: ReactNode }) {
  return (
    <MotionReveal pageSection="toolbar" variant="blurIn" delay={0.15}>
      {children}
    </MotionReveal>
  )
}

export function MotionMetricGridItem({
  children,
  index,
  size,
}: {
  children: ReactNode
  index: number
  size: React.ComponentProps<typeof Grid>['size']
}) {
  return (
    <Grid size={size}>
      <MotionMetric index={index}>{children}</MotionMetric>
    </Grid>
  )
}
