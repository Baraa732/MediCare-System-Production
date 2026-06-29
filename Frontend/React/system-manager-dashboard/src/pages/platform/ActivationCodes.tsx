import { useState } from 'react'
import {
  Box, Typography, Grid, TextField, Button, Alert,
  FormControlLabel, Checkbox, Chip, Divider, InputAdornment,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, Copy, Search, Clock, Ban, Zap } from 'lucide-react'
import {
  generateActivationCode,
  getActivationCodeStatus,
  revokeActivationCode,
} from '../../api/systemManager'
import { normalizeError } from '../../api/errors'
import { useAuthStore } from '../../store/authStore'
import { notify } from '../../lib/toast'
import type { ActivationCodeStatus } from '../../api/types'
import { AdvancedPageHeader, CommandMetric, AdvancedPanel } from '../../components/advanced/AdvancedPage'

const generateSchema = z.object({
  idNumber: z.string().min(5, 'ID number is required'),
  phoneNumber: z.string().min(8, 'Phone number is required'),
  fullName: z.string().min(2, 'Full name is required'),
  clinicLocation: z.string().min(2, 'Clinic location is required'),
  price: z.number().min(0, 'Price must be 0 or more'),
  isCashPaymentDone: z.boolean(),
  notes: z.string().optional(),
})

type GenerateForm = z.infer<typeof generateSchema>

const statusColor: Record<ActivationCodeStatus['status'], 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  used: 'success',
  expired: 'default',
  revoked: 'error',
}

