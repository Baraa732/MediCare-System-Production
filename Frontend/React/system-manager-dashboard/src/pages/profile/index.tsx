import { useState } from 'react'
import { Box, Typography, TextField, Button, Chip, IconButton, InputAdornment, FormControlLabel, Checkbox, Grid } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ArrowLeft, Eye, EyeOff, ShieldCheck, Clock, KeyRound, Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { notify } from '../../lib/toast'
import TimezoneSelect from '../../components/common/TimezoneSelect'
import { AdvancedPageHeader, CommandMetric, AdvancedPanel } from '../../components/advanced/AdvancedPage'

export default function ProfilePage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { timezone, updateSettings } = useSettingsStore()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { control, handleSubmit } = useForm({
    defaultValues: { name: user?.name || '', email: user?.email || '', timezone },
  })

  const onSave = () => notify.success('Profile updated')
  const onPassword = () => notify.info('Password changes not available in demo mode')

  const apiKeys = [
    { name: 'Admin Key', created: '2d ago', lastUsed: '1h ago', key: 'sk_live_****abcd' },
    { name: 'Read-only Key', created: '5d ago', lastUsed: '3h ago', key: 'sk_live_****efgh' },
  ]

  return (
    <Box sx={{ p: 3 }}>
      <Button startIcon={<ArrowLeft size={14} />} onClick={() => navigate(-1)} sx={{ color: 'text.secondary', fontSize: 13, mb: 3 }}>
        Back
      </Button>

      <AdvancedPageHeader
        title="Profile"
        eyebrow="Operator Identity"
        description="Advanced identity, security, timezone, password, notification, and API key controls for the signed-in system manager."
        icon={ShieldCheck}
        color="#8b5cf6"
        status={user?.role || 'Admin'}
        actions={<Button variant="contained" size="small" onClick={handleSubmit(onSave)}>Save Changes</Button>}
      >
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Account" value={user?.username ? `@${user.username}` : '—'} helper="signed in" color="#8b5cf6" icon={ShieldCheck} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Timezone" value={timezone.split('/').pop() ?? timezone} helper="local preference" color="#06b6d4" icon={Clock} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="API Keys" value={apiKeys.length} helper="visible keys" color="#f59e0b" icon={KeyRound} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Notifications" value="5" helper="preferences" color="#10b981" icon={Bell} /></Grid>
        </Grid>
      </AdvancedPageHeader>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
      <AdvancedPanel title="Personal Info" caption="Identity and local preferences">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Controller name="name" control={control} render={({ field }) => (
            <TextField {...field} size="small" label="Full Name" />
          )} />
          <Controller name="email" control={control} render={({ field }) => (
            <TextField {...field} size="small" label="Email Address" disabled helperText="Email cannot be changed in demo mode" />
          )} />
          <Box>
            <Typography variant="caption2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>Timezone</Typography>
            <TimezoneSelect value={timezone} onChange={(v) => updateSettings({ timezone: v })} />
          </Box>
          <Box>
            <Typography variant="caption2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>Role</Typography>
            <Chip label={user?.role || 'Admin'} size="small" sx={{ bgcolor: '#06b6d420', color: '#06b6d4' }} />
          </Box>
        </Box>
      </AdvancedPanel>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
      <AdvancedPanel title="Change Password" caption="Credential update controls">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField size="small" label="Current Password" type={showCurrent ? 'text' : 'password'}
            slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowCurrent(!showCurrent)}>{showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}</IconButton></InputAdornment> } }} />
          <TextField size="small" label="New Password" type={showNew ? 'text' : 'password'}
            slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowNew(!showNew)}>{showNew ? <EyeOff size={16} /> : <Eye size={16} />}</IconButton></InputAdornment> } }} />
          <TextField size="small" label="Confirm New Password" type={showConfirm ? 'text' : 'password'}
            slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</IconButton></InputAdornment> } }} />
          <Typography variant="caption2" sx={{ color: 'text.secondary' }}>
            Password requirements: min 8 characters, one uppercase, one number, one special character
          </Typography>
          <Button variant="outlined" size="small" onClick={onPassword} sx={{ alignSelf: 'flex-start' }}>Update Password</Button>
        </Box>
      </AdvancedPanel>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
      <AdvancedPanel title="Notification Preferences" caption="Operator signal subscriptions">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <FormControlLabel control={<Checkbox size="small" defaultChecked />} label="Alert fired" />
          <FormControlLabel control={<Checkbox size="small" defaultChecked />} label="Alert resolved" />
          <FormControlLabel control={<Checkbox size="small" defaultChecked />} label="Incident created" />
          <FormControlLabel control={<Checkbox size="small" />} label="Deployment" />
          <FormControlLabel control={<Checkbox size="small" />} label="Weekly digest" />
        </Box>
      </AdvancedPanel>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
      <AdvancedPanel title="API Keys" caption="Personal automation credentials" actions={<Button variant="outlined" size="small" sx={{ fontSize: 12 }}>+ Generate</Button>}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
        </Box>
        {apiKeys.map((k) => (
          <Box key={k.name} sx={{ display: 'flex', alignItems: 'center', py: 0.75, borderBottom: 1, borderColor: 'divider', gap: 2 }}>
            <Typography variant="body2" sx={{ flex: 1, fontFamily: theme.typography.mono.fontFamily, fontSize: 13 }}>{k.key}</Typography>
            <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{k.created}</Typography>
            <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{k.lastUsed}</Typography>
            <Button size="small" sx={{ fontSize: 11 }} onClick={() => notify.success('Copied')}>Copy</Button>
            <Button size="small" sx={{ fontSize: 11, color: '#ef4444' }}>Revoke</Button>
          </Box>
        ))}
      </AdvancedPanel>
        </Grid>

        <Grid size={12}>
      <Box sx={{ p: 2, border: `1px solid #ef444460`, borderRadius: '4px', bgcolor: '#ef444410' }}>
        <Typography variant="h4" sx={{ color: '#ef4444', mb: 1 }}>Danger Zone</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Delete your account. This action cannot be undone.
        </Typography>
        <Button variant="outlined" size="small" disabled
          sx={{ color: '#ef4444', borderColor: '#ef4444', '&.Mui-disabled': { color: '#ef4444', borderColor: '#ef4444', opacity: 0.5 } }}>
          Delete Account
        </Button>
      </Box>
        </Grid>
      </Grid>
    </Box>
  )
}
