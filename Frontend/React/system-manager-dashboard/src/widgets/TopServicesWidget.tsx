import { useMemo } from 'react'
import { ChartCard, LiveIndicator } from '../components/observability'
import { EmptyState } from '../components/ui'
import { horizontalBarOption, CC_CHART } from '../charts'
import type { PlatformObservability } from '../api/types'

export default function TopServicesWidget({
  delay = 0,
  observability,
}: {
  delay?: number
  observability?: PlatformObservability | null
}) {
  const option = useMemo(() => {
    const sorted = [...(observability?.apm.services ?? [])]
      .sort((a, b) => b.reqRate - a.reqRate)
      .slice(0, 8)
    if (!sorted.length) return null
    return horizontalBarOption({
      labels: sorted.map((s) => s.name).reverse(),
      values: sorted.map((s) => s.reqRate).reverse(),
      color: CC_CHART.cyan,
    })
  }, [observability])

  if (!option) {
    return (
      <ChartCard title="Top Services by Requests" delay={delay} minHeight={280} badge={<LiveIndicator />}>
        <EmptyState title="No request rates" />
      </ChartCard>
    )
  }

  return (
    <ChartCard
      title="Top Services by Requests"
      subtitle="Live req/s"
      badge={<LiveIndicator />}
      option={option}
      height={200}
      delay={delay}
      minHeight={280}
      ariaLabel="Top services by request rate"
    />
  )
}
