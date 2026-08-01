import { DashboardCard, WidgetHeader, MetricBadge } from '../components/ui'
import { InsightsCard } from '../components/observability'
import { AI_INSIGHTS } from '../constants/overviewData'
import obs from '../components/observability/obs.module.css'

export default function AiInsightsWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="AI Insights"
        subtitle="Recommendations"
        badge={<MetricBadge tone="info">Premium</MetricBadge>}
      />
      <div className={`${obs.stack} ${obs.scrollY}`}>
        {AI_INSIGHTS.map((i) => (
          <InsightsCard key={i.id} {...i} />
        ))}
      </div>
    </DashboardCard>
  )
}
