import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { Fingerprint } from 'lucide-react'

type Orb = {
  label: string
  value: string
  hint: string
  mono?: boolean
  icon?: LucideIcon
}

type ConsoleHeroProps = {
  orbs: Orb[]
}

export default function ConsoleHero({ orbs }: ConsoleHeroProps) {
  return (
    <div className="ac-hero">
      <motion.section
        className="ac-hero-main"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="ac-hero-scan" />
        <div className="ac-kicker">
          <Fingerprint size={13} />
          Issuance console
        </div>
        <h1 className="ac-title">Clinic activation studio</h1>
        <p className="ac-subtitle">
          Generate single-use activation codes through a guided, animated pipeline —
          identity, compliance docs, geo pin, then cryptographic issue.
        </p>
      </motion.section>

      <div className="ac-orbits">
        {orbs.map((orb, index) => {
          const Icon = orb.icon
          return (
            <motion.div
              key={orb.label}
              className="ac-orb"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12 + index * 0.07, duration: 0.45 }}
            >
              <div className="ac-orb-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {Icon ? <Icon size={12} className="ac-orb-icon" /> : null}
                {orb.label}
              </div>
              <div className="ac-orb-value" data-mono={orb.mono ? 'true' : 'false'}>
                {orb.value}
              </div>
              <div className="ac-orb-hint">{orb.hint}</div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
