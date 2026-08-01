import { DashboardCard, WidgetHeader } from '../components/ui'
import {
  LiveIndicator,
  ServiceHealthCard,
} from '../components/observability'
import { SERVICES_OVERVIEW } from '../constants/overviewData'
import obs from '../components/observability/obs.module.css'

export default function SystemOverviewWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="System Overview"
        subtitle="Service health matrix"
        badge={<LiveIndicator />}
      />
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
            {SERVICES_OVERVIEW.map((s) => (
              <ServiceHealthCard key={s.name} {...s} />
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  )
}
