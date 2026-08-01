import { DashboardCard, WidgetHeader, MetricBadge, EmptyState } from '../components/ui'
import { InsightsCard } from '../components/observability'
import obs from '../components/observability/obs.module.css'

export default function AiInsightsWidget({
  delay = 0,
  insights = [],
}: {
  delay?: number
  insights?: Array<{ id: string; title: string; body: string; confidence: number }>
}) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="AI Insights"
        subtitle="Rule-based from live signals"
        badge={<MetricBadge tone="info">Live rules</MetricBadge>}
      />
      {!insights.length ? (
        <EmptyState title="No recommendations" hint="Signals look healthy for this range." />
      ) : (
        <div className={`${obs.stack} ${obs.scrollY}`}>
          {insights.map((i) => (
            <InsightsCard key={i.id} {...i} />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
