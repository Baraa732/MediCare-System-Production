import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { Megaphone, Send } from 'lucide-react'
import { broadcastToDoctors, broadcastToPatients } from '../../api/systemManager'
import { normalizeError } from '../../api/errors'
import { useAuthStore } from '../../store/authStore'
import { notify } from '../../lib/toast'
import { AdvancedPageHeader, CommandMetric } from '../../components/advanced/AdvancedPage'
import { MotionHeader, MotionPanel } from '../../components/motion/AnimatedSections'
import { PageMotion } from '../../components/motion/PageMotion'

const ACCENT = '#06b6d4'
const TITLE_MAX = 80
const BODY_MAX = 500

type BroadcastResult = {
  success: boolean
  title: string
  queued: number
  inboxSaved: number
  pushSuccess: number
  pushFailed: number
  batches: number
  message: string
}

type Audience = 'patients' | 'doctors'

export default function BroadcastNotification() {
  const theme = useTheme()
  const token = useAuthStore((s) => s.token)
  const [audience, setAudience] = useState<Audience>('patients')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BroadcastResult | null>(null)

  const titleLeft = TITLE_MAX - title.length
  const bodyLeft = BODY_MAX - body.length
  const canSend = title.trim().length > 0 && body.trim().length > 0 && !loading

  const preview = useMemo(
    () => ({
      title: title.trim() || 'Notification title',
      body:
        body.trim() ||
        `Message body will appear here for every ${audience === 'patients' ? 'patient' : 'doctor'}.`,
    }),
    [title, body, audience],
  )

  const onSend = async () => {
    if (!token || !canSend) return
    const confirmed = window.confirm(
      `Send this notification to ALL ${audience} on the platform?\n\nInbox + push (where devices are registered).`,
    )
    if (!confirmed) return

    setError(null)
    setLoading(true)
    try {
      const res =
        audience === 'patients'
          ? await broadcastToPatients(token, {
              title: title.trim(),
              body: body.trim(),
            })
          : await broadcastToDoctors(token, {
              title: title.trim(),
              body: body.trim(),
            })
      setResult(res)
      notify.success(res.message || 'Broadcast sent.')
      setTitle('')
      setBody('')
    } catch (err) {
      const message = normalizeError(err, 'Could not send broadcast.')
      setError(message)
      notify.error(message)
    } finally {
      setLoading(false)
    }
  }

  const audienceLabel = audience === 'patients' ? 'Patients' : 'Doctors'

  return (
    <PageMotion>
      <Box sx={{ p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <MotionHeader>
          <AdvancedPageHeader
            title="Broadcast Notifications"
            eyebrow="Platform Messaging"
            description="Compose a manual announcement and deliver it to either every patient inbox or every doctor inbox — with FCM push when devices are registered."
            icon={Megaphone}
            color={ACCENT}
            status="Manual"
          />
        </MotionHeader>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant={audience === 'patients' ? 'contained' : 'outlined'}
            onClick={() => {
              setAudience('patients')
              setResult(null)
              setError(null)
            }}
            sx={{
              bgcolor: audience === 'patients' ? ACCENT : undefined,
              color: audience === 'patients' ? '#041016' : undefined,
              fontWeight: 700,
            }}
          >
            Patients
          </Button>
          <Button
            variant={audience === 'doctors' ? 'contained' : 'outlined'}
            onClick={() => {
              setAudience('doctors')
              setResult(null)
              setError(null)
            }}
            sx={{
              bgcolor: audience === 'doctors' ? ACCENT : undefined,
              color: audience === 'doctors' ? '#041016' : undefined,
              fontWeight: 700,
            }}
          >
            Doctors
          </Button>
        </Box>

        {result ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 1.5,
            }}
          >
            <CommandMetric label={`${audienceLabel} queued`} value={String(result.queued)} color="#06b6d4" />
            <CommandMetric label="Inbox saved" value={String(result.inboxSaved)} color="#22c55e" />
            <CommandMetric label="Push delivered" value={String(result.pushSuccess)} color="#22c55e" />
            <CommandMetric label="Push failed" value={String(result.pushFailed)} color="#f59e0b" />
          </Box>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.2fr 0.8fr' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <MotionPanel>
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                background: alpha(theme.palette.background.paper, 0.7),
              }}
            >
              <Typography variant="h6" sx={{ mb: 0.5, fontSize: 16, fontWeight: 700 }}>
                Compose message
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Sent as category SYSTEM to all ACTIVE / PENDING {audience}.
              </Typography>

              {result && result.queued > 0 && result.pushSuccess === 0 ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Inbox rows were saved ({result.inboxSaved}), but no phone push was delivered
                  ({result.pushFailed} failed). {audienceLabel} only get a tray notification if the app
                  registered an FCM token and Firebase Admin is configured on notification-service.
                </Alert>
              ) : null}

              {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              ) : null}

              <TextField
                fullWidth
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                helperText={`${titleLeft} characters left`}
                sx={{ mb: 2 }}
                disabled={loading}
              />

              <TextField
                fullWidth
                multiline
                minRows={6}
                label="Body"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
                helperText={`${bodyLeft} characters left`}
                sx={{ mb: 2 }}
                disabled={loading}
              />

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
                  disabled={!canSend}
                  onClick={() => void onSend()}
                  sx={{
                    bgcolor: ACCENT,
                    color: '#041016',
                    fontWeight: 700,
                    '&:hover': { bgcolor: '#22d3ee' },
                  }}
                >
                  {loading ? 'Sending…' : `Send to all ${audience}`}
                </Button>
              </Box>
            </Box>
          </MotionPanel>

          <MotionPanel>
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: `1px solid ${alpha(ACCENT, 0.35)}`,
                background: `linear-gradient(180deg, ${alpha(ACCENT, 0.08)}, ${alpha(theme.palette.background.paper, 0.6)})`,
              }}
            >
              <Typography variant="overline" sx={{ color: ACCENT, letterSpacing: 1 }}>
                {audienceLabel} preview
              </Typography>
              <Typography variant="h6" sx={{ mt: 1, mb: 1, fontSize: 15, fontWeight: 700 }}>
                {preview.title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                {preview.body}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.disabled' }}>
                Appears in {audience} inboxes and as a push notification when FCM is enabled.
              </Typography>
            </Box>
          </MotionPanel>
        </Box>
      </Box>
    </PageMotion>
  )
}
