import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  CheckCheck,
  Filter,
  Radio,
  RefreshCw,
  X,
} from 'lucide-react'
import { useInboxView } from '../../features/notifications/NotificationProvider'
import { TopbarAction } from '../../components/ui'
import {
  inboxDeepLink,
  inboxKind,
  inboxSeverity,
  kindLabel,
  relativeTime,
  severityTone,
} from '../../lib/staffInbox'
import styles from './notificationPanel.module.css'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'critical', label: 'Critical' },
  { id: 'HEALTH', label: 'Health' },
  { id: 'QUEUE', label: 'Queues' },
  { id: 'SECURITY', label: 'Security' },
  { id: 'ALERT', label: 'Alerts' },
] as const

export default function NotificationPanel() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const {
    items,
    unreadCount,
    permission,
    pushEnabled,
    isLoading,
    lastError,
    refreshInbox,
    markRead,
    markAllRead,
    requestPushPermission,
  } = useInboxView()

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'unread') return items.filter((i) => !i.readAt)
    if (filter === 'critical') return items.filter((i) => inboxSeverity(i) === 'critical')
    return items.filter((i) => inboxKind(i) === filter)
  }, [filter, items])

  const needsPermission =
    permission === 'default' || (permission === 'granted' && !pushEnabled)

  const openItem = async (id: string, deepLink: string, unread: boolean) => {
    if (unread) await markRead(id)
    setOpen(false)
    navigate(deepLink)
  }

  return (
    <div className={styles.wrap}>
      <TopbarAction
        label="Notifications"
        badge={unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined}
        ring={unreadCount > 0}
        onClick={() => {
          setOpen((v) => !v)
          void refreshInbox()
        }}
      >
        <Bell size={16} />
      </TopbarAction>

      <AnimatePresence>
        {open ? (
          <>
            <button
              type="button"
              className={styles.backdrop}
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className={styles.panel}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <header className={styles.header}>
                <div>
                  <div className={styles.titleRow}>
                    <Radio size={14} />
                    <h2>Platform inbox</h2>
                  </div>
                  <p className={styles.sub}>
                    Health · queues · security · activations
                    {pushEnabled ? ' · FCM on' : ' · browser push off'}
                  </p>
                </div>
                <div className={styles.headerActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Refresh"
                    onClick={() => void refreshInbox()}
                  >
                    <RefreshCw size={14} className={isLoading ? styles.spin : undefined} />
                  </button>
                  {unreadCount > 0 ? (
                    <button
                      type="button"
                      className={styles.textBtn}
                      onClick={() => void markAllRead()}
                    >
                      <CheckCheck size={13} />
                      Mark all
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Close"
                    onClick={() => setOpen(false)}
                  >
                    <X size={14} />
                  </button>
                </div>
              </header>

              {needsPermission ? (
                <div className={styles.pushBanner}>
                  <p>Enable browser push for alerts when this tab is backgrounded.</p>
                  <button type="button" onClick={() => void requestPushPermission()}>
                    Enable push
                  </button>
                </div>
              ) : null}

              {lastError ? <div className={styles.errorBanner}>{lastError}</div> : null}

              <div className={styles.filters}>
                <Filter size={12} />
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={filter === f.id ? styles.chipActive : styles.chip}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className={styles.list}>
                {isLoading && items.length === 0 ? (
                  <div className={styles.empty}>Loading inbox…</div>
                ) : filtered.length === 0 ? (
                  <div className={styles.empty}>No notifications in this view</div>
                ) : (
                  filtered.map((item) => {
                    const unread = !item.readAt
                    const tone = severityTone(inboxSeverity(item))
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.item} ${unread ? styles.itemUnread : ''}`}
                        onClick={() => void openItem(item.id, inboxDeepLink(item), unread)}
                      >
                        <span className={`${styles.tone} ${styles[`tone_${tone}`]}`} />
                        <span className={styles.itemBody}>
                          <span className={styles.itemTop}>
                            <strong>{item.title}</strong>
                            <em>{relativeTime(item.createdAt)}</em>
                          </span>
                          <span className={styles.itemText}>{item.body}</span>
                          <span className={styles.itemMeta}>
                            {kindLabel(inboxKind(item))} · {inboxSeverity(item)}
                          </span>
                        </span>
                        {unread ? <span className={styles.dot} /> : null}
                      </button>
                    )
                  })
                )}
              </div>
              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => {
                    setOpen(false)
                    navigate('/notifications')
                  }}
                >
                  Open full inbox
                </button>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
