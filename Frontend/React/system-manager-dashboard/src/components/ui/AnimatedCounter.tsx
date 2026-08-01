import { useEffect, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

interface Props {
  value: number
  decimals?: number
  suffix?: string
  prefix?: string
}

export default function AnimatedCounter({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
}: Props) {
  const reduced = usePrefersReducedMotion()
  const spring = useSpring(reduced ? value : 0, { stiffness: 70, damping: 18 })
  const display = useTransform(spring, (v) => {
    const n = Number(v.toFixed(decimals))
    return `${prefix}${n.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`
  })
  const [text, setText] = useState(
    `${prefix}${value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`,
  )

  useEffect(() => {
    if (reduced) {
      setText(
        `${prefix}${value.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix}`,
      )
      return
    }
    spring.set(value)
  }, [spring, value, reduced, prefix, suffix, decimals])

  useEffect(() => {
    if (reduced) return
    const unsub = display.on('change', (v) => setText(v))
    return () => unsub()
  }, [display, reduced])

  return <motion.span>{text}</motion.span>
}
