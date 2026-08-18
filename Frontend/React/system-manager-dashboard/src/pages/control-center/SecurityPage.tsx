import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Ban,
  KeyRound,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react'
import {
  AnimatedButton,
  DashboardCard,
  EmptyState,
  FilterDropdown,
  HealthBadge,
  SearchInput,
  WidgetHeader,
} from '../../components/ui'
import { CC_CHART } from '../../charts'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import { useSecuritySummary } from '../../hooks/useSecuritySummary'
import { buildLogsUrl } from '../../store/logsFilterStore'
import {
  AuditTimelineWidget,
  PlatformActivityWidget,
  SecurityOverviewWidget,
} from '../../widgets'
import type { SecuritySummary } from '../../api/types'
import { CcDrawer, CcPage } from './CcChrome'
import styles from './cc.module.css'

type IpRow = SecuritySummary['topIps'][number]
type BlockedRow = SecuritySummary['blockedIdentifiers'][number]
type AuditRow = SecuritySummary['recentAudits'][number]

type Selection =
  | { kind: 'ip'; id: string }
  | { kind: 'blocked'; id: string }
  | { kind: 'audit'; id: string }
  | null

function threatTone(score: number): 'Healthy' | 'Warning' | 'Critical' {
  if (score >= 60) return 'Critical'
  if (score >= 25) return 'Warning'
  return 'Healthy'
}

function ipTone(ip: IpRow): 'Healthy' | 'Warning' | 'Critical' {
  const hostile = ip.actions.some((a) => /fail|suspicious|rate_limit|blocked/i.test(a))
  if (hostile && ip.count > 8) return 'Critical'
  if (hostile) return 'Warning'
  return 'Healthy'
}

