import { useRef, type ReactNode } from 'react'
import { Box } from '@mui/material'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { MOTION, prefersReducedMotion } from './motionPrefs'

gsap.registerPlugin(useGSAP)

type PageMotionProps = {
  children: ReactNode
  /** Re-run entrance when route key changes (e.g. pathname). */
  motionKey?: string
}

/**
 * Orchestrates page-level GSAP timelines for marked sections:
 * `[data-page-header]`, `[data-page-metric]`, `[data-page-tabs]`, `[data-page-toolbar]`, `[data-page-panel]`.
 */
export function PageMotion({ children, motionKey }: PageMotionProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return

      if (prefersReducedMotion()) {
        gsap.set(root.querySelectorAll('[data-page-header], [data-page-metric], [data-page-tabs], [data-page-toolbar], [data-page-panel]'), {
          opacity: 1,
          clearProps: 'transform,filter',
        })
        return
      }

      const tl = gsap.timeline({ defaults: { ease: MOTION.ease } })

      const header = root.querySelector('[data-page-header]')
      const metrics = root.querySelectorAll('[data-page-metric]')
      const tabs = root.querySelector('[data-page-tabs]')
      const toolbar = root.querySelector('[data-page-toolbar]')
      const panels = root.querySelectorAll('[data-page-panel]')

      if (header) {
        tl.from(header, { opacity: 0, x: -28, duration: MOTION.duration }, 0)
      }

      if (metrics.length) {
        tl.from(
          metrics,
          { opacity: 0, y: 22, scale: 0.94, duration: MOTION.durationFast, stagger: MOTION.staggerTight },
          header ? '-=0.35' : 0,
        )
      }

      if (tabs) {
        tl.from(tabs, { opacity: 0, y: 14, duration: MOTION.durationFast }, '-=0.25')
      }

      if (toolbar) {
        tl.from(toolbar, { opacity: 0, y: 16, duration: MOTION.durationFast }, '-=0.2')
      }

      if (panels.length) {
        tl.from(
          panels,
          { opacity: 0, y: 32, scale: 0.97, duration: MOTION.duration, stagger: MOTION.stagger },
          '-=0.15',
        )
      }
    },
    { scope: rootRef, dependencies: [motionKey] },
  )

  return (
    <Box ref={rootRef} sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {children}
    </Box>
  )
}
