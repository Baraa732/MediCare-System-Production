import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  KeyRound,
  Palette,
  Plug,
  Settings as SettingsIcon,
  Users,
} from 'lucide-react'
import {
  AnimatedButton,
  DashboardCard,
  EmptyState,
  FilterDropdown,
  HealthBadge,
  WidgetHeader,
} from '../../components/ui'
import { WidgetToolbar } from '../../components/observability'
import { CC_CHART } from '../../charts'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { notify } from '../../lib/toast'
import { decodeJwt, msUntilExpiry } from '../../lib/auth'
import { useAuthStore } from '../../store/authStore'
import {
  normalizeTimeRange,
  timeRangeLabel,
  useDashboardStore,
} from '../../store/dashboardStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useUIStore } from '../../store/uiStore'
import TimezoneSelect from '../../components/common/TimezoneSelect'
import type { PlatformIntegration } from '../../api/types'
import { CcDrawer, CcPage, healthTone } from '../control-center/CcChrome'
import obs from '../../components/observability/obs.module.css'
import styles from '../control-center/cc.module.css'

type Tab = 'general' | 'appearance' | 'sources' | 'notifications' | 'team' | 'session'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'sources', label: 'Data sources' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'team', label: 'Team' },
  { id: 'session', label: 'Session' },
]

const RANGE_OPTIONS = ['Last 15m', 'Last 1h', 'Last 24h', 'Last 7d', 'Last 30d']
const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']
const ENVIRONMENTS = ['production']
const ROW_COUNTS = ['25', '50', '100']

