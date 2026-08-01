import { Search } from 'lucide-react'
import styles from './ui.module.css'

export default function SearchInput({
  placeholder = 'Search services, logs, clinics…',
  value,
  onChange,
  style,
}: {
  placeholder?: string
  value?: string
  onChange?: (v: string) => void
  style?: React.CSSProperties
}) {
  return (
    <label className={styles.searchInput} style={style}>
      <Search size={15} />
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  )
}
