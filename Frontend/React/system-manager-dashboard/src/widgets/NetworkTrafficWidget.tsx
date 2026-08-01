import { useMemo } from 'react'
import { ChartCard, LiveIndicator } from '../components/observability'
import { EmptyState } from '../components/ui'
import { areaDualOption, CC_CHART } from '../charts'
import type { PlatformObservability } from '../api/types'

export default function NetworkTrafficWidget({
  delay = 0,
  observability,
}: {
  delay?: number
  observability?: PlatformObservability | null
}) {
  const option = useMemo(() => {
    const tp = observability?.apm.throughput
    if (!tp?.timestamps?.length) return null
    return areaDualOption({
      labels: tp.timestamps.map((t) =>
        new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      ),
      a: { name: 'Ingress', data: tp.total, color: CC_CHART.cyan },
      b: { name: 'Errors', data: tp.errors, color: CC_CHART.purple },
    })
  }, [observability])

  if (!option) {
    return (
      <ChartCard title="Network Traffic" delay={delay} minHeight={280} badge={<LiveIndicator />}>
        <EmptyState title="No traffic series" hint="Egress unavailable — showing ingress/errors when ready." />
      </ChartCard>
    )
  }

  return (
    <ChartCard
      title="Network Traffic"
      subtitle="Ingress · errors (egress not exported)"
      badge={<LiveIndicator />}
      option={option}
      height={180}
      delay={delay}
      minHeight={280}
      ariaLabel="Network traffic"
    />
  )
}
