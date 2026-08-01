import { SectionHeader } from '../../components/ui'
import PlaceholderWidget from '../../widgets/PlaceholderWidget'

export default function PlaceholderPage({
  title,
  description = 'Control Center placeholder — UI only, no backend wiring.',
}: {
  title: string
  description?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader title={title} meta={description} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: 12,
        }}
      >
        <div style={{ gridColumn: 'span 8' }}>
          <PlaceholderWidget
            title={`${title} workspace`}
            subtitle="Reserved visualization area"
            badge="Soon"
            minHeight={320}
          />
        </div>
        <div style={{ gridColumn: 'span 4' }}>
          <PlaceholderWidget
            title="Details"
            subtitle="Side panel"
            mode="empty"
            emptyTitle="No panel content"
            emptyHint="Connect data sources in a later phase."
            minHeight={320}
          />
        </div>
      </div>
    </div>
  )
}
