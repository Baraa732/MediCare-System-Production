import { motion } from 'framer-motion'
import { KeyRound, ShieldCheck } from 'lucide-react'

type ConsoleMode = 'provision' | 'manage'

type ConsoleModeSwitchProps = {
  mode: ConsoleMode
  onChange: (mode: ConsoleMode) => void
}

export default function ConsoleModeSwitch({ mode, onChange }: ConsoleModeSwitchProps) {
  return (
    <div className="ac-mode" role="tablist" aria-label="Activation console mode">
      <motion.div
        className="ac-mode-thumb"
        animate={{ x: mode === 'provision' ? 0 : '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      />
      <button
        type="button"
        className="ac-mode-btn"
        role="tab"
        aria-selected={mode === 'provision'}
        data-active={mode === 'provision'}
        onClick={() => onChange('provision')}
      >
        <ShieldCheck size={15} />
        Provision
      </button>
      <button
        type="button"
        className="ac-mode-btn"
        role="tab"
        aria-selected={mode === 'manage'}
        data-active={mode === 'manage'}
        onClick={() => onChange('manage')}
      >
        <KeyRound size={15} />
        Manage
      </button>
    </div>
  )
}

export type { ConsoleMode }
