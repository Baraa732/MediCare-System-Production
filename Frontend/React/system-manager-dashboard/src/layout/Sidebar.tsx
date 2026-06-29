import { Box, Divider, IconButton, List, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material'
import { NavLink, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { navSections } from './navConfig'

function isActivePath(pathname: string, path: string) {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

export default function Sidebar() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { showSectionLabels, showIcons, density } = useSettingsStore()

  const effectiveCollapsed = isMobile ? true : sidebarCollapsed
  const width = effectiveCollapsed ? 56 : 220
  const itemHeight = density === 'compact' ? 30 : density === 'comfortable' ? 38 : 34

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        top: 48,
        width,
        height: 'calc(100vh - 48px)',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        transition: 'width 200ms ease',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 'none',
      }}
    >
      <List
        sx={{
          flex: 1,
          overflow: 'auto',
          pt: 1,
          pb: 1,
          scrollbarWidth: 'thin',
          scrollbarColor: `${theme.palette.divider} transparent`,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 8 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
        }}
      >
        {navSections.map((section) => (
          <Box key={section.label} sx={{ mb: 0.5 }}>
            {!effectiveCollapsed && showSectionLabels ? (
              <Typography
                sx={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'text.disabled',
                  px: 2.5,
                  pt: 2,
                  pb: 0.5,
                  lineHeight: 1.2,
                }}
              >
                {section.label}
              </Typography>
            ) : effectiveCollapsed && showSectionLabels ? (
              <Divider sx={{ mx: 1.5, my: 1.25, borderColor: 'divider' }} />
            ) : null}

            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = isActivePath(location.pathname, item.path)

              return (
                <Tooltip
                  key={item.path}
                  title={effectiveCollapsed ? item.label : ''}
                  placement="right"
                  arrow
                  enterDelay={250}
                >
                  <Box
                    component={NavLink}
                    to={item.path}
                    aria-label={item.label}
                    sx={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                      height: itemHeight,
                      px: effectiveCollapsed ? 0 : 1.5,
                      mx: 1,
                      my: '1px',
                      borderRadius: '4px',
                      color: isActive ? 'text.primary' : 'text.secondary',
                      bgcolor: isActive ? 'background.selected' : 'transparent',
                      textDecoration: 'none',
                      gap: 1.5,
                      outline: 'none',
                      transition: 'background-color 120ms ease, color 120ms ease',
                      '&:before': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: 6,
                        bottom: 6,
                        width: 2,
                        borderRadius: '0 2px 2px 0',
                        bgcolor: isActive ? 'primary.main' : 'transparent',
                      },
                      '&:hover': { bgcolor: 'background.hover', color: 'text.primary' },
                      '&:focus-visible': {
                        boxShadow: `0 0 0 2px ${theme.palette.primary.main}33`,
                      },
                    }}
                  >
                    {showIcons && (
                      <Icon
                        size={16}
                        strokeWidth={isActive ? 2.2 : 1.8}
                        style={{ flexShrink: 0 }}
                      />
                    )}
                    {showSectionLabels && !effectiveCollapsed && (
                      <Typography
                        sx={{
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 400,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.label}
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              )
            })}
          </Box>
        ))}
      </List>

      {!effectiveCollapsed && (
        <Box sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider' }}>
          <Box
            sx={{
              px: 1,
              py: 0.75,
              borderRadius: '4px',
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption2" sx={{ color: 'text.disabled', display: 'block' }}>
              Workspace
            </Typography>
            <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600 }}>
              MediCare Platform
            </Typography>
          </Box>
        </Box>
      )}

      {!isMobile && (
        <Box sx={{ borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-end', p: 1 }}>
          <Tooltip title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right" arrow>
            <IconButton
              onClick={toggleSidebar}
              size="small"
              sx={{
                color: 'text.secondary',
                borderRadius: '4px',
                '&:hover': { bgcolor: 'background.hover', color: 'text.primary' },
              }}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  )
}
