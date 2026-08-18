import { DashboardCard, MetricBadge, WidgetHeader } from '../../../components/ui'
import type { AlertCluster } from '../../../lib/alertCorrelation'
import styles from '../alerts.module.css'

export default function AlertCorrelationPanel({ clusters }: { clusters: AlertCluster[] }) {
  if (!clusters.length) return null

  return (
    <DashboardCard delay={0.08}>
      <WidgetHeader
        title="Alert correlation"
        subtitle="Grouped by shared service and real dependency edges"
      />
      <div className={styles.grid} style={{ marginTop: 8 }}>
        {clusters.slice(0, 3).map((cluster) => (
          <div key={cluster.id} className={styles.span4}>
            <article className={`${styles.cluster} ${styles[cluster.severity] ?? ''}`}>
              <div className={styles.clusterTop}>
                <div className={styles.clusterTitle}>{cluster.label}</div>
                <MetricBadge tone={cluster.confidence === 'high' ? 'warning' : 'info'}>
                  {cluster.confidence} confidence
                </MetricBadge>
              </div>
              <div className={styles.clusterMeta}>Root cause: {cluster.rootCause}</div>
              <div className={styles.clusterMeta} style={{ marginTop: 6 }}>
                {cluster.affectedServices.join(' · ')} · {cluster.signals.length} signals
              </div>
            </article>
          </div>
        ))}
      </div>
    </DashboardCard>
  )
}
