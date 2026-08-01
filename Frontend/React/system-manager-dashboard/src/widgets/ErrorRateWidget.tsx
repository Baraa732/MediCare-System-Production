import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { SparklineCard } from '../components/observability'
import { CC_CHART } from '../charts'
import type { PlatformObservability } from '../api/types'
import obs from '../components/observability/obs.module.css'

export default function ErrorRateWidget({
  delay = 0,
  observability,
}: {
  delay?: number
  observability?: PlatformObservability | null
}) {
  const rows = [...(observability?.apm.services ?? [])]
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 8)

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Error Rate by Service" subtitle="Live error %" />
      {!rows.length ? (
        <EmptyState title="No error series" />
      ) : (
        <div className={obs.stack} role="list" aria-label="Error rate by service">
          {rows.map((s) => (
            <div key={s.name} className={obs.errorRow} role="listitem">
              <span className={obs.strong}>{s.name}</span>
              <span className={obs.errorRate}>{s.errorRate.toFixed(2)}%</span>
              <SparklineCard
                data={s.errorSeries?.length ? s.errorSeries : s.series}
                color={
                  s.errorRate > 1
                    ? CC_CHART.red
                    : s.errorRate > 0.2
                      ? CC_CHART.amber
                      : CC_CHART.green
                }
                ariaLabel={`${s.name} error rate`}
              />
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
