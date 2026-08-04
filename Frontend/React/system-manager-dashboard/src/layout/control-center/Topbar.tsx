import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CheckSquare,
  MessageSquare,
  Settings,
} from 'lucide-react'
import { SearchInput, TopbarAction } from '../../components/ui'
import { fadeIn, pulseDot } from '../../animations/variants'
import NotificationPanel from './NotificationPanel'
import styles from './shell.module.css'

export default function Topbar() {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())
  const [query, setQuery] = useState('')

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const timeLabel = now.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <motion.header
      className={styles.topbar}
      variants={fadeIn}
      initial="hidden"
      animate="show"
    >
      <div className={styles.brand}>
        <div className={styles.brandMark}>M</div>
        <div className={styles.brandText}>
          <span className={styles.brandTitle}>System Manager</span>
          <span className={styles.brandSub}>Control Center</span>
        </div>
      </div>

      <div className={styles.topbarCenter}>
        <SearchInput value={query} onChange={setQuery} style={{ width: 'min(420px, 46vw)' }} />
      </div>

      <div className={styles.topbarRight}>
        <div className={styles.livePill}>
          <motion.span
            className={styles.liveDot}
            variants={pulseDot}
            animate="pulse"
            aria-hidden
          />
          Live
        </div>
        <span className={styles.clock}>{timeLabel}</span>
        <NotificationPanel />
        <TopbarAction label="Messages" badge={3}>
          <MessageSquare size={16} />
        </TopbarAction>
        <TopbarAction label="Tasks" badge={5}>
          <CheckSquare size={16} />
        </TopbarAction>
        <TopbarAction label="Settings" onClick={() => navigate('/settings')}>
          <Settings size={16} />
        </TopbarAction>
        <Link to="/profile" className={styles.profile} style={{ textDecoration: 'none' }}>
          <div className={styles.avatar}>SM</div>
          <div className={styles.profileMeta}>
            <span className={styles.profileName}>System Manager</span>
            <span className={styles.profileRole}>Administrator</span>
          </div>
        </Link>
      </div>
    </motion.header>
  )
}
