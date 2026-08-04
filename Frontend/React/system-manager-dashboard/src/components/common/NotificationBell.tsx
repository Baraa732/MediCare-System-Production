import { useMemo, useState } from 'react'
import {
  Box,
  Typography,
  Popover,
  IconButton,
  Badge,
  Divider,
  Button,
  CircularProgress,
  Chip,
} from '@mui/material'
import { Bell, CheckCheck } from 'lucide-react'
import { useTheme } from '@mui/material/styles'
import { useNotifications } from '../../features/notifications/NotificationProvider'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'APPOINTMENT_CREATED', label: 'Created' },
  { id: 'APPOINTMENT_UPDATED', label: 'Updated' },
  { id: 'APPOINTMENT_CANCELLED', label: 'Cancelled' },
  { id: 'APPOINTMENT_REQUESTED', label: 'Requested' },
  { id: 'SYSTEM', label: 'System' },
] as const

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationBell() {
  const theme = useTheme()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const {
    items,
    unreadCount,
    permission,
    pushEnabled,
    isLoading,
    lastError,
    refreshInbox,
    markRead,
    markAllRead,
    requestPushPermission,
  } = useNotifications()

  const needsPermission =
    permission === 'default' || (permission === 'granted' && !pushEnabled)

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'unread') return items.filter((i) => !i.readAt)
    return items.filter((i) => i.category === filter)
  }, [filter, items])

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => {
          setAnchor(e.currentTarget)
          void refreshInbox()
        }}
        sx={{ color: '#8b93a8' }}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}
        >
          <Bell size={18} />
        </Badge>
      </IconButton>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, mt: 0.5 } } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4">Notifications</Typography>
            <Typography variant="caption2" sx={{ color: 'text.secondary' }}>
              Inbox · push · polling{pushEnabled ? ' · FCM on' : ''}
            </Typography>
          </Box>
          {unreadCount > 0 ? (
            <Button
              size="small"
              startIcon={<CheckCheck size={14} />}
              onClick={() => void markAllRead()}
              sx={{ fontSize: 11 }}
            >
              Mark all read
            </Button>
          ) : null}
        </Box>
        <Divider />

        {needsPermission ? (
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'rgba(6, 182, 212, 0.08)', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="caption2" sx={{ display: 'block', mb: 1, color: 'text.secondary' }}>
              Enable browser notifications to receive platform alerts when this tab is in the background.
            </Typography>
            <Button size="small" variant="contained" onClick={() => void requestPushPermission()}>
              Enable notifications
            </Button>
          </Box>
        ) : null}

        {lastError ? (
          <Box sx={{ px: 2, py: 1, bgcolor: 'rgba(239,68,68,0.08)', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="caption2" sx={{ color: '#f87171' }}>
              {lastError}
            </Typography>
          </Box>
        ) : null}

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.75,
            px: 1.5,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              size="small"
              label={f.label}
              onClick={() => setFilter(f.id)}
              color={filter === f.id ? 'primary' : 'default'}
              variant={filter === f.id ? 'filled' : 'outlined'}
              sx={{ height: 24, fontSize: 11 }}
            />
          ))}
        </Box>

        <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
          {isLoading && items.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={20} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ px: 2, py: 3 }}>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, textAlign: 'center' }}>
                No notifications in this view
              </Typography>
            </Box>
          ) : (
            filtered.map((item) => {
              const unread = !item.readAt
              return (
                <Box
                  key={item.id}
                  onClick={() => unread && void markRead(item.id)}
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                    cursor: unread ? 'pointer' : 'default',
                    bgcolor: unread ? 'rgba(6, 182, 212, 0.06)' : 'transparent',
                    '&:hover': { bgcolor: 'background.hover' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12 }}>
                      {item.title}
                    </Typography>
                    {unread ? (
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#06b6d4', flexShrink: 0, mt: 0.5 }} />
                    ) : null}
                  </Box>
                  <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, lineHeight: 1.4 }}>
                    {item.body}
                  </Typography>
                  <Typography variant="caption2" sx={{ color: 'text.disabled', mt: 0.5, display: 'block', fontSize: 10 }}>
                    {item.category.replace(/_/g, ' ')} · {formatRelativeTime(item.createdAt)}
                  </Typography>
                </Box>
              )
            })
          )}
        </Box>
      </Popover>
    </>
  )
}
