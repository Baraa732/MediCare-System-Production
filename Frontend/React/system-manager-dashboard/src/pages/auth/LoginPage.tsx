import { Box, Typography, alpha } from '@mui/material'
import { ShieldCheck } from 'lucide-react'
import { useLoginMotion } from '../../components/motion/useLoginMotion'
import LoginLeftPanel from './components/LoginLeftPanel'
import LoginForm from './components/LoginForm'

export default function LoginPage() {
  const rootRef = useLoginMotion()

  return (
    <Box
      ref={rootRef}
      className="login-ambient-root"
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', lg: 'row' },
        minHeight: '100vh',
        bgcolor: '#f1f5f9',
      }}
    >
      <Box aria-hidden className="login-ambient-orb login-ambient-orb--a" />
      <Box aria-hidden className="login-ambient-orb login-ambient-orb--b" />

      <LoginLeftPanel />

      <Box
        data-login-right
        className="login-right-bg"
        sx={{
          flex: { xs: '1 1 auto', lg: '1 1 52%' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2.5, sm: 4 },
          py: { xs: 4, lg: 6 },
          position: 'relative',
        }}
      >
        <Box
          data-login-card
          className="login-card-shine"
          sx={{
            width: '100%',
            maxWidth: 440,
            p: { xs: 3, sm: 4 },
            borderRadius: 4,
            bgcolor: '#fff',
            border: '1px solid',
            borderColor: alpha('#64748b', 0.12),
            boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(255,255,255,0.8) inset',
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography
              data-login-form-title
              variant="overline"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                letterSpacing: '0.12em',
                fontSize: 11,
              }}
            >
              System Manager
            </Typography>
            <Typography
              data-login-form-title
              variant="h4"
              sx={{
                mt: 0.5,
                fontWeight: 700,
                fontSize: { xs: '1.5rem', sm: '1.75rem' },
                letterSpacing: '-0.02em',
                color: '#0f172a',
              }}
            >
              Sign in
            </Typography>
            <Typography data-login-form-title variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
              Platform administrator access — verified by the MediCare API gateway.
            </Typography>
          </Box>

          <LoginForm />

          <Box
            data-login-footer
            sx={{
              mt: 3,
              p: 1.75,
              display: 'flex',
              gap: 1.25,
              alignItems: 'flex-start',
              borderRadius: 2.5,
              bgcolor: alpha('#3b82f6', 0.06),
              border: '1px solid',
              borderColor: alpha('#3b82f6', 0.18),
            }}
          >
            <ShieldCheck size={18} color="#2563eb" style={{ marginTop: 2, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.55, fontSize: 12 }}>
              Sessions use signed JWTs with automatic expiry and client-side lockout
              after repeated failed attempts. Credentials are never stored in the browser.
            </Typography>
          </Box>

          <Typography
            data-login-footer
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              mt: 2.5,
              color: alpha('#64748b', 0.9),
              fontSize: 11,
            }}
          >
            Centers for Medicare &amp; Medicaid Services · MediCare Platform
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
