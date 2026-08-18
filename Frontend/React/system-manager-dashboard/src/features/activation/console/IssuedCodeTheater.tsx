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
              className="ac-theater-close"
              onClick={onClose}
            >
              <X size={16} />
            </button>

            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 320, damping: 16 }}
              className="ac-theater-check"
            >
              <Check size={26} strokeWidth={2.5} />
            </motion.div>

            <p className="ac-theater-kicker">
              Code issued
            </p>
            <h2 className="ac-theater-title">
              Activation ready
            </h2>
            <p className="ac-theater-code">{code}</p>
            <p className="ac-theater-meta">
              Expires {new Date(expiresAt).toLocaleString()}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 22 }}>
              <button type="button" className="ac-btn ac-btn-primary" onClick={onCopy}>
                <Copy size={15} />
                Copy code
              </button>
              <button type="button" className="ac-btn ac-btn-ghost" onClick={onClose}>
                Continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
