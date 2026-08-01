import { DashboardCard, WidgetHeader } from '../components/ui'
import { SparklineCard } from '../components/observability'
import { CC_CHART } from '../charts'
import { ERROR_RATE_SERIES } from '../constants/overviewData'
import obs from '../components/observability/obs.module.css'

export default function ErrorRateWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Error Rate by Service" subtitle="Rolling 1h window" />
      <div className={obs.stack} role="list" aria-label="Error rate by service">
        {ERROR_RATE_SERIES.map((s) => (
          <div key={s.name} className={obs.errorRow} role="listitem">
            <span className={obs.strong}>{s.name}</span>
            <span className={obs.errorRate}>{s.rate.toFixed(2)}%</span>
            <SparklineCard
              data={s.spark}
              color={s.rate > 1 ? CC_CHART.red : s.rate > 0.2 ? CC_CHART.amber : CC_CHART.green}
              ariaLabel={`${s.name} error rate`}
            />
          </div>
        ))}
      </div>
    </DashboardCard>
  )
}
