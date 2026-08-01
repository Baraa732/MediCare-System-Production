import { Search } from 'lucide-react'
import styles from '../ui/ui.module.css'

export default function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel = 'Search',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
}) {
  return (
    <label className={styles.searchInput}>
      <Search size={14} aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </label>
  )
}
