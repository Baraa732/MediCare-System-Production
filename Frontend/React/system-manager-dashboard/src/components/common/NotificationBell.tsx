import { useState } from 'react'
import {
  Box,
  Typography,
  Popover,
  IconButton,
  Badge,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material'
import { Bell, CheckCheck } from 'lucide-react'
import { useTheme } from '@mui/material/styles'
import { useNotifications } from '../../features/notifications/NotificationProvider'

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
  const {
    items,
    unreadCount,
    permission,
    pushEnabled,
    isLoading,
    refreshInbox,
    markRead,
    markAllRead,
    requestPushPermission,
  } = useNotifications()

  const needsPermission =
    permission === 'default' || (permission === 'granted' && !pushEnabled)

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
        slotProps={{ paper: { sx: { width: 360, mt: 0.5 } } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4">Notifications</Typography>
            <Typography variant="caption2" sx={{ color: 'text.secondary' }}>
              Platform alerts via Firebase
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

        <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
          {isLoading && items.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={20} />
            </Box>
          ) : items.length === 0 ? (
            <Box sx={{ px: 2, py: 3 }}>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, textAlign: 'center' }}>
                No notifications yet
              </Typography>
            </Box>
          ) : (
            items.map((item) => {
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
                    {formatRelativeTime(item.createdAt)}
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
