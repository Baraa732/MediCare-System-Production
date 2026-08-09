import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, X } from 'lucide-react'

type IssuedCodeTheaterProps = {
  open: boolean
  code: string
  expiresAt: string
  onCopy: () => void
  onClose: () => void
}

export default function IssuedCodeTheater({
  open,
  code,
  expiresAt,
  onCopy,
  onClose,
}: IssuedCodeTheaterProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="ac-theater-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="ac-theater-card"
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                border: 0,
                background: 'rgba(255,255,255,0.08)',
                color: '#a5f3fc',
                width: 32,
                height: 32,
                borderRadius: 10,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <X size={16} />
            </button>

            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 320, damping: 16 }}
              style={{
                width: 54,
                height: 54,
                margin: '0 auto',
                borderRadius: 16,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(45,212,191,0.18)',
                color: '#5eead4',
                border: '1px solid rgba(45,212,191,0.35)',
              }}
            >
              <Check size={26} strokeWidth={2.5} />
            </motion.div>

            <p
              style={{
                marginTop: 14,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#67e8f9',
              }}
            >
              Code issued
            </p>
            <h2 style={{ margin: '8px 0 0', fontSize: 22, letterSpacing: '-0.03em' }}>
              Activation ready
            </h2>
            <p className="ac-theater-code">{code}</p>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>
              Expires {new Date(expiresAt).toLocaleString()}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 22 }}>
              <button type="button" className="ac-btn ac-btn-primary" onClick={onCopy}>
                <Copy size={15} />
                Copy code
              </button>
              <button type="button" className="ac-btn ac-btn-ghost" onClick={onClose} style={{ color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)' }}>
                Continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
