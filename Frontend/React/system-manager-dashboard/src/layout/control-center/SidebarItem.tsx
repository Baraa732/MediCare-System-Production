import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { ControlNavItem } from '../../types/dashboard'
import { MetricBadge } from '../../components/ui'
import styles from './shell.module.css'

export default function SidebarItem({
  item,
  collapsed,
  showIcon = true,
}: {
  item: ControlNavItem
  collapsed: boolean
  showIcon?: boolean
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        [styles.navItem, isActive ? styles.navItemActive : ''].join(' ')
      }
    >
      {(showIcon || collapsed) ? (
        <motion.span
          className={styles.navIcon}
          whileHover={{ scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          <Icon size={17} strokeWidth={1.9} />
        </motion.span>
      ) : null}
      {!collapsed ? (
        <>
          <span className={styles.navLabel}>{item.label}</span>
          {item.badge ? (
            <MetricBadge tone={item.badge.tone ?? 'info'}>{item.badge.label}</MetricBadge>
          ) : null}
        </>
      ) : null}
    </NavLink>
  )
}
