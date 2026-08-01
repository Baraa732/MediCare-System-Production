import { DashboardCard, WidgetHeader } from '../components/ui'
import { GaugeCard, LiveIndicator } from '../components/observability'
import { SYSTEM_LOAD } from '../constants/overviewData'

export default function LiveSystemLoadWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="Live System Load"
        subtitle="CPU · RAM · Disk · Network"
        badge={<LiveIndicator />}
      />
      <GaugeCard {...SYSTEM_LOAD} />
    </DashboardCard>
  )
}
