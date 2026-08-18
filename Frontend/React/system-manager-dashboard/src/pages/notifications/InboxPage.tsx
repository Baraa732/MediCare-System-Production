import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  BellOff,
  CheckCheck,
  Radio,
  ShieldAlert,
  Siren,
} from 'lucide-react'
import {
  AnimatedButton,
  DashboardCard,
  EmptyState,
  FilterDropdown,
  SearchInput,
  StatusBadge,
  WidgetHeader,
} from '../../components/ui'
import { SeverityBadge } from '../../components/observability'
import { CC_CHART } from '../../charts'
import { fetchStaffInbox, type StaffInboxItem } from '../../api/notifications'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useInboxView } from '../../features/notifications/NotificationProvider'
import {
  inboxDeepLink,
  inboxKind,
  inboxSeverity,
  kindLabel,
  passesThreshold,
  relativeTime,
  severityBadge,
} from '../../lib/staffInbox'
import { CcDrawer, CcPage } from '../control-center/CcChrome'
import styles from '../control-center/cc.module.css'

const KIND_OPTIONS = ['All', 'HEALTH', 'QUEUE', 'ALERT', 'SECURITY', 'ACTIVATION', 'ADMIN', 'BROADCAST']
const SEVERITY_OPTIONS = ['All', 'critical', 'high', 'warning', 'info']

