import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Clock, Search, Zap } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { notify } from '../../lib/toast'
import { PageMotion } from '../../components/motion/PageMotion'
import ConsoleHero from '../../features/activation/console/ConsoleHero'
import ConsoleModeSwitch, {
  type ConsoleMode,
} from '../../features/activation/console/ConsoleModeSwitch'
import CodeLookupStudio from '../../features/activation/console/CodeLookupStudio'
import IssuedCodeTheater from '../../features/activation/console/IssuedCodeTheater'
import ProvisionStudio from '../../features/activation/console/ProvisionStudio'
import '../../features/activation/activationConsole.css'
import '../../features/activation/clinicLocationMap.css'

export default function ActivationCodes() {
  const token = useAuthStore((s) => s.token)
  const [mode, setMode] = useState<ConsoleMode>('provision')
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null)
  const [theaterOpen, setTheaterOpen] = useState(false)

  return (
    <PageMotion>
      <div className="ac-root">
        <div className="ac-shell">
          <ConsoleHero
            orbs={[
              {
                label: 'Last issued',
                value: issued?.code ?? '— — — — — —',
                hint: issued ? 'Ready to share securely' : 'Waiting for generation',
                mono: true,
                icon: Zap,
              },
              {
                label: 'Policy',
                value: '24h · single-use',
                hint: 'Revocation armed for pending',
                icon: Clock,
              },
              {
                label: 'Pipeline',
                value: '6 stages',
                hint: 'Identity → docs → geo → issue',
                icon: Search,
              },
              {
                label: 'Controls',
                value: 'Lookup + revoke',
                hint: 'Manage mode available',
                icon: Ban,
              },
            ]}
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <ConsoleModeSwitch mode={mode} onChange={setMode} />
          </motion.div>

          <AnimatePresence mode="wait">
            {mode === 'provision' ? (
              <motion.div
                key="provision"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.32 }}
              >
                <ProvisionStudio
                  token={token}
                  onGenerated={(result) => {
                    setIssued(result)
                    setTheaterOpen(true)
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="manage"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.32 }}
              >
                <CodeLookupStudio token={token} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <IssuedCodeTheater
        open={theaterOpen && Boolean(issued)}
        code={issued?.code ?? ''}
        expiresAt={issued?.expiresAt ?? ''}
        onCopy={() => {
          if (!issued) return
          void navigator.clipboard?.writeText(issued.code)
          notify.success('Code copied to clipboard')
        }}
        onClose={() => setTheaterOpen(false)}
      />
    </PageMotion>
  )
}
