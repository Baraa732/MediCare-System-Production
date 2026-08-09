import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import {
  Ban,
  Clock,
  Copy,
  Fingerprint,
  KeyRound,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { getActivationCodeStatus, revokeActivationCode } from '../../api/systemManager'
import { normalizeError } from '../../api/errors'
import { useAuthStore } from '../../store/authStore'
import { notify } from '../../lib/toast'
import type { ActivationCodeStatus } from '../../api/types'
import { MotionHeader, MotionPanel } from '../../components/motion/AnimatedSections'
import { PageMotion } from '../../components/motion/PageMotion'
import ActivationProvisioningWizard from '../../features/activation/components/ActivationProvisioningWizard'
import {
  ACTIVATION_ACCENT,
  ACTIVATION_SECONDARY,
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
      setError('Enter a valid 6-digit activation code.')
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
      const res = await revokeActivationCode(token, {
        code,
        reason: 'Revoked from system manager dashboard',
      })
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
      <Box className="provision-page-canvas" sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
        <MotionHeader>
          <Box className="provision-hero" sx={{ p: { xs: 2.25, md: 3 }, position: 'relative' }}>
            <Box className="provision-hero-orb" />
            <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
                  <Box className="provision-icon-tile">
                    <Fingerprint size={22} />
                  </Box>
                  <Box>
                    <Box className="provision-badge" sx={{ mb: 1, bgcolor: 'rgba(14,165,233,0.18)', color: '#7dd3fc', borderColor: 'rgba(125,211,252,0.35)' }}>
                      <Sparkles size={12} />
                      Issuance vault
                    </Box>
                    <Typography sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                      Activation Codes
                    </Typography>
                    <Typography sx={{ mt: 0.75, maxWidth: 560, color: 'rgba(226,232,240,0.78)', fontSize: 14, lineHeight: 1.55 }}>
                      Provision clinics with cryptographic single-use codes — identity, documents, location, and issuance in one controlled workflow.
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  label={generated ? 'Code ready' : 'Console live'}
                  size="small"
                  sx={{
                    height: 26,
                    fontWeight: 700,
                    bgcolor: generated ? alpha(ACTIVATION_SECONDARY, 0.2) : alpha('#fff', 0.08),
                    color: generated ? '#5eead4' : '#e2e8f0',
                    border: `1px solid ${generated ? alpha(ACTIVATION_SECONDARY, 0.4) : 'rgba(255,255,255,0.12)'}`,
                  }}
                />
              </Box>

              <Box className="provision-metric-strip">
                <Metric
                  icon={Zap}
                  label="Last issued"
                  value={generated?.code ?? '—'}
                  helper={generated ? 'Ready to share' : 'Awaiting generation'}
                  mono={Boolean(generated)}
                />
                <Metric
                  icon={Search}
                  label="Lookup"
                  value={status?.status ?? 'Idle'}
                  helper="Real-time status"
                />
                <Metric icon={Clock} label="Expiry policy" value="24h" helper="Single-use window" />
                <Metric icon={Ban} label="Revocation" value="Armed" helper="Pending codes only" />
              </Box>
            </Box>
          </Box>
        </MotionHeader>

        {generated && (
          <MotionPanel index={1}>
            <Box className="provision-code-success" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: ACTIVATION_ACCENT, fontWeight: 800, letterSpacing: '0.12em' }}
                  >
                    ACTIVATION CODE ISSUED
                  </Typography>
                  <Typography className="provision-code-digits" sx={{ fontFamily: theme.typography.mono?.fontFamily, mt: 0.75 }}>
                    {generated.code}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    Expires {new Date(generated.expiresAt).toLocaleString()} · Share only with the clinic administrator
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<Copy size={14} />}
                    onClick={() => copyCode(generated.code)}
                    sx={{
                      bgcolor: ACTIVATION_ACCENT,
                      px: 2.25,
                      borderRadius: '10px',
                      textTransform: 'none',
                      fontWeight: 700,
                      '&:hover': { bgcolor: alpha(ACTIVATION_ACCENT, 0.88) },
                    }}
                  >
                    Copy code
                  </Button>
                </Box>
              </Box>
            </Box>
          </MotionPanel>
        )}

        <MotionPanel index={2}>
          <Box className="provision-workspace">
            <Box sx={{ px: { xs: 1.5, md: 2 }, pt: 2, pb: 1.5 }}>
              <Box className="provision-tab-bar">
                <button
                  type="button"
                  className="provision-tab"
                  data-active={tab === 0}
                  onClick={() => setTab(0)}
                >
                  <ShieldCheck size={15} />
                  Provision clinic
                </button>
                <button
                  type="button"
                  className="provision-tab"
                  data-active={tab === 1}
                  onClick={() => setTab(1)}
                >
                  <KeyRound size={15} />
                  Manage codes
                </button>
              </Box>
            </Box>

            <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
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
                <Box className="provision-lookup-shell" sx={{ maxWidth: 760 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', mb: 0.5 }}>
                    Lookup & revoke
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 2.25, lineHeight: 1.5 }}>
                    Inspect issuance metadata, confirm lifecycle state, and revoke pending codes before they are claimed.
                  </Typography>

                  {error && (
                    <Box
                      sx={{
                        mb: 1.75,
                        p: 1.35,
                        borderRadius: '10px',
                        bgcolor: alpha(theme.palette.error.main, 0.08),
                        border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
                      }}
                    >
                      <Typography variant="body2" sx={{ color: 'error.main' }}>
                        {error}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mb: 2.25 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Enter 6-digit code"
                      value={lookupCode}
                      onChange={(e) => setLookupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      slotProps={{
                        input: {
                          sx: {
                            fontFamily: theme.typography.mono?.fontFamily,
                            letterSpacing: '0.18em',
                            borderRadius: '10px',
                          },
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search size={14} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={onLookup}
                      disabled={loading}
                      sx={{
                        borderRadius: '10px',
                        px: 2.5,
                        textTransform: 'none',
                        fontWeight: 700,
                        bgcolor: ACTIVATION_ACCENT,
                        '&:hover': { bgcolor: alpha(ACTIVATION_ACCENT, 0.88) },
                      }}
                    >
                      Check
                    </Button>
                  </Box>

                  {status && (
                    <Box className="provision-status-card">
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
                        <Typography sx={{ fontWeight: 700 }}>Code dossier</Typography>
                        <Chip
                          label={status.status}
                          color={statusColor[status.status]}
                          size="small"
                          sx={{ textTransform: 'capitalize', fontWeight: 700, borderRadius: '6px' }}
                        />
                      </Box>
                      {status.clinicLocation && <Row label="Clinic" value={status.clinicLocation} />}
                      {status.clinicType && (
                        <Row
                          label="Type"
                          value={CLINIC_TYPES.find((item) => item.value === status.clinicType)?.label ?? status.clinicType}
                        />
                      )}
                      {status.registrationLicenseNumber && <Row label="License" value={status.registrationLicenseNumber} />}
                      {status.specialties?.length ? <Row label="Specialties" value={status.specialties.join(', ')} /> : null}
                      {status.fullName && <Row label="Admin" value={status.fullName} />}
                      {status.phoneNumber && <Row label="Phone" value={status.phoneNumber} />}
                      {status.whatsappNumber && <Row label="WhatsApp" value={status.whatsappNumber} />}
                      {status.expiresAt && (
                        <>
                          <Divider sx={{ my: 1.25 }} />
                          <Row label="Expires" value={new Date(status.expiresAt).toLocaleString()} />
                        </>
                      )}
                      {status.latitude != null && status.longitude != null && (
                        <Row label="Coordinates" value={`${status.latitude}, ${status.longitude}`} />
                      )}
                      {status.address && <Row label="Address" value={status.address} />}
                      {status.serviceRadiusKm != null && (
                        <Row label="Service radius" value={`${status.serviceRadiusKm} km`} />
                      )}
                      {status.documents && Object.keys(status.documents).length > 0 && (
                        <Box sx={{ mt: 1.25 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75, fontWeight: 600 }}>
                            Documents on file
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                            {Object.keys(status.documents).map((key) => (
                              <Chip
                                key={key}
                                size="small"
                                label={DOCUMENT_FIELD_META[key as keyof typeof DOCUMENT_FIELD_META]?.label ?? key}
                                variant="outlined"
                                sx={{ borderRadius: '6px' }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                      {status.status === 'pending' && (
                        <Button
                          color="error"
                          variant="contained"
                          size="small"
                          sx={{ mt: 2, borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                          onClick={onRevoke}
                          disabled={loading}
                        >
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

function Metric({
  icon: Icon,
  label,
  value,
  helper,
  mono,
}: {
  icon: typeof Zap
  label: string
  value: string
  helper: string
  mono?: boolean
}) {
  return (
    <Box className="provision-metric-card">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
        <Icon size={13} color="#7dd3fc" />
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8' }}>
          {label}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: mono ? 15 : 18,
          fontWeight: 700,
          color: '#f8fafc',
          letterSpacing: mono ? '0.12em' : '-0.02em',
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
          textTransform: mono ? 'none' : undefined,
        }}
      >
        {value}
      </Typography>
      <Typography sx={{ mt: 0.35, fontSize: 11, color: '#94a3b8' }}>{helper}</Typography>
    </Box>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.55, gap: 2 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.primary', textAlign: 'right', fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  )
}
