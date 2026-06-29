import { useMemo, useState } from 'react'
import {
  Box, Typography, Grid, Card, CardHeader, CardContent, Button, Alert, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, TextField, Collapse,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, CheckCircle2, Plus, Stethoscope, UserCog, ClipboardList, Activity, MapPin } from 'lucide-react'
import BarChart from '../../components/charts/BarChart'
import { createClinic } from '../../api/systemManager'
import { normalizeError } from '../../api/errors'
import { countByStatus, usePlatformData } from '../../hooks/usePlatformData'
import { notify } from '../../lib/toast'
import type { ClinicStaffMember, ClinicStaffRole } from '../../api/types'
import { AdvancedPageHeader, CommandMetric, StatusDot } from '../../components/advanced/AdvancedPage'

const schema = z.object({
  name: z.string().min(2, 'Clinic name is required'),
  city: z.string().optional(),
  governorate: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const roleMeta: Record<ClinicStaffRole, { label: string; icon: typeof UserCog; color: string }> = {
  CLINIC_ADMIN: { label: 'Clinic Admin', icon: UserCog, color: '#06b6d4' },
  DOCTOR: { label: 'Doctor', icon: Stethoscope, color: '#10b981' },
  SECRETARY: { label: 'Secretary', icon: ClipboardList, color: '#f59e0b' },
}

function staffName(member: ClinicStaffMember): string {
  const u = member.user
  if (u) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ')
    if (name) return name
    if (u.phoneNumber) return u.phoneNumber
  }
  return `User ${member.userId.slice(0, 8)}…`
}

export default function Clinics() {
  const theme = useTheme()
  const { clinics, staffByClinic, loading, staffLoading, error: loadError, reload, token } =
    usePlatformData({ loadStaff: true })
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', city: '', governorate: '', phone: '', email: '', description: '' },
  })

  const statusData = useMemo(() => countByStatus(clinics), [clinics])
  const activeCount = useMemo(() => clinics.filter((c) => c.status === 'ACTIVE').length, [clinics])
  const assignedStaff = useMemo(() => staffByClinic.reduce((sum, group) => sum + group.staff.length, 0), [staffByClinic])
  const coverage = clinics.length ? Math.round((staffByClinic.filter((group) => group.staff.length > 0).length / clinics.length) * 100) : 0

  const onCreate = async (data: FormValues) => {
    if (!token) return
    setError(null)
    try {
      await createClinic(token, { ...data, email: data.email || undefined })
      notify.success('Clinic created successfully.')
      setShowForm(false)
      reset()
      await reload()
    } catch (err) {
      setError(normalizeError(err, 'Could not create clinic.'))
    }
  }

  const displayError = error ?? loadError

  return (
    <Box sx={{ p: 3 }}>
      <AdvancedPageHeader
        title="Clinics"
        eyebrow="Care Network Command"
        description="Advanced operational map for healthcare facilities, staff coverage, activation readiness, and real clinic records loaded from the platform backend."
        icon={Building2}
        color="#06b6d4"
        status={`${activeCount}/${clinics.length || activeCount} active`}
        actions={
        <Button variant={showForm ? 'outlined' : 'contained'} startIcon={<Plus size={14} />} onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Add Clinic'}
        </Button>
        }
      >
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Total Clinics" value={clinics.length} helper="registered facilities" color="#06b6d4" icon={Building2} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Active Clinics" value={activeCount} helper={`${Math.round((activeCount / Math.max(1, clinics.length)) * 100)}% live`} color="#10b981" icon={CheckCircle2} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Assigned Staff" value={assignedStaff} helper="clinic assignments" color="#8b5cf6" icon={UserCog} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Staff Coverage" value={`${coverage}%`} helper="clinics staffed" color={coverage >= 80 ? '#10b981' : '#f59e0b'} icon={Activity} /></Grid>
        </Grid>
      </AdvancedPageHeader>

      {displayError && <Alert severity="error" sx={{ mb: 2 }}>{displayError}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {loading ? (
          <>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Skeleton variant="rounded" height={76} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><Skeleton variant="rounded" height={76} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><Skeleton variant="rounded" height={76} /></Grid>
          </>
        ) : (
          <>
            <Grid size={{ xs: 12, md: 6 }}>
              <BarChart title="Status Breakdown" data={statusData} height={160} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardHeader title="Regional Readiness" subheader="Clinic locations and staff assignment coverage" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }} />
                <CardContent sx={{ display: 'grid', gap: 1 }}>
                  {clinics.slice(0, 6).map((clinic) => {
                    const staff = staffByClinic.find((group) => group.clinic.id === clinic.id)?.staff.length ?? 0
                    return (
                      <Box key={clinic.id} sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: '4px' }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clinic.name}</Typography>
                          <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}><MapPin size={11} />{[clinic.city, clinic.governorate].filter(Boolean).join(', ') || 'No location'}</Typography>
                        </Box>
                        <Typography variant="caption2" sx={{ color: staff ? '#10b981' : '#f59e0b' }}>{staff} staff</Typography>
                        <StatusDot color={clinic.status === 'ACTIVE' ? '#10b981' : '#f59e0b'} />
                      </Box>
                    )
                  })}
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>

      <Collapse in={showForm}>
        <Card sx={{ mb: 2 }}>
          <CardHeader title="New Clinic" subheader="Register a new healthcare facility"
            sx={{ borderBottom: `1px solid ${theme.palette.divider}` }} />
          <CardContent>
            <Box component="form" onSubmit={handleSubmit(onCreate)}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller name="name" control={control} render={({ field }) => (
                    <TextField {...field} size="small" fullWidth label="Clinic name *" error={!!errors.name} helperText={errors.name?.message} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller name="city" control={control} render={({ field }) => (
                    <TextField {...field} size="small" fullWidth label="City" />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller name="governorate" control={control} render={({ field }) => (
                    <TextField {...field} size="small" fullWidth label="Governorate" />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller name="phone" control={control} render={({ field }) => (
                    <TextField {...field} size="small" fullWidth label="Phone" />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller name="email" control={control} render={({ field }) => (
                    <TextField {...field} size="small" fullWidth label="Email" error={!!errors.email} helperText={errors.email?.message} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller name="description" control={control} render={({ field }) => (
                    <TextField {...field} size="small" fullWidth label="Description" />
                  )} />
                </Grid>
                <Grid size={12}>
                  <Button type="submit" variant="contained" color="success" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Clinic'}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      </Collapse>

      <Card sx={{ mb: 2 }}>
        <CardHeader
          title="All Clinics"
          subheader={`${clinics.length} registered ${clinics.length === 1 ? 'clinic' : 'clinics'}`}
          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
        />
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ p: 2 }}><Skeleton variant="rounded" height={160} /></Box>
          ) : clinics.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>No clinics registered yet.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clinics.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{c.name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {[c.city, c.governorate].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        <Chip label={c.status} size="small" color={c.status === 'ACTIVE' ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell sx={{ color: 'text.disabled' }}>
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Staff by Clinic" subheader="Each clinic's assigned admin, doctors, and secretaries"
          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }} />
        <CardContent>
          {staffLoading ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}><Skeleton variant="rounded" height={120} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><Skeleton variant="rounded" height={120} /></Grid>
            </Grid>
          ) : staffByClinic.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
              No clinics to show staff for.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {staffByClinic.map(({ clinic, staff }) => (
                <Grid key={clinic.id} size={{ xs: 12, md: 6 }}>
                  <Box sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '4px', p: 2, height: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <Building2 size={16} color={theme.palette.primary.main} />
                      <Typography variant="h5">{clinic.name}</Typography>
                      <Chip label={`${staff.length} staff`} size="small" sx={{ ml: 'auto' }} />
                    </Box>
                    {staff.length === 0 ? (
                      <Typography variant="caption2" sx={{ color: 'text.disabled' }}>No staff assigned.</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {staff.map((m) => {
                          const meta = roleMeta[m.staffRole] ?? roleMeta.SECRETARY
                          const Icon = meta.icon
                          return (
                            <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 24, height: 24, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, bgcolor: `${meta.color}1f` }}>
                                <Icon size={13} />
                              </Box>
                              <Typography variant="body2" sx={{ flex: 1 }}>{staffName(m)}</Typography>
                              <Chip label={meta.label} size="small" sx={{ color: meta.color, bgcolor: `${meta.color}1f` }} />
                            </Box>
                          )
                        })}
                      </Box>
                    )}
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
