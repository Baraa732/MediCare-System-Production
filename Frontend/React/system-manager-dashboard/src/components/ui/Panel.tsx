import DashboardCard from './DashboardCard'

export default function Panel({
  children,
  minHeight,
}: {
  children: React.ReactNode
  minHeight?: number | string
}) {
  return <DashboardCard minHeight={minHeight}>{children}</DashboardCard>
}
