import { Box, Card, CardContent, CardHeader, Skeleton, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Link } from 'react-router-dom'
import type { PlatformLogEntry } from '../../api/types'
import { usePlatformLogs } from '../../hooks/usePlatformLogs'
import { LOG_LEVEL_COLORS, formatLogTime, getTableLogDisplay } from '../../pages/logs/logUtils'

export default function LogsPreview() {
  const theme = useTheme()
  const { entries, loading, error } = usePlatformLogs({ range: '15m', limit: 8 }, true, true)
  const preview = entries.slice(0, 8)

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader title="Recent Logs" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }} />
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={28} sx={{ mb: 0.5 }} />
          ))}

        {!loading && error && (
          <Typography variant="caption2" sx={{ color: 'error.main', display: 'block', p: 2 }}>
            {error}
          </Typography>
        )}

        {!loading &&
          !error &&
          preview.map((log: PlatformLogEntry) => {
            const display = getTableLogDisplay(log)
            return (
            <Box
              key={log.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 2,
                height: 28,
                borderBottom: `1px solid ${theme.palette.divider}`,
                '&:hover': { background: theme.palette.background.hover },
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Box
                sx={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: LOG_LEVEL_COLORS[log.level],
                  background: `${LOG_LEVEL_COLORS[log.level]}20`,
                  borderRadius: '3px',
                  px: 0.75,
                  py: 0.25,
                  mr: 1,
                  lineHeight: 1.2,
                  minWidth: 40,
                  textAlign: 'center',
                }}
              >
                {log.level}
              </Box>
              <Typography
                variant="caption2"
                sx={{
                  fontFamily: theme.typography.mono?.fontFamily,
                  color: theme.palette.text.disabled,
                  mr: 1,
                  minWidth: 52,
                }}
              >
                {formatLogTime(log.timestamp)}
              </Typography>
              <Typography
                variant="caption2"
                sx={{
                  fontFamily: theme.typography.mono?.fontFamily,
                  color: theme.palette.text.secondary,
                  mr: 1.5,
                  minWidth: 100,
                }}
              >
                {log.service}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: theme.typography.mono?.fontFamily,
                  color: theme.palette.text.primary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {display.headline}
              </Typography>
            </Box>
          )})}

        {!loading && !error && preview.length === 0 && (
          <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', p: 2 }}>
            No recent logs in the selected window.
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <Typography
            component={Link}
            to="/logs"
            variant="caption2"
            sx={{ color: theme.palette.primary.main, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            View all logs →
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}
