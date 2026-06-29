import { Box, Typography } from '@mui/material'
import { ShieldCheck } from 'lucide-react'
import { useTheme } from '@mui/material/styles'
import LoginLeftPanel from './components/LoginLeftPanel'
import LoginForm from './components/LoginForm'

export default function LoginPage() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <LoginLeftPanel />

      <Box sx={{ flex: '0 0 55%', bgcolor: 'background.paper', display: 'flex', justifyContent: 'center', px: 4, overflow: 'auto' }}>
        <Box sx={{ maxWidth: 400, width: '100%', py: 8 }}>
          <Typography variant="h2" sx={{ mb: 0.5 }}>Sign in</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Platform administrator access
          </Typography>

          <LoginForm />

          <Box
            sx={{
              mt: 3,
              p: 1.5,
              display: 'flex',
              gap: 1,
              alignItems: 'flex-start',
              background: isDark ? '#06b6d410' : '#eff6ff',
              border: '1px solid',
              borderColor: 'primary.main',
              borderRadius: '4px',
            }}
          >
            <ShieldCheck size={16} color={theme.palette.primary.main} style={{ marginTop: 2, flexShrink: 0 }} />
            <Typography variant="caption2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
              Sessions are protected with signed JWTs, automatic expiry, and brute-force
              lockout. Credentials are verified server-side by the MediCare gateway.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
