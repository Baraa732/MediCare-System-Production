import { useMemo, useState } from 'react'
import {
  Box, Typography, Grid, Card, CardHeader, CardContent, Alert, Skeleton, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Select, MenuItem,
  TextField, InputAdornment, TablePagination, Avatar,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ShieldCheck, UserCheck, Users, Search, Activity } from 'lucide-react'
import DonutChart from '../../components/charts/DonutChart'
import { countByRole, usePlatformData } from '../../hooks/usePlatformData'
import type { PlatformUser } from '../../api/types'
import { AdvancedPageHeader, CommandMetric } from '../../components/advanced/AdvancedPage'
import { resolveAssetUrl } from '../../lib/resolveAssetUrl'

const roleChipColor: Record<string, 'info' | 'success' | 'warning' | 'secondary' | 'default'> = {
  PATIENT: 'info',
  DOCTOR: 'success',
  SECRETARY: 'warning',
  CLINIC_ADMIN: 'success',
  SYSTEM_MANAGER: 'secondary',
}

function displayName(user: PlatformUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return name || `User ${user.id.slice(0, 8)}…`
}

function avatarInitials(user: PlatformUser): string {
  const initials = [user.firstName, user.lastName].filter(Boolean).map((n) => n![0]).join('')
  return initials.toUpperCase() || '?'
}

function statusColor(status: string): 'success' | 'warning' | 'default' {
  if (status === 'ACTIVE') return 'success'
  if (status === 'PENDING' || status === 'PENDING_ACTIVATION') return 'warning'
  return 'default'
}

function UserAvatar({ user }: { user: PlatformUser }) {
  const theme = useTheme()
  const src = resolveAssetUrl(user.avatarUrl)
  return (
    <Avatar
      src={src}
      alt={displayName(user)}
      sx={{
        width: 36,
        height: 36,
        bgcolor: theme.palette.accent.subtle,
        color: 'primary.main',
        fontSize: 12,
        fontWeight: 700,
        border: `1px solid ${theme.palette.divider}`,
        '& img': { objectFit: 'cover' },
      }}
    >
      {avatarInitials(user)}
    </Avatar>
  )
}

export default function PlatformUsers() {
  const theme = useTheme()
  const { users, loading, error } = usePlatformData()
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)

  const roleData = useMemo(() => countByRole(users), [users])
  const roles = useMemo(() => ['ALL', ...new Set(users.map((u) => u.role))], [users])
  const activeCount = useMemo(() => users.filter((u) => u.status === 'ACTIVE').length, [users])
  const staffCount = useMemo(() => users.filter((u) => ['DOCTOR', 'SECRETARY', 'CLINIC_ADMIN'].includes(u.role)).length, [users])
  const pendingCount = useMemo(() => users.filter((u) => u.status !== 'ACTIVE').length, [users])
  const withPhotoCount = useMemo(
    () => users.filter((u) => Boolean(resolveAssetUrl(u.avatarUrl))).length,
    [users],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter
      const matchSearch =
        !q ||
        displayName(u).toLowerCase().includes(q) ||
        (u.phoneNumber ?? '').toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      return matchRole && matchSearch
    })
  }, [users, roleFilter, search])

  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  return (
    <Box sx={{ p: 3 }}>
      <AdvancedPageHeader
        title="Platform Users"
        eyebrow="Identity Command Center"
        description="Advanced live account intelligence across patients, clinical staff, and platform operators. Filter, inspect, and audit every user record — including profile photos — loaded from the real user-service."
        icon={Users}
        color="#8b5cf6"
        status={`${filtered.length} visible`}
      >
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Total Accounts" value={users.length} helper="user-service" color="#8b5cf6" icon={Users} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Active Users" value={activeCount} helper={`${Math.round((activeCount / Math.max(1, users.length)) * 100)}% active`} color="#10b981" icon={UserCheck} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Clinical Staff" value={staffCount} helper="assigned roles" color="#06b6d4" icon={ShieldCheck} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="With Photos" value={withPhotoCount} helper={pendingCount ? `${pendingCount} need review` : 'profile images'} color={withPhotoCount ? '#0B74FA' : '#f59e0b'} icon={Activity} /></Grid>
        </Grid>
      </AdvancedPageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
              <DonutChart title="Role Distribution" data={roleData} height={160} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardHeader title="Identity Risk Mix" subheader="Status distribution and review pressure" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }} />
                <CardContent>
                  {[
                    ['Active', activeCount, '#10b981'],
                    ['Needs Review', pendingCount, pendingCount ? '#f59e0b' : '#10b981'],
                    ['With Photos', withPhotoCount, '#0B74FA'],
                  ].map(([label, value, color]) => (
                    <Box key={String(label)} sx={{ display: 'grid', gridTemplateColumns: '120px 1fr 48px', alignItems: 'center', gap: 1, py: 0.75 }}>
                      <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{label}</Typography>
                      <Box sx={{ height: 6, borderRadius: 999, bgcolor: 'background.default', overflow: 'hidden' }}>
                        <Box sx={{ width: `${Math.min(100, Number(value) / Math.max(1, users.length) * 100)}%`, height: '100%', bgcolor: color }} />
                      </Box>
                      <Typography variant="caption2" sx={{ color, textAlign: 'right' }}>{value}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>

      <Card>
        <CardHeader
          title="All Users"
          subheader={`${filtered.length} of ${users.length} users shown`}
          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
        />
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, p: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search by name, phone, ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> } }}
              sx={{ width: 280 }}
            />
            <Select size="small" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0) }} sx={{ minWidth: 160 }}>
              {roles.map((role) => (
                <MenuItem key={role} value={role}>{role === 'ALL' ? 'All Roles' : role.replace(/_/g, ' ')}</MenuItem>
              ))}
            </Select>
          </Box>

          {loading ? (
            <Box sx={{ p: 2 }}><Skeleton variant="rounded" height={220} /></Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>No users match this filter.</Typography>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paged.map((u) => (
                      <TableRow key={u.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <UserAvatar user={u} />
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{displayName(u)}</Typography>
                              <Typography variant="caption2" sx={{ color: 'text.disabled', fontFamily: theme.typography.mono.fontFamily }}>
                                {u.id.slice(0, 8)}…
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontFamily: theme.typography.mono.fontFamily, color: 'text.secondary' }}>
                          {u.phoneNumber || '—'}
                        </TableCell>
                        <TableCell>
                          <Chip label={u.role.replace(/_/g, ' ')} size="small" color={roleChipColor[u.role] ?? 'default'} />
                        </TableCell>
                        <TableCell>
                          <Chip label={u.status} size="small" color={statusColor(u.status)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={filtered.length}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
                rowsPerPageOptions={[10, 20, 50, 100]}
              />
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
