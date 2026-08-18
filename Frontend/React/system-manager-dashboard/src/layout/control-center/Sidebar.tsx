import { useMemo } from 'react'
import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMediaQuery } from '@mui/material'
import { useUIStore } from '../../store/uiStore'
import { useSettingsStore } from '../../store/settingsStore'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { useIncidentPersistence } from '../../hooks/useIncidentPersistence'
import { applyIncidentState, buildPlatformAlerts, firingAlerts } from '../../lib/platformAlerts'
import { CC } from '../../theme/tokens'
import { controlNavSections } from './navConfig'
import SidebarGroup from './SidebarGroup'
import styles from './shell.module.css'

export default function Sidebar() {
  const collapsedStore = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const themeMode = useUIStore((s) => s.themeMode)
  const toggleThemeMode = useUIStore((s) => s.toggleThemeMode)
  const density = useSettingsStore((s) => s.density)
  const showSectionLabels = useSettingsStore((s) => s.showSectionLabels)
  const showIcons = useSettingsStore((s) => s.showIcons)
  const isMobile = useMediaQuery('(max-width:900px)')
  const reduced = usePrefersReducedMotion()
  const collapsed = isMobile || collapsedStore
  const width = collapsed ? CC.layout.sidebarCollapsed : CC.layout.sidebarExpanded

  const obs = useObservabilityData(undefined, true)
  const incidents = useIncidentPersistence()
  const firingCount = useMemo(
    () =>
      firingAlerts(applyIncidentState(buildPlatformAlerts({ observability: obs.data }), incidents.records))
        .length,
    [obs.data, incidents.records],
  )

  const sections = useMemo(
    () =>
      controlNavSections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.path === '/alerts'
            ? {
                ...item,
                badge:
                  firingCount > 0
                    ? { label: String(firingCount), tone: 'error' as const }
                    : undefined,
              }
            : item,
        ),
      })),
    [firingCount],
  )

  return (
    <motion.aside
      className={styles.sidebar}
      data-density={density}
      initial={false}
      animate={{ width }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: 'spring', stiffness: 260, damping: 28 }
      }
    >
      <div className={styles.sidebarScroll}>
        {sections.map((section) => (
          <SidebarGroup
            key={section.id}
            section={section}
            collapsed={collapsed}
            showLabel={showSectionLabels}
            showIcons={showIcons}
          />
        ))}
      </div>

      <div className={styles.sidebarFooter}>
        <button type="button" className={styles.collapseBtn} onClick={toggleThemeMode}>
          {themeMode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {!collapsed ? (themeMode === 'dark' ? 'Light mode' : 'Dark mode') : null}
        </button>
        {!isMobile ? (
          <button type="button" className={styles.collapseBtn} onClick={toggleSidebar}>
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            {!collapsed ? 'Collapse' : null}
          </button>
        ) : null}
        {!collapsed ? <div className={styles.version}>MediCare SM · v0.1.0</div> : null}
      </div>
    </motion.aside>
  )
}
