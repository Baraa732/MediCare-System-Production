import FilterDropdown from './FilterDropdown'

export default function DateSelector({
  value = 'Last 24h',
  onChange,
}: {
  value?: string
  onChange?: (v: string) => void
}) {
  return (
    <FilterDropdown
      label="Time range"
      value={value}
      onChange={onChange}
      options={['Last 15m', 'Last 1h', 'Last 24h', 'Last 7d', 'Last 30d']}
    />
  )
}
