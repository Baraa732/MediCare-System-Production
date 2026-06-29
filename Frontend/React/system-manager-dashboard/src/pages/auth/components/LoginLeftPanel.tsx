import { Box, Typography, Divider } from '@mui/material'
import { Plus, Check } from 'lucide-react'
import { useTheme } from '@mui/material/styles'

export default function LoginLeftPanel() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ flex: '0 0 45%', bgcolor: isDark ? '#0f1117' : '#1f2937', display: 'flex', flexDirection: 'column', justifyContent: 'center', p: 8, minHeight: '100vh' }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={22} color={theme.palette.primary.contrastText} strokeWidth={3} />
          </Box>
          <Box>
            <Typography sx={{ color: 'primary.main', fontWeight: 600, fontSize: 22, lineHeight: 1 }}>MediCare</Typography>
            <Typography sx={{ color: isDark ? theme.palette.text.secondary : '#d1d5db', fontSize: 12 }}>System Manager</Typography>
          </Box>
        </Box>
        <Typography variant="body1" sx={{ color: isDark ? theme.palette.text.secondary : '#d1d5db', mb: 4, lineHeight: 1.6, maxWidth: 380 }}>
          Platform administration for the MediCare clinic management system.
        </Typography>
        <Divider sx={{ borderColor: isDark ? '#1f2535' : '#374151', mb: 3 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 }}>
          {[
            'Issue & revoke clinic activation codes',
            'Register and monitor clinics',
            'Oversee every platform user & role',
            'Manage platform administrators',
            'Secure, audited admin access',
          ].map((feat) => (
            <Box key={feat} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Check size={16} color={theme.palette.primary.main} />
              <Typography variant="body2" sx={{ color: isDark ? theme.palette.text.secondary : '#d1d5db', fontSize: 14 }}>{feat}</Typography>
            </Box>
          ))}
        </Box>
        <Divider sx={{ borderColor: isDark ? '#1f2535' : '#374151', mb: 4 }} />
        <Typography variant="caption2" sx={{ color: isDark ? theme.palette.text.disabled : '#9ca3af', fontSize: 11 }}>
          MediCare Platform &bull; System Manager Console
        </Typography>
      </Box>
    </Box>
  )
}
