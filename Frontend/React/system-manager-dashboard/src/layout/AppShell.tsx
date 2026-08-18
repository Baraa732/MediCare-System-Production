import { Box, Breadcrumbs, Typography } from '@mui/material'
import { useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import GlobalSearch from '../components/common/GlobalSearch'
import { useLiveStreamSync } from '../hooks/useLiveStreamSync'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import { useUIStore } from '../store/uiStore'

const breadcrumbMap: Record<string, string> = {
  '/': 'Dashboard',
  '/activation-codes': 'Activation Codes',
  '/clinics': 'Clinics',
  '/users': 'Platform Users',
  '/administrators': 'Administrators',
  '/monitoring': 'Monitoring',
  '/metrics': 'Metrics',
  '/logs': 'Logs',
  '/traces': 'Traces',
  '/apm': 'APM',
  '/observability/service-map': 'Service Map',
  '/bi': 'Business Intelligence',
  '/monitors': 'Monitors',
  '/alerts': 'Alerts',
  '/integrations': 'Integrations',
  '/settings': 'Settings',
  '/profile': 'Profile',
  '/docs': 'Documentation',
}

function getBreadcrumbs(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return ['Dashboard']

  const result: string[] = [breadcrumbMap['/' + segments[0]] || segments[0]]

  if (segments.length > 1) {
    result.push(segments[1])
  }

  return result
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  useLiveStreamSync()
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const themeMode = useUIStore((s) => s.themeMode)
  const location = useLocation()
  const sidebarWidth = sidebarCollapsed ? 56 : 220
  const crumbs = getBreadcrumbs(location.pathname)

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <GlobalSearch />
      <Topbar />
      <Sidebar />

      <Box
        sx={{
          position: 'fixed',
          top: 48,
          left: sidebarWidth,
          right: 0,
          height: 32,
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          px: 2,
          zIndex: 900,
          transition: 'left 200ms ease',
        }}
      >
        <Breadcrumbs
          separator={<Typography sx={{ color: 'text.disabled', fontSize: 12 }}>/</Typography>}
          sx={{ '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' } }}
        >
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>MediCare</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>System Manager</Typography>
          {crumbs.map((crumb, i) => (
            <Typography key={i} sx={{ fontSize: 12, color: i === crumbs.length - 1 ? 'text.primary' : 'text.secondary' }}>
              {crumb}
            </Typography>
          ))}
        </Breadcrumbs>
      </Box>

      <Box
        sx={{
          marginLeft: `${sidebarWidth}px`,
          marginTop: '80px',
          transition: 'margin-left 200ms ease',
          minHeight: 'calc(100vh - 80px)',
          bgcolor: 'background.default',
          overflow: 'auto',
        }}
      >
        {children}
      </Box>

      <Toaster
        position="bottom-right"
        theme={themeMode}
        toastOptions={{
          style: {
            background: themeMode === 'dark' ? '#1c2333' : '#ffffff',
            border: `1px solid ${themeMode === 'dark' ? '#2a3147' : '#e5e7eb'}`,
            color: themeMode === 'dark' ? '#e8eaf0' : '#111827',
            fontSize: '13px',
            borderRadius: '4px',
          },
        }}
      />
    </Box>
  )
}
