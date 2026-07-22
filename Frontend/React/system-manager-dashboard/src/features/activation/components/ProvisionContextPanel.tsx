import { Box, Chip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { ACTIVATION_ACCENT, ACTIVATION_SECONDARY, type WizardStepConfig } from '../activationConstants'

type ProvisionContextPanelProps = {
  step: WizardStepConfig
  activeStep: number
  totalSteps: number
  completionChecks: { label: string; done: boolean }[]
}

export default function ProvisionContextPanel({
  step,
  activeStep,
  totalSteps,
  completionChecks,
}: ProvisionContextPanelProps) {
  const theme = useTheme()
  const Icon = step.icon

  return (
    <Box
      sx={{
        height: '100%',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderRight: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.elevated, 0.45),
      }}
    >
      <Box>
        <Chip
          size="small"
          label={`Step ${activeStep + 1} of ${totalSteps}`}
          sx={{
            height: 22,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            bgcolor: alpha(ACTIVATION_ACCENT, 0.12),
            color: ACTIVATION_ACCENT,
            mb: 1.5,
          }}
        />
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: '6px',
            display: 'grid',
            placeItems: 'center',
            mb: 1.5,
            bgcolor: alpha(ACTIVATION_SECONDARY, 0.1),
            color: ACTIVATION_SECONDARY,
            border: `1px solid ${alpha(ACTIVATION_SECONDARY, 0.22)}`,
          }}
        >
          <Icon size={24} />
        </Box>
        <Typography variant="h4" sx={{ mb: 0.75 }}>
          {step.contextTitle}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.55 }}>
          {step.contextBody}
        </Typography>
      </Box>

      <Box
        sx={{
          p: 1.5,
          borderRadius: '5px',
          border: `1px solid ${alpha(ACTIVATION_ACCENT, 0.22)}`,
          bgcolor: alpha(ACTIVATION_ACCENT, 0.05),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
          <Sparkles size={14} color={ACTIVATION_ACCENT} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: ACTIVATION_ACCENT, letterSpacing: '0.06em' }}>
            GUIDANCE
          </Typography>
        </Box>
        {step.tips.map((tip) => (
          <Typography key={tip} variant="caption2" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
            • {tip}
          </Typography>
        ))}
      </Box>

      <Box sx={{ mt: 'auto' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 1, display: 'block' }}>
          Provisioning checklist
        </Typography>
        {completionChecks.map((item) => (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.4 }}>
            <CheckCircle2
              size={14}
              color={item.done ? theme.palette.status.success : theme.palette.text.secondary}
              style={{ opacity: item.done ? 1 : 0.45 }}
            />
            <Typography
              variant="caption2"
              sx={{ color: item.done ? 'text.primary' : 'text.secondary' }}
            >
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
