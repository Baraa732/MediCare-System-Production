import { useMediaQuery } from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useUIStore } from '../../store/uiStore'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { CC } from '../../theme/tokens'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import styles from './shell.module.css'

/**
 * Enterprise Control Center chrome.
 * UI-only shell — no data fetching here.
 */
export default function ControlCenterShell({
  children,
}: {
  children: React.ReactNode
}) {
  const location = useLocation()
  const reduced = usePrefersReducedMotion()
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const isMobile = useMediaQuery('(max-width:900px)')
  const collapsed = isMobile || sidebarCollapsed
  const padLeft = collapsed
    ? CC.layout.sidebarCollapsed
    : CC.layout.sidebarExpanded

  return (
    <div className={styles.shell}>
      <Toaster theme="dark" position="top-right" richColors />
      <Topbar />
      <Sidebar />
      <motion.div
        className={styles.content}
        initial={false}
        animate={{ paddingLeft: padLeft }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: 'spring', stiffness: 260, damping: 28 }
        }
      >
        <main className={styles.main}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>
    </div>
  )
}
