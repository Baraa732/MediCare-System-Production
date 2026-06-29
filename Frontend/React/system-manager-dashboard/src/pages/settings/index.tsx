import { useState } from 'react'
import { Box, Typography, Tabs, Tab, TextField, Button, Checkbox, FormControlLabel, Grid, Chip, RadioGroup, Radio, Switch, MenuItem } from '@mui/material'
import { Plus, Activity, Database, Settings as SettingsIcon, Palette, Bell, Users, KeyRound } from 'lucide-react'
import { useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useSettingsStore } from '../../store/settingsStore'
import { notify } from '../../lib/toast'
import TimezoneSelect from '../../components/common/TimezoneSelect'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { AdvancedPageHeader, CommandMetric, ObservabilityPage, PbiGrid, StatusDot } from '../../components/advanced/AdvancedPage'

const apiKeys = [
  { name: 'Admin Key', created: '2d ago', lastUsed: '1h ago', scopes: 'read, write', key: 'sk_live_****abcd' },
  { name: 'Read-only Key', created: '5d ago', lastUsed: '3h ago', scopes: 'read', key: 'sk_live_****efgh' },
  { name: 'CI Pipeline Key', created: '1d ago', lastUsed: 'just now', scopes: 'write', key: 'sk_live_****ijkl' },
]

