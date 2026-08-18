import type { ControlNavSection } from '../../types/dashboard'
import SidebarItem from './SidebarItem'
import styles from './shell.module.css'

export default function SidebarGroup({
  section,
  collapsed,
  showLabel = true,
  showIcons = true,
}: {
  section: ControlNavSection
  collapsed: boolean
  showLabel?: boolean
  showIcons?: boolean
}) {
  return (
    <div>
      {!collapsed && showLabel ? <div className={styles.sectionLabel}>{section.label}</div> : null}
      {section.items.map((item) => (
        <SidebarItem key={item.path + item.label} item={item} collapsed={collapsed} showIcon={showIcons} />
      ))}
    </div>
  )
}