export default function Settings() {
  const navigate = useNavigate()
  const { live } = useDashboardLive(true)
  const obsQ = useObservabilityData(undefined, live)
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const themeMode = useUIStore((s) => s.themeMode)
  const setThemeMode = useUIStore((s) => s.setThemeMode)
  const setTimeRange = useDashboardStore((s) => s.setTimeRange)
  const settings = useSettingsStore()
  const [tab, setTab] = useState<Tab>('general')
  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  const integrations = obsQ.data?.integrations ?? []
  const selected = integrations.find((i) => i.name === selectedSource) ?? null
  const connected = integrations.filter((i) => i.status === 'connected').length
  const failed = integrations.filter((i) => i.status === 'error').length
  const sessionMins = Math.round(msUntilExpiry(token) / 60_000)
  const payload = token ? decodeJwt(token) : null
  const rangeValue = RANGE_OPTIONS.includes(settings.defaultTimeRange)
    ? settings.defaultTimeRange
    : timeRangeLabel(normalizeTimeRange(settings.defaultTimeRange))

  const kpis = [
    { id: 'theme', label: 'Theme', value: themeMode === 'dark' ? 1 : 0, icon: Palette, color: CC_CHART.purple, trend: 'flat' as const, trendLabel: themeMode },
    { id: 'density', label: 'Density', value: settings.density === 'compact' ? 0 : settings.density === 'comfortable' ? 2 : 1, icon: SettingsIcon, color: CC_CHART.cyan, trend: 'flat' as const, trendLabel: settings.density },
    { id: 'up', label: 'Sources up', value: connected, icon: Plug, color: CC_CHART.green, trend: 'up' as const, trendLabel: `${integrations.length} total` },
    { id: 'down', label: 'Sources down', value: failed, icon: Bell, color: CC_CHART.red, trend: failed ? 'up' as const : 'down' as const, trendLabel: 'probes' },
    { id: 'session', label: 'Session left', value: sessionMins, icon: KeyRound, color: CC_CHART.amber, trend: sessionMins < 30 ? 'down' as const : 'flat' as const, trendLabel: 'min' },
    { id: 'team', label: 'Signed in', value: user ? 1 : 0, icon: Users, color: CC_CHART.green, trend: 'flat' as const, trendLabel: user?.username ?? '—' },
  ]

  function saveGeneral() {
    setTimeRange(normalizeTimeRange(rangeValue))
    notify.success('Workspace preferences saved on this browser.')
  }

  return (
    <CcPage
      title="Settings"
      description="Workspace preferences for this browser — theme, density, and live integration probes"
      loading={obsQ.loading}
      onRefresh={() => void obsQ.refresh()}
      kpis={kpis}
      sectionTitle="Control plane"
      sectionMeta={`${themeMode} · ${settings.density} · ${connected}/${integrations.length || 0} sources connected`}
    >
      <div className={styles.grid}>
        <div className={styles.span12}>
          <DashboardCard minHeight={420} delay={0.04}>
            <WidgetHeader title="Preferences" subtitle="Changes apply immediately on this dashboard" />
            <WidgetToolbar
              right={TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${obs.filterChip} ${tab === item.id ? obs.filterChipActive : ''}`}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            />

            {tab === 'general' ? (
              <div className={styles.span6}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Product</span>
                  <input className={styles.input} value="MediCare System Manager" readOnly />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Timezone</span>
                  <TimezoneSelect value={settings.timezone} onChange={(v) => settings.updateSettings({ timezone: v })} />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Date format</span>
                  <FilterDropdown
                    label="Date format"
                    value={DATE_FORMATS.includes(settings.dateFormat) ? settings.dateFormat : 'YYYY-MM-DD'}
                    options={DATE_FORMATS}
                    onChange={(v) => settings.updateSettings({ dateFormat: v })}
                  />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Default time range</span>
                  <FilterDropdown
                    label="Default time range"
                    value={rangeValue}
                    options={RANGE_OPTIONS}
                    onChange={(v) => {
                      settings.updateSettings({ defaultTimeRange: v })
                      setTimeRange(normalizeTimeRange(v))
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Environment</span>
                  <FilterDropdown
                    label="Environment"
                    value={ENVIRONMENTS.includes(settings.defaultEnvironment) ? settings.defaultEnvironment : 'production'}
                    options={ENVIRONMENTS}
                    onChange={(v) => settings.updateSettings({ defaultEnvironment: v })}
                  />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Rows per page</span>
                  <FilterDropdown
                    label="Rows per page"
                    value={String(settings.rowsPerPage)}
                    options={ROW_COUNTS}
                    onChange={(v) => settings.updateSettings({ rowsPerPage: Number(v) })}
                  />
                </div>
                <label className={styles.switchRow}>
                  <span>Anonymous product telemetry</span>
                  <input
                    type="checkbox"
                    checked={settings.sendTelemetry}
                    onChange={(e) => settings.updateSettings({ sendTelemetry: e.target.checked })}
                  />
                </label>
                <div className={styles.drawerSub}>Telemetry is a local preference only — this stack does not ship a usage collector.</div>
                <div className={styles.actions}>
                  <AnimatedButton onClick={saveGeneral}>Save preferences</AnimatedButton>
                </div>
              </div>
            ) : null}

            {tab === 'appearance' ? (
              <div>
                <div className={styles.fieldLabel}>Theme</div>
                <div className={styles.actions} style={{ margin: '8px 0 16px' }}>
                  <AnimatedButton onClick={() => setThemeMode('dark')}>Dark{themeMode === 'dark' ? ' · on' : ''}</AnimatedButton>
                  <AnimatedButton onClick={() => setThemeMode('light')}>Light{themeMode === 'light' ? ' · on' : ''}</AnimatedButton>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Density</span>
                  <FilterDropdown
                    label="Density"
                    value={settings.density}
                    options={['compact', 'default', 'comfortable']}
                    onChange={(v) => settings.updateSettings({ density: v as 'compact' | 'default' | 'comfortable' })}
                  />
                </div>
                <label className={styles.switchRow}>
                  <span>Show sidebar section labels</span>
                  <input
                    type="checkbox"
                    checked={settings.showSectionLabels}
                    onChange={(e) => settings.updateSettings({ showSectionLabels: e.target.checked })}
                  />
                </label>
                <label className={styles.switchRow}>
                  <span>Show sidebar icons</span>
                  <input
                    type="checkbox"
                    checked={settings.showIcons}
                    onChange={(e) => settings.updateSettings({ showIcons: e.target.checked })}
                  />
                </label>
                <div className={styles.drawerSub}>Density, labels, and icons apply to the control-center sidebar immediately.</div>
              </div>
            ) : null}

            {tab === 'sources' ? (
              !integrations.length ? (
                <EmptyState title="No integration probes" hint={obsQ.error ?? 'Waiting for platform observability.'} />
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Latency</th>
                        <th>Checked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {integrations.map((row) => (
                        <tr
                          key={row.name}
                          className={selectedSource === row.name ? styles.selected : undefined}
                          onClick={() => setSelectedSource(row.name)}
                        >
                          <td className={styles.name}>{row.name}</td>
                          <td>{row.category}</td>
                          <td><HealthBadge status={healthTone(row.status)} /></td>
                          <td className={styles.mono}>{row.latencyMs != null ? `${row.latencyMs} ms` : '—'}</td>
                          <td className={styles.mono}>{row.checkedAt ? new Date(row.checkedAt).toLocaleTimeString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : null}

            {tab === 'notifications' ? (
              <div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Default severity threshold</span>
                  <FilterDropdown
                    label="Severity"
                    value={settings.notificationThreshold ?? 'warning'}
                    options={['info', 'warning', 'error']}
                    onChange={(v) => settings.updateSettings({ notificationThreshold: v as 'info' | 'warning' | 'error' })}
                  />
                </div>
                <div className={styles.drawerSub}>
                  Filters the control-center inbox and bell. Info stays hidden at warning; only high and critical show at error. Firing Prometheus rules still appear on Alerts.
                </div>
                <div className={styles.actions}>
                  <AnimatedButton onClick={() => navigate('/notifications')}>Open inbox</AnimatedButton>
                  <AnimatedButton onClick={() => navigate('/alerts')}>Open alerts</AnimatedButton>
                </div>
              </div>
            ) : null}

            {tab === 'team' ? (
              <div>
                <div className={styles.drawerSub}>Platform administrators are provisioned in Roles — this dashboard does not have a fake member directory.</div>
                {user ? (
                  <div className={styles.tableWrap} style={{ marginTop: 12 }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Username</th>
                          <th>Email</th>
                          <th>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr onClick={() => navigate('/profile')}>
                          <td className={styles.name}>{user.name}</td>
                          <td className={styles.mono}>@{user.username}</td>
                          <td className={styles.mono}>{user.email || '—'}</td>
                          <td>System Manager</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState title="No session user" />
                )}
                <div className={styles.actions} style={{ marginTop: 12 }}>
                  <AnimatedButton onClick={() => navigate('/administrators')}>Provision admin</AnimatedButton>
                  <AnimatedButton onClick={() => navigate('/profile')}>Open profile</AnimatedButton>
                </div>
              </div>
            ) : null}

            {tab === 'session' ? (
              <div>
                <dl>
                  {[
                    ['User', user?.name || '—'],
                    ['Username', user?.username ? `@${user.username}` : '—'],
                    ['Email', user?.email || '—'],
                    ['Subject', payload?.sub || '—'],
                    ['Expires', payload?.exp ? new Date(payload.exp * 1000).toLocaleString() : '—'],
                    ['Minutes left', String(sessionMins)],
                  ].map(([k, v]) => (
                    <div key={k} className={styles.kv}>
                      <dt>{k}</dt>
                      <dd className={styles.mono}>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className={styles.drawerSub}>
                  This dashboard authenticates with the system-manager JWT. There are no API keys to generate or revoke here.
                </div>
                <div className={styles.actions}>
                  <AnimatedButton onClick={() => navigate('/profile')}>Open profile</AnimatedButton>
                  <AnimatedButton
                    onClick={() => {
                      logout()
                      navigate('/login')
                    }}
                  >
                    Sign out
                  </AnimatedButton>
                </div>
              </div>
            ) : null}
          </DashboardCard>
        </div>
      </div>

      {selected ? (
        <SourceDrawer
          integration={selected}
          onClose={() => setSelectedSource(null)}
          onIntegrations={() => navigate('/integrations')}
          onAlerts={() => navigate('/alerts')}
        />
      ) : null}
    </CcPage>
  )
}

function SourceDrawer({
  integration,
  onClose,
  onIntegrations,
  onAlerts,
}: {
  integration: PlatformIntegration
  onClose: () => void
  onIntegrations: () => void
  onAlerts: () => void
}) {
  return (
    <CcDrawer
      title={integration.name}
      subtitle={integration.desc || integration.category}
      badge={<HealthBadge status={healthTone(integration.status)} />}
      onClose={onClose}
    >
      <dl>
        {[
          ['Category', integration.category],
          ['Status', integration.status],
          ['URL', integration.url || '—'],
          ['Latency', integration.latencyMs != null ? `${integration.latencyMs} ms` : '—'],
          ['Checked', integration.checkedAt ? new Date(integration.checkedAt).toLocaleString() : '—'],
        ].map(([k, v]) => (
          <div key={k} className={styles.kv}>
            <dt>{k}</dt>
            <dd className={styles.mono}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <AnimatedButton onClick={onIntegrations}>Open integrations</AnimatedButton>
        {integration.status === 'error' ? <AnimatedButton onClick={onAlerts}>Open alerts</AnimatedButton> : null}
      </div>
    </CcDrawer>
  )
}
