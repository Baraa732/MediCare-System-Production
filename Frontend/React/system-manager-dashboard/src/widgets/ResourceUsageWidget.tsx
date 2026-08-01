import { useMemo } from 'react'
import { ChartCard, LiveIndicator } from '../components/observability'
import { EmptyState } from '../components/ui'
import { multiLineOption, CC_CHART } from '../charts'
import type { PlatformObservability } from '../api/types'

export default function ResourceUsageWidget({
  delay = 0,
  observability,
}: {
  delay?: number
  observability?: PlatformObservability | null
}) {
  const option = useMemo(() => {
    const tp = observability?.apm.throughput
    if (!tp?.timestamps?.length) return null
    return multiLineOption({
      labels: tp.timestamps.map((t) =>
        new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      ),
      series: [
        { name: 'Requests', data: tp.total, color: CC_CHART.cyan },
        { name: 'Errors', data: tp.errors, color: CC_CHART.red },
      ],
    })
  }, [observability])

  if (!option) {
    return (
      <ChartCard
        title="Resource Usage"
        subtitle="Throughput"
        badge={<LiveIndicator />}
        delay={delay}
        minHeight={280}
      >
        <EmptyState title="No throughput series" hint="Waiting for Prometheus rate data." />
      </ChartCard>
    )
  }

  return (
    <ChartCard
      title="Resource Usage"
      subtitle={`${observability?.apm.throughput?.unit ?? 'req/s'} · ${observability?.apm.throughput?.source ?? 'live'}`}
      badge={<LiveIndicator />}
      option={option}
      height={200}
      delay={delay}
      minHeight={280}
      ariaLabel="Request throughput chart"
    />
  )
}
