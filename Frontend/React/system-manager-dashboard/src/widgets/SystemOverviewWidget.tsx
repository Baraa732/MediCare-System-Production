import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { LiveIndicator, ServiceHealthCard } from '../components/observability'
import obs from '../components/observability/obs.module.css'

export default function SystemOverviewWidget({
  delay = 0,
  rows = [],
  loading,
}: {
  delay?: number
  rows?: Array<{
    name: string
    status: 'Healthy' | 'Warning' | 'Critical'
    latencyMs: number
    spark: number[]
  }>
  loading?: boolean
}) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="System Overview"
        subtitle="Service health matrix"
        badge={<LiveIndicator />}
      />
      {loading && !rows.length ? (
        <EmptyState title="Loading services…" />
      ) : !rows.length ? (
        <EmptyState title="No APM services" hint="Observability feed is empty." />
      ) : (
        <div className={obs.tableWrap} role="region" aria-label="Service health table">
          <table className={obs.table}>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Status</th>
                <th scope="col">Latency</th>
                <th scope="col">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <ServiceHealthCard key={s.name} {...s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  )
}
