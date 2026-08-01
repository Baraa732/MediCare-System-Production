import { CircularProgress } from '@mui/material'
import styles from './ui.module.css'

export default function LoadingOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className={styles.overlay}>
      <CircularProgress size={28} sx={{ color: '#06b6d4' }} />
    </div>
  )
}
