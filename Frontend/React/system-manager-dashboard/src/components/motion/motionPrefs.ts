/** Respect OS reduced-motion preference. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const MOTION = {
  duration: 0.62,
  durationFast: 0.45,
  durationSlow: 0.85,
  stagger: 0.075,
  staggerTight: 0.055,
  ease: 'power3.out',
  easeElastic: 'back.out(1.4)',
  easeSmooth: 'power4.out',
} as const
