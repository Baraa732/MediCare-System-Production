import { Box, Typography } from '@mui/material'
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
  const Icon = step.icon
  const doneCount = completionChecks.filter((c) => c.done).length

  return (
    <Box className="provision-context-panel">
      <Box>
        <Box className="provision-badge" sx={{ mb: 1.5, bgcolor: 'rgba(14,165,233,0.16)', color: '#7dd3fc', borderColor: 'rgba(125,211,252,0.28)' }}>
          Step {activeStep + 1} / {totalSteps}
        </Box>
        <Box
          sx={{
            width: 54,
            height: 54,
            borderRadius: '14px',
            display: 'grid',
            placeItems: 'center',
            mb: 1.5,
            bgcolor: 'rgba(20,184,166,0.14)',
            color: ACTIVATION_SECONDARY,
            border: '1px solid rgba(20,184,166,0.28)',
          }}
        >
          <Icon size={24} />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: '#f8fafc', mb: 0.75 }}>
          {step.contextTitle}
        </Typography>
        <Typography className="muted" sx={{ fontSize: 13, lineHeight: 1.6 }}>
          {step.contextBody}
        </Typography>
      </Box>

      <Box
        sx={{
          p: 1.5,
          borderRadius: '12px',
          border: '1px solid rgba(14,165,233,0.25)',
          bgcolor: 'rgba(14,165,233,0.08)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
          <Sparkles size={14} color={ACTIVATION_ACCENT} />
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#7dd3fc', letterSpacing: '0.08em' }}>
            GUIDANCE
          </Typography>
        </Box>
        {step.tips.map((tip) => (
          <Typography key={tip} className="muted" sx={{ display: 'block', fontSize: 12, mb: 0.65, lineHeight: 1.45 }}>
            • {tip}
          </Typography>
        ))}
      </Box>

      <Box sx={{ mt: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8' }}>
            Checklist
          </Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACTIVATION_SECONDARY }}>
            {doneCount}/{completionChecks.length}
          </Typography>
        </Box>
        {completionChecks.map((item) => (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.45 }}>
            <CheckCircle2
              size={14}
              color={item.done ? ACTIVATION_SECONDARY : '#64748b'}
              style={{ opacity: item.done ? 1 : 0.5 }}
            />
            <Typography sx={{ fontSize: 12.5, color: item.done ? '#e2e8f0' : '#94a3b8' }}>
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
