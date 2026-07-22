export type MotionVariant =
  | 'fadeUp'
  | 'scaleIn'
  | 'slideRight'
  | 'slideLeft'
  | 'blurIn'
  | 'flipIn'
  | 'popIn'

type GsapVars = {
  opacity?: number
  x?: number
  y?: number
  scale?: number
  rotateX?: number
  filter?: string
  transformPerspective?: number
  clearProps?: string
  letterSpacing?: string
}

export const motionFrom: Record<MotionVariant, GsapVars> = {
  fadeUp: { opacity: 0, y: 28 },
  scaleIn: { opacity: 0, scale: 0.94, y: 16 },
  slideRight: { opacity: 0, x: -32 },
  slideLeft: { opacity: 0, x: 32 },
  blurIn: { opacity: 0, y: 20, filter: 'blur(8px)' },
  flipIn: { opacity: 0, rotateX: -12, y: 24, transformPerspective: 900 },
  popIn: { opacity: 0, scale: 0.88, y: 12 },
}

export const motionTo: GsapVars = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotateX: 0,
  filter: 'blur(0px)',
  clearProps: 'transform,filter',
}
