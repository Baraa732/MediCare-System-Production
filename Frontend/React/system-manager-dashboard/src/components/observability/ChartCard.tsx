import type { EChartsOption } from 'echarts'
import { DashboardCard, WidgetHeader } from '../ui'
import { ChartShell, type ChartHeight } from '../../charts'

export default function ChartCard({
  title,
  subtitle,
  badge,
  option,
  height = 200,
  delay = 0,
  ariaLabel,
  minHeight = 240,
  children,
}: {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  option?: EChartsOption
  height?: ChartHeight
  delay?: number
  ariaLabel?: string
  minHeight?: number
  children?: React.ReactNode
}) {
  return (
    <DashboardCard minHeight={minHeight} delay={delay}>
      <WidgetHeader title={title} subtitle={subtitle} badge={badge} />
      {option ? (
        <ChartShell
          option={option}
          height={height}
          ariaLabel={ariaLabel ?? title}
        />
      ) : (
        children
      )}
    </DashboardCard>
  )
}
