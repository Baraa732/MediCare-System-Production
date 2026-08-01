import { DashboardCard, WidgetHeader } from '../components/ui'
import { LiveIndicator, MapCard } from '../components/observability'
import { INFRA_LINKS, INFRA_REGIONS } from '../constants/overviewData'

export default function InfrastructureMapWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="Infrastructure Map"
        subtitle="Regions & mesh links"
        badge={<LiveIndicator />}
      />
      <MapCard regions={[...INFRA_REGIONS]} links={INFRA_LINKS} />
    </DashboardCard>
  )
}
