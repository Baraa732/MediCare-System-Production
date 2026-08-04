import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  CheckCheck,
  Filter,
  Radio,
  RefreshCw,
  X,
} from 'lucide-react'
import { useNotifications } from '../../features/notifications/NotificationProvider'
import { TopbarAction } from '../../components/ui'
import styles from './notificationPanel.module.css'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'APPOINTMENT_CREATED', label: 'Created' },
  { id: 'APPOINTMENT_UPDATED', label: 'Updated' },
  { id: 'APPOINTMENT_CANCELLED', label: 'Cancelled' },
  { id: 'APPOINTMENT_REQUESTED', label: 'Requested' },
  { id: 'SYSTEM', label: 'System' },
] as const

function relativeTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function categoryTone(category: string) {
  if (category.includes('CANCEL')) return 'bad'
  if (category.includes('REQUEST') || category.includes('UPDATE')) return 'warn'
  if (category.includes('CREATE') || category.includes('CONFIRM')) return 'ok'
  return 'sys'
}

export default function NotificationPanel() {
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
  } = useNotifications()

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'unread') return items.filter((i) => !i.readAt)
    return items.filter((i) => i.category === filter)
  }, [filter, items])

  const needsPermission =
    permission === 'default' || (permission === 'granted' && !pushEnabled)

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
                    <h2>Live Notifications</h2>
                  </div>
                  <p className={styles.sub}>
                    Inbox · push · polling
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
                    const tone = categoryTone(item.category)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.item} ${unread ? styles.itemUnread : ''}`}
                        onClick={() => unread && void markRead(item.id)}
                      >
                        <span className={`${styles.tone} ${styles[`tone_${tone}`]}`} />
                        <span className={styles.itemBody}>
                          <span className={styles.itemTop}>
                            <strong>{item.title}</strong>
                            <em>{relativeTime(item.createdAt)}</em>
                          </span>
                          <span className={styles.itemText}>{item.body}</span>
                          <span className={styles.itemMeta}>
                            {item.category.replace(/_/g, ' ')}
                            {item.clinicId ? ` · clinic ${item.clinicId.slice(0, 8)}` : ''}
                          </span>
                        </span>
                        {unread ? <span className={styles.dot} /> : null}
                      </button>
                    )
                  })
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
