import { useMemo } from 'react'
import { ChartShell, sparklineOption, CC_CHART } from '../../charts'

export default function SparklineCard({
  data,
  color = CC_CHART.cyan,
  ariaLabel = 'Sparkline',
}: {
  data: number[]
  color?: string
  ariaLabel?: string
}) {
  const option = useMemo(() => sparklineOption(data, color), [data, color])
  return <ChartShell option={option} height={28} ariaLabel={ariaLabel} />
}
