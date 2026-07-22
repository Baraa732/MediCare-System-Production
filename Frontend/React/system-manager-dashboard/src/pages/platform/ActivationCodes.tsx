import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { Ban, Clock, Copy, KeyRound, Search, ShieldCheck, Zap } from 'lucide-react'
import { getActivationCodeStatus, revokeActivationCode } from '../../api/systemManager'
import { normalizeError } from '../../api/errors'
import { useAuthStore } from '../../store/authStore'
import { notify } from '../../lib/toast'
import type { ActivationCodeStatus } from '../../api/types'
import { AdvancedPageHeader, CommandMetric } from '../../components/advanced/AdvancedPage'
import { MotionHeader, MotionMetricGridItem, MotionPanel } from '../../components/motion/AnimatedSections'
import { PageMotion } from '../../components/motion/PageMotion'
import ActivationProvisioningWizard from '../../features/activation/components/ActivationProvisioningWizard'
import {
  ACTIVATION_ACCENT,
  CLINIC_TYPES,
  DOCUMENT_FIELD_META,
} from '../../features/activation/activationConstants'
import '../../features/activation/activationProvisioning.css'

const statusColor: Record<ActivationCodeStatus['status'], 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  used: 'success',
  expired: 'default',
  revoked: 'error',
}

export default function ActivationCodes() {
  const theme = useTheme()
  const token = useAuthStore((s) => s.token)
  const [tab, setTab] = useState(0)
  const [generated, setGenerated] = useState<{ code: string; expiresAt: string } | null>(null)
  const [lookupCode, setLookupCode] = useState('')
  const [status, setStatus] = useState<ActivationCodeStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onLookup = async () => {
    const code = lookupCode.trim()
    if (!token || code.length < 6) {
      setError('Enter a valid activation code (6 digits).')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await getActivationCodeStatus(token, code)
      setStatus(res)
    } catch (err) {
      setError(normalizeError(err, 'Could not find this activation code.'))
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const onRevoke = async () => {
    const code = lookupCode.trim()
    if (!token || code.length < 6) return
    setError(null)
    setLoading(true)
    try {
      const res = await revokeActivationCode(token, { code, reason: 'Revoked from system manager dashboard' })
      notify.success(res.message || 'Activation code revoked.')
      await onLookup()
    } catch (err) {
      setError(normalizeError(err, 'Could not revoke activation code.'))
    } finally {
      setLoading(false)
    }
  }

  const copyCode = (code: string) => {
    void navigator.clipboard?.writeText(code)
    notify.success('Code copied to clipboard')
  }

  return (
    <PageMotion>
      <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <MotionHeader>
          <AdvancedPageHeader
            title="Activation Codes"
            eyebrow="Secure Provisioning Console"
            description="Onboard clinics through a guided provisioning flow — profile, documents, map location, and atomic code issuance."
            icon={KeyRound}
            color={ACTIVATION_ACCENT}
            status={generated ? 'Code ready' : 'Live'}
          >
            <Grid container spacing={1.5}>
              <MotionMetricGridItem index={0} size={{ xs: 12, sm: 6, md: 3 }}>
                <CommandMetric label="Last Generated" value={generated?.code ?? '—'} helper={generated ? 'copy ready' : 'waiting'} color={ACTIVATION_ACCENT} icon={Zap} />
              </MotionMetricGridItem>
              <MotionMetricGridItem index={1} size={{ xs: 12, sm: 6, md: 3 }}>
                <CommandMetric label="Lookup Status" value={status?.status ?? '—'} helper="real-time check" color={status ? '#10b981' : '#8b93a8'} icon={Search} />
              </MotionMetricGridItem>
              <MotionMetricGridItem index={2} size={{ xs: 12, sm: 6, md: 3 }}>
                <CommandMetric label="Expiry Window" value="24h" helper="backend policy" color="#06b6d4" icon={Clock} />
              </MotionMetricGridItem>
              <MotionMetricGridItem index={3} size={{ xs: 12, sm: 6, md: 3 }}>
                <CommandMetric label="Revocation" value="Enabled" helper="secure action" color="#ef4444" icon={Ban} />
              </MotionMetricGridItem>
            </Grid>
          </AdvancedPageHeader>
        </MotionHeader>

        {generated && (
          <MotionPanel index={1}>
            <Box
              className="provision-code-success"
              sx={{
                p: 2,
                borderRadius: '5px',
                border: `1px solid ${alpha(ACTIVATION_ACCENT, 0.45)}`,
                bgcolor: alpha(ACTIVATION_ACCENT, 0.08),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: ACTIVATION_ACCENT, fontWeight: 700, letterSpacing: '0.08em' }}>
                  ACTIVATION CODE ISSUED
                </Typography>
                <Typography sx={{ fontFamily: theme.typography.mono.fontFamily, fontSize: 28, fontWeight: 600, letterSpacing: '0.14em', mt: 0.5 }}>
                  {generated.code}
                </Typography>
                <Typography variant="caption2" sx={{ color: 'text.secondary' }}>
                  Expires {new Date(generated.expiresAt).toLocaleString()}
                </Typography>
              </Box>
              <Button variant="outlined" startIcon={<Copy size={14} />} onClick={() => copyCode(generated.code)}>
                Copy code
              </Button>
            </Box>
          </MotionPanel>
        )}

        <MotionPanel index={2}>
          <Box
            sx={{
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: '5px',
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            <Tabs
              value={tab}
              onChange={(_, value) => setTab(value)}
              sx={{
                px: 1,
                borderBottom: `1px solid ${theme.palette.divider}`,
                minHeight: 44,
                '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 600 },
              }}
            >
              <Tab icon={<ShieldCheck size={14} />} iconPosition="start" label="Provision clinic" />
              <Tab icon={<Search size={14} />} iconPosition="start" label="Manage codes" />
            </Tabs>

            <Box sx={{ p: { xs: 1.5, md: 2 } }}>
              {tab === 0 && (
                <ActivationProvisioningWizard
                  token={token}
                  onGenerated={(result) => {
                    setGenerated(result)
                    setTab(0)
                  }}
                />
              )}

              {tab === 1 && (
                <Box sx={{ maxWidth: 720 }}>
                  {error && (
                    <Box sx={{ mb: 1.5, p: 1.25, borderRadius: '4px', bgcolor: alpha(theme.palette.error.main, 0.08), border: `1px solid ${alpha(theme.palette.error.main, 0.25)}` }}>
                      <Typography variant="body2" sx={{ color: 'error.main' }}>{error}</Typography>
                    </Box>
                  )}

                  <Typography variant="h4" sx={{ mb: 0.5 }}>Lookup & revoke</Typography>
                  <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                    Check activation code status, view provisioning metadata, and revoke pending codes.
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="6-digit code"
                      value={lookupCode}
                      onChange={(e) => setLookupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      slotProps={{
                        input: {
                          sx: { fontFamily: theme.typography.mono.fontFamily, letterSpacing: '0.1em' },
                          startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment>,
                        },
                      }}
                    />
                    <Button variant="contained" onClick={onLookup} disabled={loading}>Check</Button>
                  </Box>

                  {status && (
                    <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: '5px', bgcolor: 'background.elevated' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Code status</Typography>
                        <Chip label={status.status} color={statusColor[status.status]} size="small" sx={{ textTransform: 'capitalize' }} />
                      </Box>
                      {status.clinicLocation && <Row label="Clinic" value={status.clinicLocation} />}
                      {status.clinicType && (
                        <Row label="Type" value={CLINIC_TYPES.find((item) => item.value === status.clinicType)?.label ?? status.clinicType} />
                      )}
                      {status.registrationLicenseNumber && <Row label="License" value={status.registrationLicenseNumber} />}
                      {status.specialties?.length ? <Row label="Specialties" value={status.specialties.join(', ')} /> : null}
                      {status.fullName && <Row label="Admin" value={status.fullName} />}
                      {status.phoneNumber && <Row label="Phone" value={status.phoneNumber} />}
                      {status.whatsappNumber && <Row label="WhatsApp" value={status.whatsappNumber} />}
                      {status.expiresAt && (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Row label="Expires" value={new Date(status.expiresAt).toLocaleString()} />
                        </>
                      )}
                      {status.latitude != null && status.longitude != null && (
                        <Row label="Coordinates" value={`${status.latitude}, ${status.longitude}`} />
                      )}
                      {status.address && <Row label="Address" value={status.address} />}
                      {status.serviceRadiusKm != null && <Row label="Service radius" value={`${status.serviceRadiusKm} km`} />}
                      {status.documents && Object.keys(status.documents).length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Documents</Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {Object.keys(status.documents).map((key) => (
                              <Chip
                                key={key}
                                size="small"
                                label={DOCUMENT_FIELD_META[key as keyof typeof DOCUMENT_FIELD_META]?.label ?? key}
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                      {status.status === 'pending' && (
                        <Button color="error" variant="contained" size="small" sx={{ mt: 1.5 }} onClick={onRevoke} disabled={loading}>
                          Revoke code
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </MotionPanel>
      </Box>
    </PageMotion>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, gap: 2 }}>
      <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="caption2" sx={{ color: 'text.primary', textAlign: 'right' }}>{value}</Typography>
    </Box>
  )
}
