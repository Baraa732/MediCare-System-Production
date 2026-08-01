import {
  DashboardCard,
  EmptyState,
  MiniChartContainer,
  WidgetHeader,
  MetricBadge,
} from '../components/ui'
import type { HealthTone } from '../types/dashboard'

export default function PlaceholderWidget({
  title,
  subtitle,
  badge,
  badgeTone = 'info',
  minHeight = 220,
  delay = 0,
  mode = 'chart',
  emptyTitle,
  emptyHint,
}: {
  title: string
  subtitle?: string
  badge?: string
  badgeTone?: HealthTone
  minHeight?: number
  delay?: number
  mode?: 'chart' | 'empty'
  emptyTitle?: string
  emptyHint?: string
}) {
  return (
    <DashboardCard minHeight={minHeight} delay={delay}>
      <WidgetHeader
        title={title}
        subtitle={subtitle}
        badge={badge ? <MetricBadge tone={badgeTone}>{badge}</MetricBadge> : undefined}
      />
      {mode === 'chart' ? (
        <MiniChartContainer label={`${title} · reserved`} height={minHeight - 72} />
      ) : (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      )}
    </DashboardCard>
  )
}
