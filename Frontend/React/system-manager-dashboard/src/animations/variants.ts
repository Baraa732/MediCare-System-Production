import type { Variants } from 'framer-motion'

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.28 } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
}

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.045, delayChildren: 0.06 },
  },
}

export const sidebarItemHover = {
  rest: { x: 0 },
  hover: { x: 2 },
}

export const pulseDot: Variants = {
  rest: { scale: 1, opacity: 1 },
  pulse: {
    scale: [1, 1.35, 1],
    opacity: [1, 0.55, 1],
    transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
  },
}
