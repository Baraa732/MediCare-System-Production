import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { MOTION, prefersReducedMotion } from './motionPrefs'

gsap.registerPlugin(useGSAP)

/** Advanced GSAP timeline for the login split layout. */
export function useLoginMotion() {
  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const root = rootRef.current
      if (!root || prefersReducedMotion()) return

      const left = root.querySelector('[data-login-left]')
      const right = root.querySelector('[data-login-right]')
      const card = root.querySelector('[data-login-card]')
      const lottie = root.querySelector('[data-login-lottie]')
      const eyebrow = root.querySelector('[data-login-eyebrow]')
      const headline = root.querySelector('[data-login-headline]')
      const subcopy = root.querySelector('[data-login-subcopy]')
      const caps = root.querySelectorAll('[data-login-cap]')
      const formTitle = root.querySelectorAll('[data-login-form-title]')
      const formFields = root.querySelectorAll('[data-login-field]')
      const formBtn = root.querySelector('[data-login-submit]')
      const formFooter = root.querySelectorAll('[data-login-footer]')

      const tl = gsap.timeline({ defaults: { ease: MOTION.easeSmooth } })

      if (left) {
        tl.from(left, { opacity: 0, x: -48, duration: MOTION.durationSlow }, 0)
      }

      if (lottie) {
        tl.from(lottie, { opacity: 0, scale: 0.82, rotate: -6, duration: MOTION.durationSlow, ease: MOTION.easeElastic }, 0.15)
      }

      if (eyebrow) {
        tl.from(eyebrow, { opacity: 0, y: 16, letterSpacing: '0.3em', duration: MOTION.durationFast }, 0.35)
      }

      if (headline) {
        tl.from(headline, { opacity: 0, y: 28, duration: MOTION.duration }, 0.45)
      }

      if (subcopy) {
        tl.from(subcopy, { opacity: 0, y: 20, filter: 'blur(6px)', duration: MOTION.durationFast }, 0.55)
      }

      if (caps.length) {
        tl.from(
          caps,
          { opacity: 0, x: -24, scale: 0.96, duration: MOTION.durationFast, stagger: 0.07 },
          0.65,
        )
      }

      if (right) {
        tl.from(right, { opacity: 0, x: 40, duration: MOTION.duration }, 0.2)
      }

      if (card) {
        tl.from(
          card,
          {
            opacity: 0,
            y: 48,
            scale: 0.92,
            rotateX: 10,
            transformPerspective: 1000,
            duration: MOTION.durationSlow,
            ease: MOTION.easeElastic,
          },
          0.35,
        )
      }

      if (formTitle.length) {
        tl.from(formTitle, { opacity: 0, y: 14, duration: MOTION.durationFast, stagger: 0.06 }, 0.7)
      }

      if (formFields.length) {
        tl.from(
          formFields,
          { opacity: 0, y: 18, x: 12, duration: MOTION.durationFast, stagger: 0.08 },
          0.82,
        )
      }

      if (formBtn) {
        tl.from(formBtn, { opacity: 0, y: 16, scale: 0.94, duration: MOTION.durationFast, ease: MOTION.easeElastic }, 1.05)
      }

      if (formFooter.length) {
        tl.from(formFooter, { opacity: 0, y: 10, duration: MOTION.durationFast, stagger: 0.05 }, 1.15)
      }
    },
    { scope: rootRef },
  )

  return rootRef
}
