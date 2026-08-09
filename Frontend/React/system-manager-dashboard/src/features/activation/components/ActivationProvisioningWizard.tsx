import { Box, Button, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
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
        sx={{
          position: 'relative',
          borderRadius: '14px',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          bgcolor: '#fff',
          overflow: 'hidden',
        }}
      >
        <Box className="provision-workspace-header">
          <Box className="provision-icon-tile" sx={{ width: 40, height: 40, borderRadius: '11px' }}>
            <Shield size={18} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box className="provision-badge" sx={{ mb: 0.5 }}>
              Secure workflow
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: '#0f172a' }}>
              Clinic provisioning pipeline
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: ACTIVATION_ACCENT }}>
            {Math.round(progress)}%
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(250px, 300px) 1fr' } }}>
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
                      height: 5,
                      borderRadius: '4px',
                      bgcolor: 'rgba(148,163,184,0.2)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      className={index === activeStep ? 'provision-shimmer-bar' : undefined}
                      sx={{
                        height: '100%',
                        width: index <= activeStep ? '100%' : '0%',
                        borderRadius: '4px',
                        bgcolor: index < activeStep ? ACTIVATION_ACCENT : undefined,
                        transition: 'width 0.35s ease',
                      }}
                    />
                  </Box>
                ))}
              </Box>
              <Typography sx={{ color: 'text.secondary', mt: 0.85, display: 'block', fontSize: 12 }}>
                {currentStep.caption}
              </Typography>
            </Box>

            <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 1.5 }}>
              <Box sx={{ mb: 1.75 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', color: '#0f172a' }}>
                  {currentStep.label}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.25 }}>
                  {currentStep.caption}
                </Typography>
              </Box>

              {submitError && (
                <Box
                  sx={{
                    mb: 1.5,
                    p: 1.35,
                    borderRadius: '10px',
                    bgcolor: alpha('#ef4444', 0.08),
                    border: `1px solid ${alpha('#ef4444', 0.25)}`,
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'error.main' }}>
                    {submitError}
                  </Typography>
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

            <Box className="provision-footer-bar">
              <Button
                variant="outlined"
                startIcon={<ChevronLeft size={14} />}
                onClick={goBack}
                disabled={activeStep === 0 || submitting}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
              >
                Back
              </Button>

              {currentStep.id === 'review' ? (
                <Button
                  variant="contained"
                  endIcon={<KeyRound size={14} />}
                  onClick={() => void submit()}
                  disabled={submitting || !token || !hasMapPin || !documentsReady}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 2.5,
                    bgcolor: ACTIVATION_ACCENT,
                    boxShadow: '0 10px 24px -14px rgba(14,165,233,0.9)',
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
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: ACTIVATION_ACCENT,
                    '&:hover': { bgcolor: alpha(ACTIVATION_ACCENT, 0.88) },
                  }}
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