export default function ActivationCodes() {
  const theme = useTheme()
  const token = useAuthStore((s) => s.token)
  const [generated, setGenerated] = useState<{ code: string; expiresAt: string } | null>(null)
  const [lookupCode, setLookupCode] = useState('')
  const [status, setStatus] = useState<ActivationCodeStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GenerateForm>({
    resolver: zodResolver(generateSchema),
    defaultValues: { idNumber: '', phoneNumber: '', fullName: '', clinicLocation: '', price: 0, isCashPaymentDone: false, notes: '' },
  })

  const onGenerate = async (data: GenerateForm) => {
    if (!token) return
    setError(null)
    try {
      const res = await generateActivationCode(token, data)
      setGenerated({ code: res.code, expiresAt: res.expiresAt })
      notify.success(res.message || 'Activation code generated successfully.')
      reset({ idNumber: '', phoneNumber: '', fullName: '', clinicLocation: '', price: 0, isCashPaymentDone: false, notes: '' })
    } catch (err) {
      setError(normalizeError(err, 'Could not generate activation code.'))
    }
  }

  const onLookup = async () => {
    if (!token || lookupCode.length !== 8) {
      setError('Enter an 8-character activation code.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await getActivationCodeStatus(token, lookupCode)
      setStatus(res)
    } catch (err) {
      setError(normalizeError(err, 'Could not find this activation code.'))
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const onRevoke = async () => {
    if (!token || lookupCode.length !== 8) return
    setError(null)
    setLoading(true)
    try {
      const res = await revokeActivationCode(token, {
        code: lookupCode,
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
    <Box sx={{ p: 3 }}>
      <AdvancedPageHeader
        title="Activation Codes"
        eyebrow="Secure Provisioning Console"
        description="Advanced clinic onboarding workflow for generating, validating, and revoking activation codes through the real system-manager backend."
        icon={KeyRound}
        color="#f59e0b"
        status={generated ? 'New code ready' : 'Live'}
      >
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Last Generated" value={generated?.code ?? '—'} helper={generated ? 'copy ready' : 'waiting'} color="#f59e0b" icon={Zap} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Lookup Status" value={status?.status ?? '—'} helper="real-time check" color={status ? '#10b981' : '#8b93a8'} icon={Search} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Expiry Window" value="24h" helper="backend policy" color="#06b6d4" icon={Clock} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Revocation" value="Enabled" helper="secure action" color="#ef4444" icon={Ban} /></Grid>
        </Grid>
      </AdvancedPageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <AdvancedPanel title="Generate Code" caption="Create a new clinic admin activation code with payment metadata and 24h expiry">
              <Box component="form" onSubmit={handleSubmit(onGenerate)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Controller name="idNumber" control={control} render={({ field }) => (
                  <TextField {...field} size="small" label="ID number" error={!!errors.idNumber} helperText={errors.idNumber?.message} />
                )} />
                <Controller name="phoneNumber" control={control} render={({ field }) => (
                  <TextField {...field} size="small" label="Phone number (+963...)" error={!!errors.phoneNumber} helperText={errors.phoneNumber?.message} />
                )} />
                <Controller name="fullName" control={control} render={({ field }) => (
                  <TextField {...field} size="small" label="Full name" error={!!errors.fullName} helperText={errors.fullName?.message} />
                )} />
                <Controller name="clinicLocation" control={control} render={({ field }) => (
                  <TextField {...field} size="small" label="Clinic location" error={!!errors.clinicLocation} helperText={errors.clinicLocation?.message} />
                )} />
                <Controller name="price" control={control} render={({ field }) => (
                  <TextField {...field} size="small" type="number" label="Price"
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                    error={!!errors.price} helperText={errors.price?.message} />
                )} />
                <Controller name="notes" control={control} render={({ field }) => (
                  <TextField {...field} size="small" label="Notes (optional)" multiline minRows={2} />
                )} />
                <Controller name="isCashPaymentDone" control={control} render={({ field }) => (
                  <FormControlLabel control={<Checkbox size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                    label="Cash payment received" />
                )} />
                <Button type="submit" variant="contained" startIcon={<KeyRound size={14} />} disabled={isSubmitting}>
                  {isSubmitting ? 'Generating...' : 'Generate Code'}
                </Button>
              </Box>

              {generated && (
                <Box sx={{ mt: 3, p: 2, border: `1px solid ${theme.palette.primary.main}`, borderRadius: '4px', bgcolor: theme.palette.accent.subtle }}>
                  <Typography variant="caption" sx={{ color: 'primary.main', display: 'block', mb: 0.5 }}>New Code Generated</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontFamily: theme.typography.mono.fontFamily, fontSize: 24, fontWeight: 600, letterSpacing: '0.15em' }}>
                      {generated.code}
                    </Typography>
                    <Button size="small" variant="text" startIcon={<Copy size={13} />} onClick={() => copyCode(generated.code)}>Copy</Button>
                  </Box>
                  <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    Expires: {new Date(generated.expiresAt).toLocaleString()}
                  </Typography>
                </Box>
              )}
          </AdvancedPanel>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <AdvancedPanel title="Check / Revoke" caption="Look up an existing 8-character code and revoke pending codes safely">
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="XXXXXXXX"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value.toUpperCase().slice(0, 8))}
                  slotProps={{
                    input: {
                      sx: { fontFamily: theme.typography.mono.fontFamily, letterSpacing: '0.1em' },
                      startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment>,
                    },
                  }}
                />
                <Button variant="outlined" onClick={onLookup} disabled={loading}>Check</Button>
              </Box>

              {status && (
                <Box sx={{ mt: 2, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: '4px', bgcolor: 'background.elevated' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Status</Typography>
                    <Chip label={status.status} color={statusColor[status.status]} size="small" sx={{ textTransform: 'capitalize' }} />
                  </Box>
                  {status.expiresAt && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Row label="Expires" value={new Date(status.expiresAt).toLocaleString()} />
                    </>
                  )}
                  {status.usedAt && <Row label="Used" value={new Date(status.usedAt).toLocaleString()} />}
                  {status.revokedAt && <Row label="Revoked" value={new Date(status.revokedAt).toLocaleString()} />}
                  {typeof status.attemptCount === 'number' && <Row label="Attempts" value={String(status.attemptCount)} />}
                  {status.status === 'pending' && (
                    <Button color="error" variant="contained" size="small" sx={{ mt: 1.5 }} onClick={onRevoke} disabled={loading}>
                      Revoke Code
                    </Button>
                  )}
                </Box>
              )}
          </AdvancedPanel>
        </Grid>
      </Grid>
    </Box>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
      <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="caption2" sx={{ color: 'text.primary' }}>{value}</Typography>
    </Box>
  )
}