export default function InboxPage() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const threshold = useSettingsStore((s) => s.notificationThreshold)
  const rowsPerPage = useSettingsStore((s) => s.rowsPerPage)
  const {
    unreadCount,
    permission,
    pushEnabled,
    lastError,
    refreshInbox,
    markRead,
    markAllRead,
    requestPushPermission,
  } = useInboxView()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('All')
  const [severity, setSeverity] = useState('All')
  const [unreadOnly, setUnreadOnly] = useState('All')
  const [rows, setRows] = useState<StaffInboxItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const limit = Math.min(Math.max(rowsPerPage || 25, 10), 50)

  const load = async () => {
    if (!token) return
    setLoading(true)
    try {
      const inbox = await fetchStaffInbox(token, {
        page,
        limit,
        unreadOnly: unreadOnly === 'Unread',
      })
      setRows(inbox.items)
      setTotal(inbox.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [token, page, limit, unreadOnly])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((item) => {
      if (!passesThreshold(item, threshold)) return false
      if (kind !== 'All' && inboxKind(item) !== kind) return false
      if (severity !== 'All' && inboxSeverity(item) !== severity) return false
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        inboxKind(item).toLowerCase().includes(q)
      )
    })
  }, [rows, search, kind, severity, threshold])

  const selected = filtered.find((item) => item.id === selectedId) ?? rows.find((item) => item.id === selectedId) ?? null
  const critical = filtered.filter((item) => inboxSeverity(item) === 'critical').length
  const high = filtered.filter((item) => inboxSeverity(item) === 'high').length
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const lastDay = filtered.filter((item) => new Date(item.createdAt).getTime() >= dayAgo).length
  const pageCount = Math.max(1, Math.ceil(total / limit))

  const openItem = async (item: StaffInboxItem) => {
    setSelectedId(item.id)
    if (!item.readAt) {
      await markRead(item.id)
      setRows((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)),
      )
    }
  }

  const goTo = (item: StaffInboxItem) => {
    navigate(inboxDeepLink(item))
  }

  const kpis = [
    { id: 'unread', label: 'Unread', value: unreadCount, icon: Bell, color: CC_CHART.cyan, trend: unreadCount ? 'up' as const : 'flat' as const, trendLabel: 'inbox' },
    { id: 'crit', label: 'Critical', value: critical, icon: Siren, color: CC_CHART.red, trend: critical ? 'up' as const : 'down' as const, trendLabel: 'firing' },
    { id: 'high', label: 'High', value: high, icon: ShieldAlert, color: CC_CHART.orange, trend: high ? 'up' as const : 'flat' as const, trendLabel: 'pressure' },
    { id: 'day', label: 'Last 24h', value: lastDay, icon: Radio, color: CC_CHART.purple, trend: 'flat' as const, trendLabel: 'events' },
    { id: 'push', label: 'Browser push', value: pushEnabled ? 1 : 0, icon: pushEnabled ? Bell : BellOff, color: pushEnabled ? CC_CHART.green : CC_CHART.amber, trend: 'flat' as const, trendLabel: permission },
    { id: 'total', label: 'Loaded', value: filtered.length, icon: CheckCheck, color: CC_CHART.green, trend: 'flat' as const, trendLabel: `${total} total` },
  ]

  const needsPermission =
    permission === 'default' || (permission === 'granted' && !pushEnabled)

  return (
    <CcPage
      title="Notifications"
      description="Platform ops inbox — health, queues, security, activations, and broadcasts"
      loading={loading}
      onRefresh={() => {
        void load()
        void refreshInbox()
      }}
      kpis={kpis}
      sectionTitle="Inbox"
      sectionMeta={`Threshold ${threshold} · ${unreadCount} unread · push ${pushEnabled ? 'on' : 'off'}`}
    >
      {needsPermission ? (
        <DashboardCard delay={0.02}>
          <WidgetHeader title="Browser push" subtitle="Enable alerts when this tab is in the background" />
          <p className={styles.drawerSub} style={{ marginBottom: 12 }}>
            System managers receive platform events only — not clinic appointment chatter.
          </p>
          <AnimatedButton onClick={() => void requestPushPermission()}>Enable push</AnimatedButton>
        </DashboardCard>
      ) : null}

      {lastError ? <div className={styles.error}>{lastError}</div> : null}

      <div className={styles.grid}>
        <div className={styles.span12}>
          <DashboardCard minHeight={420} delay={0.06}>
            <WidgetHeader
              title="Platform events"
              subtitle="Click a row to mark it read and inspect the destination"
              action={
                unreadCount > 0 ? (
                  <AnimatedButton
                    onClick={() => {
                      void markAllRead().then(() => {
                        const now = new Date().toISOString()
                        setRows((prev) => prev.map((row) => ({ ...row, readAt: row.readAt ?? now })))
                      })
                    }}
                  >
                    Mark all read
                  </AnimatedButton>
                ) : undefined
              }
            />
            <div className={styles.toolbar}>
              <SearchInput value={search} onChange={setSearch} />
              <FilterDropdown label="Kind" value={kind} options={KIND_OPTIONS} onChange={setKind} />
              <FilterDropdown label="Severity" value={severity} options={SEVERITY_OPTIONS} onChange={setSeverity} />
              <FilterDropdown
                label="Read"
                value={unreadOnly}
                options={['All', 'Unread']}
                onChange={(v) => {
                  setPage(1)
                  setUnreadOnly(v)
                }}
              />
            </div>
            {filtered.length === 0 ? (
              <EmptyState
                title="No notifications in this view"
                hint="Ops events appear when a service goes down, a queue is critical, security pressure rises, a clinic activates, or a broadcast is sent."
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Event</th>
                      <th>Kind</th>
                      <th>When</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const sev = inboxSeverity(item)
                      const unread = !item.readAt
                      return (
                        <tr
                          key={item.id}
                          className={selectedId === item.id ? styles.selected : undefined}
                          onClick={() => void openItem(item)}
                        >
                          <td>
                            <SeverityBadge level={severityBadge(sev)} />
                          </td>
                          <td>
                            <div className={styles.name}>{item.title}</div>
                            <div className={styles.drawerSub}>{item.body}</div>
                          </td>
                          <td>{kindLabel(inboxKind(item))}</td>
                          <td className={styles.mono}>{relativeTime(item.createdAt)}</td>
                          <td>
                            <StatusBadge tone={unread ? 'info' : 'muted'}>
                              {unread ? 'Unread' : 'Read'}
                            </StatusBadge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className={styles.actions} style={{ marginTop: 12 }}>
              <button
                type="button"
                className={styles.ghost}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className={styles.drawerSub}>
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                className={styles.ghost}
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </DashboardCard>
        </div>
      </div>

      {selected ? (
        <CcDrawer
          title={selected.title}
          subtitle={relativeTime(selected.createdAt)}
          badge={<SeverityBadge level={severityBadge(inboxSeverity(selected))} />}
          onClose={() => setSelectedId(null)}
        >
          <dl className={styles.kv}>
            <dt>Kind</dt>
            <dd>{kindLabel(inboxKind(selected))}</dd>
          </dl>
          <dl className={styles.kv}>
            <dt>Severity</dt>
            <dd>{inboxSeverity(selected)}</dd>
          </dl>
          <dl className={styles.kv}>
            <dt>Destination</dt>
            <dd className={styles.mono}>{inboxDeepLink(selected)}</dd>
          </dl>
          <p className={styles.drawerSub}>{selected.body}</p>
          <div className={styles.actions}>
            <AnimatedButton onClick={() => goTo(selected)}>Open destination</AnimatedButton>
            {!selected.readAt ? (
              <button type="button" className={styles.ghost} onClick={() => void openItem(selected)}>
                Mark read
              </button>
            ) : null}
          </div>
        </CcDrawer>
      ) : null}
    </CcPage>
  )
}
