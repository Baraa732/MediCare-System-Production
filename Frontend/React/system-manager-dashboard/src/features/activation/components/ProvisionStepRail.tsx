import { Box, Typography } from '@mui/material'
import { Check } from 'lucide-react'
import { ACTIVATION_ACCENT, WIZARD_STEPS } from '../activationConstants'

type ProvisionStepRailProps = {
  activeStep: number
  onStepClick?: (index: number) => void
}

export default function ProvisionStepRail({ activeStep, onStepClick }: ProvisionStepRailProps) {
  return (
    <Box sx={{ px: { xs: 1.25, sm: 2 }, pt: 2, pb: 1.25 }}>
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
                  className="provision-rail-node"
                  data-active={active}
                  sx={{
                    borderColor: done || active ? ACTIVATION_ACCENT : 'rgba(148,163,184,0.35)',
                    bgcolor: done
                      ? ACTIVATION_ACCENT
                      : active
                        ? 'rgba(14,165,233,0.12)'
                        : '#fff',
                    color: done ? '#fff' : active ? ACTIVATION_ACCENT : '#94a3b8',
                    boxShadow: active ? `0 0 0 4px rgba(14,165,233,0.12)` : 'none',
                  }}
                >
                  {done ? <Check size={15} strokeWidth={3} /> : <Icon size={14} />}
                </Box>
                <Typography
                  sx={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    color: active ? ACTIVATION_ACCENT : done ? '#0f172a' : '#94a3b8',
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
                    bgcolor: index < activeStep ? ACTIVATION_ACCENT : 'rgba(148,163,184,0.28)',
                    transition: 'background-color 0.45s ease',
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
