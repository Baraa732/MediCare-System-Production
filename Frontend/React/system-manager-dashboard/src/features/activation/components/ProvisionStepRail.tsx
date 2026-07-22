import { Box, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { Check } from 'lucide-react'
import { ACTIVATION_ACCENT, WIZARD_STEPS } from '../activationConstants'

type ProvisionStepRailProps = {
  activeStep: number
  onStepClick?: (index: number) => void
}

export default function ProvisionStepRail({ activeStep, onStepClick }: ProvisionStepRailProps) {
  const theme = useTheme()

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pt: 2, pb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
        {WIZARD_STEPS.map((step, index) => {
          const Icon = step.icon
          const done = index < activeStep
          const active = index === activeStep
          const clickable = onStepClick && index <= activeStep

          return (
            <Box key={step.id} sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.75,
                  flex: 1,
                  minWidth: 0,
                  cursor: clickable ? 'pointer' : 'default',
                }}
                onClick={() => clickable && onStepClick(index)}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    border: '2px solid',
                    transition: 'all 0.35s ease',
                    borderColor: done || active ? ACTIVATION_ACCENT : theme.palette.divider,
                    bgcolor: done
                      ? ACTIVATION_ACCENT
                      : active
                        ? alpha(ACTIVATION_ACCENT, 0.12)
                        : 'background.paper',
                    color: done ? theme.palette.common.white : active ? ACTIVATION_ACCENT : 'text.secondary',
                    transform: active ? 'scale(1.08)' : 'scale(1)',
                    boxShadow: active ? `0 0 0 4px ${alpha(ACTIVATION_ACCENT, 0.15)}` : 'none',
                  }}
                >
                  {done ? <Check size={16} strokeWidth={3} /> : <Icon size={15} />}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    color: active ? ACTIVATION_ACCENT : done ? 'text.primary' : 'text.secondary',
                    lineHeight: 1.2,
                    display: { xs: 'none', sm: 'block' },
                  }}
                >
                  {step.label}
                </Typography>
              </Box>

              {index < WIZARD_STEPS.length - 1 && (
                <Box
                  sx={{
                    height: 2,
                    flex: 1,
                    borderRadius: 1,
                    mb: { xs: 0, sm: 2.5 },
                    bgcolor: index < activeStep ? ACTIVATION_ACCENT : alpha(theme.palette.divider, 0.9),
                    transition: 'background-color 0.5s ease',
                    minWidth: 8,
                  }}
                />
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