export default function SecurityPage() {
  const navigate = useNavigate()
  const { live } = useDashboardLive(true)
  const securityQ = useSecuritySummary(undefined, live)
  const [search, setSearch] = useState('')
  const [ipFilter, setIpFilter] = useState('All')
  const [selected, setSelected] = useState<Selection>(null)

  const security = securityQ.data
  const ips = security?.topIps ?? []
  const blocked = security?.blockedIdentifiers ?? []
  const audits = security?.recentAudits ?? []

  const filteredIps = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ips.filter((ip) => {
      const matchesSearch =
        !q ||
        ip.ip.toLowerCase().includes(q) ||
        ip.actions.join(' ').toLowerCase().includes(q)
      const tone = ipTone(ip)
      const matchesFilter = ipFilter === 'All' || tone === ipFilter
      return matchesSearch && matchesFilter
    })
  }, [ipFilter, ips, search])

  const selectedIp = selected?.kind === 'ip' ? ips.find((i) => i.ip === selected.id) ?? null : null
  const selectedBlocked = selected?.kind === 'blocked' ? blocked.find((b) => b.identifier === selected.id) ?? null : null
  const selectedAudit = selected?.kind === 'audit' ? audits.find((a) => a.id === selected.id) ?? null : null

  const score = security?.threatScore ?? 0
  const kpis = [
    { id: 'threat', label: 'Threat score', value: score, icon: Shield, color: score >= 60 ? CC_CHART.red : score >= 25 ? CC_CHART.amber : CC_CHART.green, trend: score >= 25 ? 'up' as const : 'down' as const, trendLabel: threatTone(score).toLowerCase() },
    { id: 'fail', label: 'Failed logins', value: security?.failedLogins ?? 0, icon: ShieldAlert, color: CC_CHART.red, trend: (security?.failedLogins ?? 0) ? 'up' as const : 'flat' as const, trendLabel: security?.range ?? 'window' },
    { id: 'block', label: 'Blocked', value: blocked.length, icon: Ban, color: CC_CHART.amber, trend: blocked.length ? 'up' as const : 'down' as const, trendLabel: 'identifiers' },
    { id: 'sess', label: 'Sessions', value: security?.activeSessions ?? 0, icon: Users, color: CC_CHART.cyan, trend: 'flat' as const, trendLabel: 'active' },
    { id: 'login', label: 'Logins', value: security?.loginEvents ?? 0, icon: KeyRound, color: CC_CHART.green, trend: 'up' as const, trendLabel: 'events' },
    { id: 'sus', label: 'Suspicious', value: security?.suspicious ?? 0, icon: AlertTriangle, color: CC_CHART.purple, trend: (security?.suspicious ?? 0) ? 'up' as const : 'flat' as const, trendLabel: `${security?.rateLimitExceeded ?? 0} rate-limit` },
  ]

  return (
    <CcPage
      title="Security"
      description="Auth failures, blocked identifiers, sessions, and audit trail"
      loading={securityQ.loading}
      onRefresh={() => void securityQ.refresh()}
      kpis={kpis}
      sectionTitle="Access posture"
      sectionMeta={
        security?.available
          ? `${security.range} window · map markers are anonymized, not real geo`
          : security?.warning ?? 'Auth aggregate offline'
      }
    >
      <div className={styles.grid}>
        <div className={styles.span12}>
          <SecurityOverviewWidget
            delay={0.04}
            security={security}
            onSelectIp={(ip) => setSelected({ kind: 'ip', id: ip })}
          />
        </div>
        <div className={styles.span6}>
          <AuditTimelineWidget delay={0.06} security={security} />
        </div>
        <div className={styles.span6}>
          <PlatformActivityWidget delay={0.08} security={security} />
        </div>

        <div className={styles.span12}>
          <DashboardCard minHeight={320} delay={0.1}>
            <WidgetHeader title="Source IPs" subtitle="Anonymized plot in the overview — table is the real identifier list" />
            <div className={styles.toolbar}>
              <SearchInput placeholder="Search IPs or actions…" value={search} onChange={setSearch} />
              <FilterDropdown
                label="Tone"
                value={ipFilter}
                options={['All', 'Healthy', 'Warning', 'Critical']}
                onChange={setIpFilter}
              />
            </div>
            {!filteredIps.length ? (
              <EmptyState
                title="No source IPs"
                hint={security?.warning ?? `${security?.uniqueActors ?? 0} actors in this window.`}
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>IP</th>
                      <th>Events</th>
                      <th>Actions</th>
                      <th>Last seen</th>
                      <th>Tone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIps.map((ip) => (
                      <tr
                        key={ip.ip}
                        className={selected?.kind === 'ip' && selected.id === ip.ip ? styles.selected : undefined}
                        onClick={() => setSelected({ kind: 'ip', id: ip.ip })}
                      >
                        <td className={styles.name}>{ip.ip}</td>
                        <td className={styles.mono}>{ip.count}</td>
                        <td className={styles.mono}>{ip.actions.slice(0, 4).join(', ') || '—'}</td>
                        <td className={styles.mono}>{ip.lastSeen ? new Date(ip.lastSeen).toLocaleString() : '—'}</td>
                        <td><HealthBadge status={ipTone(ip)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </div>

        <div className={styles.span6}>
          <DashboardCard minHeight={280} delay={0.12}>
            <WidgetHeader title="Blocked identifiers" subtitle="Lockouts from auth service" />
            {!blocked.length ? (
              <EmptyState title="No lockouts" hint="No identifiers currently blocked." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Identifier</th>
                      <th>Tier</th>
                      <th>Failures</th>
                      <th>Locked until</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocked.map((row) => (
                      <tr
                        key={row.identifier}
                        className={selected?.kind === 'blocked' && selected.id === row.identifier ? styles.selected : undefined}
                        onClick={() => setSelected({ kind: 'blocked', id: row.identifier })}
                      >
                        <td className={styles.name}>{row.identifier}</td>
                        <td className={styles.mono}>{row.tier}</td>
                        <td className={styles.error}>{row.failedAttempts}</td>
                        <td className={styles.mono}>{row.lockedUntil ? new Date(row.lockedUntil).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </div>

        <div className={styles.span6}>
          <DashboardCard minHeight={280} delay={0.14}>
            <WidgetHeader title="Audit feed" subtitle="Click a row for actor and IP" />
            {!audits.length ? (
              <EmptyState title="No audit events" hint="Auth audit trail empty for this range." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Result</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map((row) => (
                      <tr
                        key={row.id}
                        className={selected?.kind === 'audit' && selected.id === row.id ? styles.selected : undefined}
                        onClick={() => setSelected({ kind: 'audit', id: row.id })}
                      >
                        <td className={styles.name}>{row.action}</td>
                        <td>{row.actor}</td>
                        <td className={row.result.toLowerCase().includes('fail') ? styles.error : styles.mono}>{row.result}</td>
                        <td className={styles.mono}>{row.ago}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </div>
      </div>

      {selectedIp ? (
        <IpDrawer
          ip={selectedIp}
          onClose={() => setSelected(null)}
          onLogs={() => navigate(buildLogsUrl({ services: ['auth-service'], search: selectedIp.ip }))}
        />
      ) : null}
      {selectedBlocked ? (
        <BlockedDrawer
          row={selectedBlocked}
          onClose={() => setSelected(null)}
          onLogs={() => navigate(buildLogsUrl({ services: ['auth-service'], search: selectedBlocked.identifier }))}
        />
      ) : null}
      {selectedAudit ? (
        <AuditDrawer
          row={selectedAudit}
          onClose={() => setSelected(null)}
          onLogs={() =>
            navigate(
              buildLogsUrl({
                services: ['auth-service'],
                search: selectedAudit.ip || selectedAudit.actor,
              }),
            )
          }
        />
      ) : null}
    </CcPage>
  )
}

function IpDrawer({
  ip,
  onClose,
  onLogs,
}: {
  ip: IpRow
  onClose: () => void
  onLogs: () => void
}) {
  return (
    <CcDrawer
      title={ip.ip}
      subtitle="Source identifier · map placement is anonymized"
      badge={<HealthBadge status={ipTone(ip)} />}
      onClose={onClose}
    >
      <dl>
        {[
          ['Events', String(ip.count)],
          ['Last seen', ip.lastSeen ? new Date(ip.lastSeen).toLocaleString() : '—'],
          ['Actions', ip.actions.join(', ') || '—'],
        ].map(([k, v]) => (
          <div key={k} className={styles.kv}>
            <dt>{k}</dt>
            <dd className={styles.mono}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <AnimatedButton onClick={onLogs}>Open auth logs</AnimatedButton>
      </div>
    </CcDrawer>
  )
}

function BlockedDrawer({
  row,
  onClose,
  onLogs,
}: {
  row: BlockedRow
  onClose: () => void
  onLogs: () => void
}) {
  return (
    <CcDrawer
      title={row.identifier}
      subtitle="Locked identifier"
      badge={<HealthBadge status="Critical" />}
      onClose={onClose}
    >
      <dl>
        {[
          ['Tier', row.tier],
          ['Failed attempts', String(row.failedAttempts)],
          ['Locked until', row.lockedUntil ? new Date(row.lockedUntil).toLocaleString() : '—'],
        ].map(([k, v]) => (
          <div key={k} className={styles.kv}>
            <dt>{k}</dt>
            <dd className={styles.mono}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <AnimatedButton onClick={onLogs}>Open auth logs</AnimatedButton>
      </div>
    </CcDrawer>
  )
}

function AuditDrawer({
  row,
  onClose,
  onLogs,
}: {
  row: AuditRow
  onClose: () => void
  onLogs: () => void
}) {
  return (
    <CcDrawer
      title={row.action}
      subtitle={`${row.actor} → ${row.target}`}
      badge={<HealthBadge status={row.result.toLowerCase().includes('fail') ? 'Critical' : 'Healthy'} />}
      onClose={onClose}
    >
      <dl>
        {[
          ['Actor', row.actor],
          ['Target', row.target],
          ['Result', row.result],
          ['IP', row.ip || '—'],
          ['When', row.createdAt ? new Date(row.createdAt).toLocaleString() : row.ago],
        ].map(([k, v]) => (
          <div key={k} className={styles.kv}>
            <dt>{k}</dt>
            <dd className={styles.mono}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <AnimatedButton onClick={onLogs}>Open auth logs</AnimatedButton>
      </div>
    </CcDrawer>
  )
}
