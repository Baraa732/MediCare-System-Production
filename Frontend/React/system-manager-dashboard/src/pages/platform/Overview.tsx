import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Alert,
  Skeleton,
  Chip,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Users,
  CheckCircle2,
  UserCheck,
  KeyRound,
  ArrowRight,
  Activity,
  ExternalLink,
  Database,
  HardDrive,
  Radio,
} from 'lucide-react'
import StatCard from '../../components/StatCard'
import DonutChart from '../../components/charts/DonutChart'
import BarChart from '../../components/charts/BarChart'
import LogsPreview from '../../components/dashboard/LogsPreview'
import { countByRole, countByStatus, usePlatformData } from '../../hooks/usePlatformData'
import { useAuthStore } from '../../store/authStore'
import { getPlatformHealth } from '../../api/systemManager'
import { normalizeError } from '../../api/errors'
import type { PlatformHealth } from '../../api/types'

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL ?? 'http://localhost:3001'

function healthChipColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'healthy' || status === 'up' || status === 'ok') return 'success'
  if (status === 'degraded' || status === 'unknown') return 'warning'
  if (status === 'unhealthy' || status === 'down' || status === 'error') return 'error'
  return 'default'
}

export default function Overview() {
  const theme = useTheme()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const { clinics, users, loading, error } = usePlatformData()
  const [health, setHealth] = useState<PlatformHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasHydrated || !token) {
      setHealthLoading(false)
      return
    }

    let cancelled = false
    setHealthLoading(true)
    setHealthError(null)

    getPlatformHealth(token)
      .then((data) => {
        if (!cancelled) setHealth(data)
      })
      .catch((err) => {
        if (!cancelled) setHealthError(normalizeError(err, 'Could not load platform health.'))
      })
      .finally(() => {
        if (!cancelled) setHealthLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [hasHydrated, token])

  const activeClinics = useMemo(() => clinics.filter((c) => c.status === 'ACTIVE').length, [clinics])
  const activeUsers = useMemo(() => users.filter((u) => u.status === 'ACTIVE').length, [users])
  const roleData = useMemo(() => countByRole(users), [users])
  const clinicStatusData = useMemo(() => countByStatus(clinics), [clinics])
  const userStatusData = useMemo(() => countByStatus(users), [users])
  const servicesUp = health?.services.filter((s) => s.status === 'up').length ?? 0
  const servicesTotal = health?.services.length ?? 0

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h2" sx={{ mb: 0.5 }}>
        Welcome back{user ? `, ${user.firstName}` : ''}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Monitor clinics, users, and activation flows across the MediCare platform.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {healthError && <Alert severity="warning" sx={{ mb: 2 }}>{healthError}</Alert>}

      <Card sx={{ mb: 2 }}>
        <CardHeader
          title="Platform Health"
          subheader="Live status from platform services and shared infrastructure"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="outlined" startIcon={<Activity size={14} />} onClick={() => navigate('/monitoring')}>
                View Monitoring
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={<ExternalLink size={14} />}
                href={GRAFANA_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Grafana
              </Button>
            </Box>
          }
          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
        />
        <CardContent>
          {healthLoading ? (
            <Skeleton variant="rounded" height={72} />
          ) : health ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Overall</Typography>
                  <Chip size="small" label={health.status} color={healthChipColor(health.status)} />
                </Box>
                <Typography variant="caption2" sx={{ color: 'text.secondary' }}>
                  {servicesUp}/{servicesTotal} services up
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Database size={14} />
                  <Typography variant="body2">Database</Typography>
                  <Chip size="small" label={health.infrastructure.database} color={healthChipColor(health.infrastructure.database)} />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Radio size={14} />
                  <Typography variant="body2">Kafka</Typography>
                  <Chip size="small" label={health.infrastructure.kafka} color={healthChipColor(health.infrastructure.kafka)} />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <HardDrive size={14} />
                  <Typography variant="body2">Redis</Typography>
                  <Chip size="small" label={health.infrastructure.redis} color={healthChipColor(health.infrastructure.redis)} />
                </Box>
              </Grid>
            </Grid>
          ) : null}
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 1 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                <Skeleton variant="rounded" height={76} />
              </Grid>
            ))
          : (
              <>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard label="Total Clinics" value={clinics.length} icon={Building2} color="#06b6d4" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard label="Active Clinics" value={activeClinics} icon={CheckCircle2} color="#10b981" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard label="Platform Users" value={users.length} icon={Users} color="#8b5cf6" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard label="Active Users" value={activeUsers} icon={UserCheck} color="#f59e0b" />
                </Grid>
              </>
            )}
      </Grid>

      {!loading && (
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <DonutChart title="Users by Role" data={roleData} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <BarChart title="Clinics by Status" data={clinicStatusData} color={theme.palette.primary.main} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <BarChart title="Users by Status" data={userStatusData} color="#8b5cf6" />
          </Grid>

          <Grid size={{ xs: 12, lg: 8 }}>
            <LogsPreview />
          </Grid>

          <Grid size={12}>
            <Card>
              <CardHeader
                title="Quick Actions"
                subheader="Jump to common administration tasks"
                sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
              />
              <CardContent sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                <Button variant="contained" startIcon={<KeyRound size={14} />} onClick={() => navigate('/activation-codes')}>
                  Generate Activation Code
                </Button>
                <Button variant="outlined" startIcon={<Building2 size={14} />} onClick={() => navigate('/clinics')}>
                  Manage Clinics
                </Button>
                <Button variant="outlined" startIcon={<Users size={14} />} onClick={() => navigate('/users')}>
                  View All Users
                </Button>
                <Button variant="outlined" startIcon={<Activity size={14} />} onClick={() => navigate('/monitoring')}>
                  Monitoring
                </Button>
                <Button variant="text" endIcon={<ArrowRight size={14} />} onClick={() => navigate('/administrators')}>
                  Administrators
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {loading && (
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, md: 4 }}><Skeleton variant="rounded" height={300} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Skeleton variant="rounded" height={300} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Skeleton variant="rounded" height={300} /></Grid>
        </Grid>
      )}
    </Box>
  )
}
