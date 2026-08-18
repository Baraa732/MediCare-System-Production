import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { SeverityBadge, SparklineCard } from '../../../components/observability'
import { AnimatedButton } from '../../../components/ui'
import type { PlatformAlert } from '../../../lib/platformAlerts'
import { formatAlertAgo } from '../../../lib/platformAlerts'
import { buildLogsUrl } from '../../../store/logsFilterStore'
import { CC_CHART } from '../../../charts'
import styles from '../alerts.module.css'

const severityLevel = (severity: PlatformAlert['severity']) =>
  severity === 'critical' ? 'Critical' : severity === 'warning' || severity === 'high' ? 'Warning' : 'Info'

export default function AlertDetailDrawer({
  alert,
  pending,
  onClose,
  onAcknowledge,
  onAssign,
  onResolve,
  onEscalate,
  onSilence,
}: {
  alert: PlatformAlert
  pending: boolean
  onClose: () => void
  onAcknowledge: () => void
  onAssign: () => void
  onResolve: () => void
  onEscalate: () => void
  onSilence: (hours: number) => void
}) {
  const navigate = useNavigate()
  const resolved = alert.status === 'resolved'
  const color =
    alert.severity === 'critical' ? CC_CHART.red : alert.severity === 'high' ? CC_CHART.orange : CC_CHART.amber

  return (
    <>
      <button type="button" className={styles.overlay} aria-label="Close alert" onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label={alert.name}>
        <div className={styles.drawerHead}>
          <div className={styles.clusterTop}>
            <SeverityBadge level={severityLevel(alert.severity)} />
            <button type="button" className={styles.ghost} onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className={styles.drawerTitle}>{alert.name}</div>
          <div className={styles.drawerSub}>
            {alert.service} · {alert.source} · {alert.status} · {formatAlertAgo(alert.startedAt)}
          </div>
        </div>
        <div className={styles.drawerBody}>
          <div>
            <div className={styles.clusterMeta}>Current value vs threshold</div>
            <div className={styles.drawerTitle} style={{ color }}>
              {alert.value}
              <span className={styles.drawerSub}> · threshold {alert.threshold}</span>
            </div>
            <div style={{ height: 36, marginTop: 8 }}>
              <SparklineCard data={alert.series.length ? alert.series : [alert.numericValue]} color={color} />
            </div>
          </div>

          <dl>
            {[
              ['Condition', alert.condition],
              ['Service', alert.service],
              ['Source', alert.source],
              ['Assignee', alert.assignee || 'Unassigned'],
              ['Silence', alert.silencedUntil ? `until ${new Date(alert.silencedUntil).toLocaleTimeString()}` : '—'],
            ].map(([key, value]) => (
              <div key={key} className={styles.kv}>
                <dt>{key}</dt>
                <dd className={styles.mono}>{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <div className={styles.clusterMeta} style={{ marginBottom: 8 }}>Related traces</div>
            {alert.relatedTraceIds.length ? (
              alert.relatedTraceIds.map((id) => (
                <div key={id} className={styles.kv}>
                  <dt>trace</dt>
                  <dd className={styles.mono}>{id.slice(0, 16)}</dd>
                </div>
              ))
            ) : (
              <div className={styles.clusterMeta}>No traces in the current live window.</div>
            )}
          </div>

          <div className={styles.actions}>
            <AnimatedButton onClick={() => onSilence(1)}>Silence 1h</AnimatedButton>
            <AnimatedButton onClick={() => onSilence(4)}>Silence 4h</AnimatedButton>
            <AnimatedButton onClick={onAcknowledge}>Acknowledge</AnimatedButton>
            <AnimatedButton onClick={onAssign}>Assign to me</AnimatedButton>
            <AnimatedButton onClick={onEscalate}>Escalate</AnimatedButton>
            <AnimatedButton onClick={onResolve}>Resolve</AnimatedButton>
            <AnimatedButton
              onClick={() =>
                navigate(
                  buildLogsUrl({
                    services: [alert.service],
                    severity: alert.severity === 'info' ? 'warning' : alert.severity,
                  }),
                )
              }
            >
              Open logs
            </AnimatedButton>
          </div>
          {pending ? <div className={styles.clusterMeta}>Saving incident action…</div> : null}
          {resolved ? <div className={styles.clusterMeta}>This alert is resolved in the incident store.</div> : null}
        </div>
      </aside>
    </>
  )
}
