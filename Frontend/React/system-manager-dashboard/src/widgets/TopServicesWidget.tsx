import { useMemo } from 'react'
import { ChartCard, LiveIndicator } from '../components/observability'
import { horizontalBarOption, CC_CHART } from '../charts'
import { TOP_SERVICES } from '../constants/overviewData'

export default function TopServicesWidget({ delay = 0 }: { delay?: number }) {
  const option = useMemo(
    () =>
      horizontalBarOption({
        labels: TOP_SERVICES.map((s) => s.name).reverse(),
        values: TOP_SERVICES.map((s) => s.requests).reverse(),
        color: CC_CHART.cyan,
      }),
    [],
  )

  return (
    <ChartCard
      title="Top Services by Requests"
      subtitle="Last 24 hours"
      badge={<LiveIndicator />}
      option={option}
      height={200}
      delay={delay}
      minHeight={280}
      ariaLabel="Top services by requests"
    />
  )
}
