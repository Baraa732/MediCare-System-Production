import { useRef, type ReactNode } from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { MOTION, prefersReducedMotion } from './motionPrefs'
import { motionFrom, motionTo, type MotionVariant } from './variants'

gsap.registerPlugin(useGSAP)

export type MotionRevealProps = {
  children: ReactNode
  variant?: MotionVariant
  /** Seconds — used when `index` is not set. */
  delay?: number
  /** Stagger index — delay = index * staggerStep. */
  index?: number
  staggerStep?: number
  duration?: number
  sx?: SxProps<Theme>
  className?: string
  /** Marks element for PageMotion batch targeting. */
  pageSection?: 'header' | 'metric' | 'panel' | 'tabs' | 'toolbar'
}

/** GSAP entrance for a single block (respects reduced motion). */
export function MotionReveal({
  children,
  variant = 'fadeUp',
  delay = 0,
  index,
  staggerStep = MOTION.stagger,
  duration = MOTION.duration,
  sx,
  className,
  pageSection,
}: MotionRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const computedDelay = index !== undefined ? index * staggerStep : delay
  const sectionAttr = pageSection ? { [`data-page-${pageSection}`]: '' } : {}

  useGSAP(
    () => {
      const el = ref.current
      if (!el || pageSection) return

      if (prefersReducedMotion()) {
        gsap.set(el, motionTo)
        return
      }

      gsap.fromTo(
        el,
        motionFrom[variant],
        {
          ...motionTo,
          duration,
          delay: computedDelay,
          ease: variant === 'popIn' ? MOTION.easeElastic : MOTION.ease,
        },
      )
    },
    { scope: ref, dependencies: [variant, computedDelay, duration, pageSection] },
  )

  return (
    <Box
      ref={ref}
      className={className}
      sx={{ willChange: 'opacity, transform', ...sx }}
      {...sectionAttr}
    >
      {children}
    </Box>
  )
}