export default function Settings() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { data } = useObservabilityData(undefined, true)
  const themeMode = useUIStore((s) => s.themeMode)
  const toggleThemeMode = useUIStore((s) => s.toggleThemeMode)
  const [tab, setTab] = useState(0)
  const {
    timezone, density, showSectionLabels, showIcons,
    updateSettings,
  } = useSettingsStore()

  const liveDataSources = data?.integrations ?? []
  const connectedCount = liveDataSources.filter((source) => source.status === 'connected').length
  const statusColors: Record<string, string> = { connected: '#10b981', error: '#ef4444', available: '#8b93a8', disconnected: '#4d566b' }

  return (
    <ObservabilityPage>
      <AdvancedPageHeader
        title="Settings"
        eyebrow="Control Plane"
        description="Workspace preferences, integrations, appearance, notifications, team, and API keys."
        icon={SettingsIcon}
        color="#06b6d4"
        status="Configurable"
        compact
      >
        <PbiGrid spacing={1}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Theme" value={themeMode} helper="active mode" color="#8b5cf6" icon={Palette} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Density" value={density} helper="table layout" color="#06b6d4" icon={SettingsIcon} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Integrations" value={`${connectedCount}/${liveDataSources.length}`} helper="connected" color="#10b981" icon={Activity} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="API Keys" value={apiKeys.length} helper="local controls" color="#f59e0b" icon={KeyRound} /></Grid>
        </PbiGrid>
      </AdvancedPageHeader>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flexShrink: 0, minHeight: 36 }}>
        <Tab label="General" />
        <Tab label="Appearance" />
        <Tab label="Data Sources" />
        <Tab label="Notifications" />
        <Tab label="Team" />
        <Tab label="API Keys" />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Typography variant="h4" sx={{ mb: 2 }}>Organization</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField size="small" label="Organization name" defaultValue="obsAdmin Demo" />
            <Box>
              <Typography variant="caption2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>Timezone</Typography>
              <TimezoneSelect value={timezone} onChange={(v) => updateSettings({ timezone: v })} />
            </Box>
            <TextField size="small" label="Date format" value={timezone} onChange={() => {}} select>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </TextField>
          </Box>
          <Typography variant="h4" sx={{ mt: 3, mb: 2 }}>Default Views</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField size="small" label="Default time range" defaultValue="Last 15 minutes" select><option>Last 15 minutes</option></TextField>
            <TextField size="small" label="Default environment" defaultValue="production" select><option>production</option></TextField>
            <TextField size="small" label="Rows per page" defaultValue="25" select><option>25</option></TextField>
          </Box>
          <Typography variant="h4" sx={{ mt: 3, mb: 2 }}>Telemetry</Typography>
          <FormControlLabel control={<Checkbox size="small" />} label="Send anonymous usage data to help improve obsAdmin" />
          <Box sx={{ mt: 3 }}>
            <Button variant="contained" onClick={() => notify.success('Settings saved')}>Save Changes</Button>
          </Box>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Typography variant="h4" sx={{ mb: 2 }}>Theme</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            <Button variant={themeMode === 'dark' ? 'contained' : 'outlined'} size="small" onClick={themeMode !== 'dark' ? toggleThemeMode : undefined}>Dark</Button>
            <Button variant={themeMode === 'light' ? 'contained' : 'outlined'} size="small" onClick={themeMode !== 'light' ? toggleThemeMode : undefined}>Light</Button>
          </Box>
          <Typography variant="h4" sx={{ mb: 2 }}>Density</Typography>
          <RadioGroup value={density} onChange={(e) => updateSettings({ density: e.target.value as 'compact' | 'default' | 'comfortable' })}>
            <FormControlLabel value="compact" control={<Radio size="small" />} label="Compact" />
            <FormControlLabel value="default" control={<Radio size="small" />} label="Default" />
            <FormControlLabel value="comfortable" control={<Radio size="small" />} label="Comfortable" />
          </RadioGroup>
          <Typography variant="h4" sx={{ mt: 3, mb: 2 }}>Sidebar</Typography>
          <Box>
            <FormControlLabel
              control={<Switch checked={showSectionLabels} onChange={(e) => updateSettings({ showSectionLabels: e.target.checked })} size="small" />}
              label="Show section labels"
            />
            <br />
            <FormControlLabel
              control={<Switch checked={showIcons} onChange={(e) => updateSettings({ showIcons: e.target.checked })} size="small" />}
              label="Show icons"
            />
          </Box>
          <Box sx={{ mt: 3 }}>
            <Button variant="contained" onClick={() => notify.success('Settings saved')}>Save Changes</Button>
          </Box>
          </Grid>
        </Grid>
      )}

      {tab === 2 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="outlined" size="small" startIcon={<Plus size={14} />}>Add Data Source</Button>
          </Box>
          <Grid container spacing={2}>
            {liveDataSources.map((ds) => {
              const Icon = ds.name === 'Prometheus' ? Activity : Database
              const status = ds.status
              return (
                <Grid key={ds.name} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: '4px', borderLeft: `3px solid ${statusColors[status]}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Icon size={20} color="#8b93a8" />
                      <Typography variant="h4">{ds.name}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <StatusDot color={statusColors[status]} />
                      <Typography variant="caption2" sx={{ color: statusColors[status], textTransform: 'capitalize' }}>{status}</Typography>
                    </Box>
                    {ds.url && <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mb: 1, fontFamily: theme.typography.mono.fontFamily }}>{ds.url}</Typography>}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => notify.info(`${ds.name} status is checked by system-manager-service.`)} sx={{ fontSize: 11 }}>Test Connection</Button>
                      <Button size="small" variant="outlined" sx={{ fontSize: 11 }}>Edit</Button>
                    </Box>
                  </Box>
                </Grid>
              )
            })}
          </Grid>
        </Box>
      )}

      {tab === 3 && (
        <Box sx={{ maxWidth: 480 }}>
          <Typography variant="h4" sx={{ mb: 2 }}><Bell size={16} /> Global Notification Settings</Typography>
          <TextField size="small" label="Default severity threshold" defaultValue="warning" select sx={{ mb: 3 }}>
            <MenuItem value="info">info</MenuItem>
            <MenuItem value="warning">warning</MenuItem>
            <MenuItem value="error">error</MenuItem>
          </TextField>
          <Typography variant="h4" sx={{ mb: 2 }}>Channels</Typography>
          <Button variant="outlined" size="small" endIcon={<Activity size={12} />}
            onClick={() => navigate('/monitoring')} sx={{ fontSize: 13 }}>
            View platform health in Monitoring →
          </Button>
        </Box>
      )}

      {tab === 4 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="outlined" size="small" startIcon={<Plus size={14} />} onClick={() => notify.success('Invitation sent')}>Invite Member</Button>
          </Box>
          <Typography variant="caption2" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', mb: 1 }}><Users size={13} /> Workspace members and operational roles</Typography>
          {[
            { name: 'Admin User', email: 'admin@obsadmin.io', role: 'Admin', avatar: 'AU' },
            { name: 'John Doe', email: 'john@obsadmin.io', role: 'Editor', avatar: 'JD' },
          ].map((m) => (
            <Box key={m.email} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#1a2540', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{m.avatar}</Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{m.name}</Typography>
                <Typography variant="caption2" sx={{ color: 'text.secondary' }}>{m.email}</Typography>
              </Box>
              <Chip label={m.role} size="small" sx={{ bgcolor: m.role === 'Admin' ? '#06b6d420' : '#8b5cf620', color: m.role === 'Admin' ? '#06b6d4' : '#8b5cf6', fontSize: 11 }} />
            </Box>
          ))}
        </Box>
      )}

      {tab === 5 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="outlined" size="small" startIcon={<Plus size={14} />}>Generate New Key</Button>
          </Box>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
            <Box component="thead">
              <Box component="tr" sx={{ '& th': { fontSize: 11, color: 'text.secondary', fontWeight: 500, textAlign: 'left', py: 1, borderColor: 'divider', textTransform: 'uppercase', letterSpacing: '0.04em' } }}>
                <Box component="th">Name</Box><Box component="th">Created</Box><Box component="th">Last Used</Box><Box component="th">Scopes</Box><Box component="th">Key</Box><Box component="th">Actions</Box>
              </Box>
            </Box>
            <Box component="tbody">
              {apiKeys.map((k) => (
                <Box key={k.name} component="tr" sx={{ '& td': { py: 1, borderColor: 'divider', fontSize: 13 } }}>
                  <Box component="td">{k.name}</Box>
                  <Box component="td" sx={{ color: 'text.secondary' }}>{k.created}</Box>
                  <Box component="td" sx={{ color: 'text.secondary' }}>{k.lastUsed}</Box>
                  <Box component="td"><Chip label={k.scopes} size="small" sx={{ bgcolor: '#1e2438' }} /></Box>
                  <Box component="td" sx={{ fontFamily: theme.typography.mono.fontFamily, fontSize: 12 }}>{k.key}</Box>
                  <Box component="td">
                    <Button size="small" sx={{ fontSize: 11 }} onClick={() => notify.success('Copied to clipboard')}>Copy</Button>
                    <Button size="small" sx={{ fontSize: 11, color: '#ef4444' }}>Revoke</Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </ObservabilityPage>
  )
}
