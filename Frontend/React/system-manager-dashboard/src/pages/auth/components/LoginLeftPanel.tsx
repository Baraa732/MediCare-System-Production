import { Box, Typography, alpha } from '@mui/material'
import { Activity, Building2, KeyRound, Shield, Users } from 'lucide-react'
import AuthLottieHero from './AuthLottieHero'

const CAPABILITIES = [
  { icon: KeyRound, label: 'Activation codes & clinic onboarding' },
  { icon: Building2, label: 'Multi-clinic platform oversight' },
  { icon: Users, label: 'Users, roles & access governance' },
  { icon: Activity, label: 'Live telemetry & operational health' },
  { icon: Shield, label: 'Audited administrator sessions' },
]

export default function LoginLeftPanel() {
  return (
    <Box
      data-login-left
      sx={{
        flex: { xs: '0 0 auto', lg: '1 1 48%' },
        minHeight: { xs: 'auto', lg: '100vh' },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        px: { xs: 3, sm: 5, lg: 7 },
        py: { xs: 4, lg: 6 },
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #0b1224 0%, #111827 42%, #1e3a8a 100%)',
        color: '#f8fafc',
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(59,130,246,0.35), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(14,165,233,0.2), transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 520, mx: { xs: 'auto', lg: 0 } }}>
        <Box data-login-lottie>
          <AuthLottieHero size={300} />
        </Box>

        <Typography
          data-login-eyebrow
          component="p"
          sx={{
            mt: 3,
            fontSize: { xs: 11, sm: 12 },
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: alpha('#93c5fd', 0.95),
          }}
        >
          Centers for Medicare &amp; Medicaid Services
        </Typography>

        <Typography
          data-login-headline
          variant="h3"
          sx={{
            mt: 1.5,
            fontWeight: 700,
            fontSize: { xs: '1.65rem', sm: '2rem', lg: '2.15rem' },
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
          }}
        >
          MediCare Command Center
        </Typography>

        <Typography
          data-login-subcopy
          sx={{
            mt: 1.5,
            color: alpha('#e2e8f0', 0.82),
            fontSize: { xs: 14, sm: 15 },
            lineHeight: 1.65,
            maxWidth: 440,
          }}
        >
          Secure platform administration for clinic activation, tenant operations,
          and nationwide healthcare infrastructure monitoring.
        </Typography>

        <Box
          sx={{
            mt: 4,
            display: 'grid',
            gap: 1.25,
          }}
        >
          {CAPABILITIES.map(({ icon: Icon, label }) => (
            <Box
              key={label}
              data-login-cap
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                py: 0.75,
                px: 1.25,
                borderRadius: 2,
                bgcolor: alpha('#fff', 0.04),
                border: `1px solid ${alpha('#fff', 0.08)}`,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha('#3b82f6', 0.2),
                  color: '#93c5fd',
                  flexShrink: 0,
                }}
              >
                <Icon size={16} />
              </Box>
              <Typography sx={{ fontSize: 13, color: alpha('#f1f5f9', 0.9) }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
