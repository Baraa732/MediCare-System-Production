import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Search } from 'lucide-react'
import { Chip, Divider, TextField, Typography } from '@mui/material'
import { getActivationCodeStatus, revokeActivationCode } from '../../../api/systemManager'
import { normalizeError } from '../../../api/errors'
import { notify } from '../../../lib/toast'
import type { ActivationCodeStatus } from '../../../api/types'
import { CLINIC_TYPES, DOCUMENT_FIELD_META } from '../activationConstants'

const statusColor: Record<ActivationCodeStatus['status'], 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  used: 'success',
  expired: 'default',
  revoked: 'error',
}

type CodeLookupStudioProps = {
  token: string | null
}

export default function CodeLookupStudio({ token }: CodeLookupStudioProps) {
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
      setStatus(await getActivationCodeStatus(token, code))
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

  return (
    <motion.section
      className="ac-lookup"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Typography sx={{ fontWeight: 750, fontSize: 20, letterSpacing: '-0.02em', mb: 0.5 }}>
        Code intelligence
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mb: 2, lineHeight: 1.5 }}>
        Inspect lifecycle state, metadata, and revoke pending codes before they are claimed.
      </Typography>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(251,113,133,0.1)',
              border: '1px solid rgba(251,113,133,0.28)',
              color: '#be123c',
              fontSize: 13,
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="ac-lookup-input-row">
        <TextField
          size="small"
          fullWidth
          placeholder="6-digit code"
          value={lookupCode}
          onChange={(e) => setLookupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onLookup()
          }}
          slotProps={{
            input: {
              sx: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.18em', borderRadius: '12px' },
              startAdornment: <Search size={14} style={{ marginRight: 8, opacity: 0.55 }} />,
            },
          }}
        />
        <button type="button" className="ac-btn ac-btn-primary" disabled={loading} onClick={() => void onLookup()}>
          Check
        </button>
      </div>

      <AnimatePresence mode="wait">
        {status && (
          <motion.div
            key={status.status + lookupCode}
            className="ac-dossier"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Typography sx={{ fontWeight: 750 }}>Dossier</Typography>
              <Chip
                size="small"
                label={status.status}
                color={statusColor[status.status]}
                sx={{ textTransform: 'capitalize', fontWeight: 700, borderRadius: '8px' }}
              />
            </div>
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
            {status.serviceRadiusKm != null && <Row label="Radius" value={`${status.serviceRadiusKm} km`} />}
            {status.documents && Object.keys(status.documents).length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.keys(status.documents).map((key) => (
                  <Chip
                    key={key}
                    size="small"
                    variant="outlined"
                    label={DOCUMENT_FIELD_META[key as keyof typeof DOCUMENT_FIELD_META]?.label ?? key}
                    sx={{ borderRadius: '8px' }}
                  />
                ))}
              </div>
            )}
            {status.status === 'pending' && (
              <button
                type="button"
                className="ac-btn"
                disabled={loading}
                onClick={() => void onRevoke()}
                style={{ marginTop: 16, background: 'rgba(251,113,133,0.12)', color: '#be123c', border: '1px solid rgba(251,113,133,0.3)' }}
              >
                <Ban size={14} />
                Revoke code
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0' }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 650 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 650, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
