import type { WidgetHeaderProps } from '../../types/dashboard'
import styles from './ui.module.css'

export default function WidgetHeader({
  title,
  subtitle,
  action,
  badge,
}: WidgetHeaderProps) {
  return (
    <div className={styles.widgetHeader}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={styles.widgetTitle}>{title}</div>
          {badge}
        </div>
        {subtitle ? <div className={styles.widgetSubtitle}>{subtitle}</div> : null}
      </div>
      {action}
    </div>
  )
}
