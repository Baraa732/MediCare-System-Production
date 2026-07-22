import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'
import { MotionReveal, type MotionRevealProps } from './MotionReveal'

export const DASHBOARD_MOTION = {
  durationMs: 620,
  staggerMs: 75,
  headerDelayMs: 0,
  toolbarDelayMs: 90,
  kpiBaseDelayMs: 140,
  telemetryDelayMs: 320,
  gridBaseDelayMs: 380,
} as const

export type DashboardMotionVariant = MotionRevealProps['variant']

type DashboardEntranceProps = {
  children: ReactNode
  /** Delay in milliseconds (converted to GSAP seconds). */
  delay?: number
  variant?: DashboardMotionVariant
  sx?: SxProps<Theme>
  index?: number
}

function toSeconds(ms: number): number {
  return ms / 1000
}

/** GSAP staggered entrance for Command Center sections. */
export function DashboardEntrance({
  children,
  delay = 0,
  variant = 'fadeUp',
  sx,
  index,
}: DashboardEntranceProps) {
  const gsapDelay = index !== undefined ? undefined : toSeconds(delay)

  return (
    <MotionReveal
      variant={variant}
      delay={gsapDelay ?? 0}
      index={index}
      staggerStep={toSeconds(DASHBOARD_MOTION.staggerMs)}
      duration={toSeconds(DASHBOARD_MOTION.durationMs)}
      sx={sx}
    >
      {children}
    </MotionReveal>
  )
}

/** @deprecated Use seconds for GSAP delays; kept for stagger index math. */
export function dashboardStaggerDelay(
  base: number,
  index: number,
  step: number = DASHBOARD_MOTION.staggerMs,
) {
  return base + index * step
}
