import { Box, Button, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { ChevronLeft, ChevronRight, KeyRound, Shield } from 'lucide-react'
import { MotionPanel } from '../../../components/motion/AnimatedSections'
import { ACTIVATION_ACCENT, WIZARD_STEPS } from '../activationConstants'
import '../activationProvisioning.css'
import '../clinicLocationMap.css'
import ProvisionContextPanel from './ProvisionContextPanel'
import ProvisionStepPanels from './ProvisionStepPanels'
import ProvisionStepRail from './ProvisionStepRail'
import { useActivationProvisioning } from '../hooks/useActivationProvisioning'

type ActivationProvisioningWizardProps = {
  token: string | null
  onGenerated: (result: { code: string; expiresAt: string }) => void
}

export default function ActivationProvisioningWizard({
  token,
  onGenerated,
}: ActivationProvisioningWizardProps) {
  const theme = useTheme()
  const provisioning = useActivationProvisioning(token, onGenerated)
  const {
    form,
    activeStep,
    currentStep,
    submitting,
    submitError,
    mapLatitude,
    mapLongitude,
    mapAddress,
    serviceRadiusKm,
    documents,
    hasMapPin,
    documentsReady,
    completionChecks,
    setMapLatitude,
    setMapLongitude,
    setMapAddress,
    setServiceRadiusKm,
    setDocuments,
    goNext,
    goBack,
    goToStep,
    submit,
  } = provisioning

  const progress = ((activeStep + 1) / WIZARD_STEPS.length) * 100

  return (
    <MotionPanel index={0}>
      <Box
        className="provision-workspace-glow"
        sx={{
          position: 'relative',
          borderRadius: '5px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 2,
            py: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.background.elevated, 0.35),
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '4px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(ACTIVATION_ACCENT, 0.12),
              color: ACTIVATION_ACCENT,
            }}
          >
            <Shield size={18} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: ACTIVATION_ACCENT, fontWeight: 700, letterSpacing: '0.08em' }}>
              CLINIC PROVISIONING
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Secure activation code workflow
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(240px, 300px) 1fr' } }}>
          <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
            <ProvisionContextPanel
              step={currentStep}
              activeStep={activeStep}
              totalSteps={WIZARD_STEPS.length}
              completionChecks={completionChecks}
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <ProvisionStepRail activeStep={activeStep} onStepClick={(index) => void goToStep(index)} />

            <Box sx={{ px: 2, pb: 1 }}>
              <Box sx={{ display: 'flex', gap: 0.75 }}>
                {WIZARD_STEPS.map((step, index) => (
                  <Box
                    key={step.id}
                    sx={{
                      flex: 1,
                      height: 4,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.divider, 0.9),
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      className={index === activeStep ? 'provision-shimmer-bar' : undefined}
                      sx={{
                        height: '100%',
                        width: index <= activeStep ? '100%' : '0%',
                        borderRadius: 1,
                        bgcolor: index < activeStep ? ACTIVATION_ACCENT : undefined,
                        transition: 'width 0.35s ease',
                      }}
                    />
                  </Box>
                ))}
              </Box>
              <Typography variant="caption2" sx={{ color: 'text.secondary', mt: 0.75, display: 'block' }}>
                {Math.round(progress)}% complete — {currentStep.caption}
              </Typography>
            </Box>

            <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 1.5 }}>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="h4">{currentStep.label}</Typography>
                <Typography variant="caption2" sx={{ color: 'text.secondary' }}>
                  {currentStep.caption}
                </Typography>
              </Box>

              {submitError && (
                <Box sx={{ mb: 1.5, p: 1.25, borderRadius: '4px', bgcolor: alpha(theme.palette.error.main, 0.08), border: `1px solid ${alpha(theme.palette.error.main, 0.25)}` }}>
                  <Typography variant="body2" sx={{ color: 'error.main' }}>{submitError}</Typography>
                </Box>
              )}

              <Box key={currentStep.id} className="provision-step-enter">
                <ProvisionStepPanels
                  stepId={currentStep.id}
                  form={form}
                  documents={documents}
                  setDocuments={setDocuments}
                  documentsReady={documentsReady}
                  hasMapPin={hasMapPin}
                  mapLatitude={mapLatitude}
                  mapLongitude={mapLongitude}
                  mapAddress={mapAddress}
                  serviceRadiusKm={serviceRadiusKm}
                  setMapLatitude={setMapLatitude}
                  setMapLongitude={setMapLongitude}
                  setMapAddress={setMapAddress}
                  setServiceRadiusKm={setServiceRadiusKm}
                />
              </Box>
            </Box>

            <Box
              sx={{
                px: { xs: 1.5, sm: 2 },
                py: 1.5,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1,
                borderTop: `1px solid ${theme.palette.divider}`,
                bgcolor: alpha(theme.palette.background.default, 0.4),
              }}
            >
              <Button
                variant="outlined"
                startIcon={<ChevronLeft size={14} />}
                onClick={goBack}
                disabled={activeStep === 0 || submitting}
              >
                Back
              </Button>

              {currentStep.id === 'review' ? (
                <Button
                  variant="contained"
                  color="primary"
                  endIcon={<KeyRound size={14} />}
                  onClick={() => void submit()}
                  disabled={submitting || !token || !hasMapPin || !documentsReady}
                  sx={{
                    bgcolor: ACTIVATION_ACCENT,
                    '&:hover': { bgcolor: alpha(ACTIVATION_ACCENT, 0.88) },
                  }}
                >
                  {submitting ? 'Generating…' : 'Generate Activation Code'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  endIcon={<ChevronRight size={14} />}
                  onClick={() => void goNext()}
                >
                  Continue
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </MotionPanel>
  )
}
