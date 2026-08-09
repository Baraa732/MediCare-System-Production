import { motion } from 'framer-motion'
import { KeyRound, ShieldCheck } from 'lucide-react'

type ConsoleMode = 'provision' | 'manage'

type ConsoleModeSwitchProps = {
  mode: ConsoleMode
  onChange: (mode: ConsoleMode) => void
}

const OPTIONS: Array<{ id: ConsoleMode; label: string; icon: typeof ShieldCheck }> = [
  { id: 'provision', label: 'Provision', icon: ShieldCheck },
  { id: 'manage', label: 'Manage', icon: KeyRound },
]

export default function ConsoleModeSwitch({ mode, onChange }: ConsoleModeSwitchProps) {
  return (
    <div className="ac-mode" role="tablist" aria-label="Activation console mode">
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = mode === id
        return (
          <button
            key={id}
            type="button"
            className="ac-mode-btn"
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(id)}
          >
            {active && (
              <motion.span
                layoutId="ac-mode-pill"
                className="ac-mode-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <Icon size={15} />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export type { ConsoleMode }
