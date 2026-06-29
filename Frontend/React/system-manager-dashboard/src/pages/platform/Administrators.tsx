import { useState } from 'react'
import {
  Box, Typography, Grid, TextField, Button, Alert, Chip, Divider,
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, ShieldCheck, ShieldPlus, UserCheck, Users } from 'lucide-react'
import { createSystemManager } from '../../api/systemManager'
import { normalizeError } from '../../api/errors'
import { useAuthStore } from '../../store/authStore'
import { notify } from '../../lib/toast'
import { AdvancedPageHeader, CommandMetric, AdvancedPanel, StatusDot } from '../../components/advanced/AdvancedPage'

const schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export default function Administrators() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const [error, setError] = useState<string | null>(null)

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '', firstName: '', lastName: '', email: '' },
  })

  const onSubmit = async (data: FormValues) => {
    if (!token) return
    setError(null)
    try {
      await createSystemManager(token, { ...data, email: data.email || undefined })
      notify.success('System manager account created successfully.')
      reset()
    } catch (err) {
      setError(normalizeError(err, 'Could not create system manager.'))
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <AdvancedPageHeader
        title="Administrators"
        eyebrow="Privileged Access Console"
        description="Advanced control plane for platform administrator identity, secure provisioning, and privileged access operations."
        icon={ShieldCheck}
        color="#10b981"
        status="Privileged"
      >
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Signed-in Admin" value={user?.username ? `@${user.username}` : '—'} helper="current session" color="#10b981" icon={UserCheck} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Access Level" value="Full" helper="system manager" color="#06b6d4" icon={ShieldCheck} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Provisioning" value="Enabled" helper="create admin" color="#8b5cf6" icon={Users} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Credential Policy" value="Active" helper="password guarded" color="#f59e0b" icon={KeyRound} /></Grid>
        </Grid>
      </AdvancedPageHeader>

      <Grid container spacing={2}>
        <Grid size={12}>
          <AdvancedPanel title="Your Account" caption="Signed-in platform administrator identity and session context">
              {user && (
                <Grid container spacing={3}>
                  <Field label="Full Name" value={`${user.firstName} ${user.lastName}`.trim() || '—'} />
                  <Field label="Username" value={`@${user.username}`} />
                  {user.email && <Field label="Email" value={user.email} />}
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>Role</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><StatusDot color="#10b981" /><Chip label="System Manager" color="success" size="small" /></Box>
                  </Grid>
                </Grid>
              )}
          </AdvancedPanel>
        </Grid>

        <Grid size={12}>
          <AdvancedPanel title="Create System Manager" caption="Provision another platform administrator with full access">
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ maxWidth: 640 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller name="username" control={control} render={({ field }) => (
                      <TextField {...field} size="small" fullWidth label="Username *" error={!!errors.username} helperText={errors.username?.message} autoComplete="off" />
                    )} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller name="password" control={control} render={({ field }) => (
                      <TextField {...field} size="small" fullWidth type="password" label="Password *" error={!!errors.password} helperText={errors.password?.message} autoComplete="new-password" />
                    )} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller name="firstName" control={control} render={({ field }) => (
                      <TextField {...field} size="small" fullWidth label="First Name *" error={!!errors.firstName} helperText={errors.firstName?.message} />
                    )} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller name="lastName" control={control} render={({ field }) => (
                      <TextField {...field} size="small" fullWidth label="Last Name *" error={!!errors.lastName} helperText={errors.lastName?.message} />
                    )} />
                  </Grid>
                  <Grid size={12}>
                    <Controller name="email" control={control} render={({ field }) => (
                      <TextField {...field} size="small" fullWidth label="Email (optional)" error={!!errors.email} helperText={errors.email?.message} />
                    )} />
                  </Grid>
                  <Grid size={12}>
                    <Divider sx={{ mb: 2 }} />
                    <Button type="submit" variant="contained" startIcon={<ShieldPlus size={14} />} disabled={isSubmitting}>
                      {isSubmitting ? 'Creating...' : 'Create Administrator'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
          </AdvancedPanel>
        </Grid>
      </Grid>
    </Box>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
    </Grid>
  )
}
