import { Box, Typography, Grid, TextField, InputAdornment, Chip } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { BookOpen, Rocket, Wrench, Code, MessageCircle, ExternalLink, Search, ShieldCheck, Activity } from 'lucide-react'
import { AdvancedPageHeader, CommandMetric, StatusDot } from '../../components/advanced/AdvancedPage'

interface DocItem { label: string; desc: string; external?: boolean }

const sections: { title: string; icon: typeof Rocket; items: DocItem[] }[] = [
  {
    title: 'Getting Started',
    icon: Rocket,
    items: [{ label: 'Quick Start Guide', desc: 'Get up and running in 5 minutes' }, { label: 'Installation', desc: 'Deploy obsAdmin in your environment' }, { label: 'Configuration', desc: 'Configure data sources and settings' }],
  },
  {
    title: 'Features',
    icon: Wrench,
    items: [{ label: 'Logs Explorer', desc: 'Search and analyze log data' }, { label: 'Metrics & Infrastructure', desc: 'Monitor hosts and services' }, { label: 'Traces & APM', desc: 'Distributed tracing and performance' }, { label: 'Alerts & Incidents', desc: 'Alerting and incident management' }, { label: 'Synthetics', desc: 'Synthetic monitoring and status pages' }],
  },
  {
    title: 'API Reference',
    icon: Code,
    items: [{ label: 'REST API', desc: 'Full REST API documentation' }, { label: 'Query Language', desc: 'Log and metric query syntax' }],
  },
  {
    title: 'Community',
    icon: MessageCircle,
    items: [{ label: 'GitHub', desc: 'github.com/obsadmin', external: true }, { label: 'Discord', desc: 'Join our community server', external: true }, { label: 'Contributing Guide', desc: 'How to contribute to obsAdmin', external: true }],
  },
]

export default function DocsPage() {
  const theme = useTheme()

  return (
    <Box sx={{ p: 3 }}>
      <AdvancedPageHeader
        title="Documentation"
        eyebrow="Knowledge Operations"
        description="Advanced internal documentation hub for MediCare observability, administration workflows, integrations, and operational runbooks."
        icon={BookOpen}
        color="#06b6d4"
        status={`${sections.reduce((sum, section) => sum + section.items.length, 0)} articles`}
      >
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Runbooks" value={sections[1].items.length} helper="features" color="#10b981" icon={Wrench} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="API Docs" value={sections[2].items.length} helper="reference" color="#8b5cf6" icon={Code} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Ops Guides" value={sections[0].items.length} helper="onboarding" color="#f59e0b" icon={Rocket} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><CommandMetric label="Security" value="Ready" helper="admin docs" color="#ef4444" icon={ShieldCheck} /></Grid>
        </Grid>
        <TextField size="small" placeholder="Search docs, runbooks, integrations..." sx={{ mt: 2, maxWidth: 520 }} fullWidth slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={15} /></InputAdornment> } }} />
      </AdvancedPageHeader>

      <Grid container spacing={3}>
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Grid key={section.title} size={{ xs: 12, md: 6 }}>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Icon size={18} color="#06b6d4" />
                  <Typography variant="h4">{section.title}</Typography>
                </Box>
                {section.items.map((item, index) => (
                  <Box
                    key={item.label}
                    sx={{
                      p: 1.5, mb: 1,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer',
                      borderLeft: `3px solid ${index % 2 === 0 ? '#06b6d4' : '#8b5cf6'}`,
                      '&:hover': { background: theme.palette.background.hover, transform: 'translateX(2px)' },
                      transition: '120ms ease',
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <StatusDot color={index % 2 === 0 ? '#06b6d4' : '#8b5cf6'} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.label}</Typography>
                      </Box>
                      <Typography variant="caption2" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 0.35 }}>{item.desc}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={item.external ? 'External' : 'Guide'} size="small" sx={{ height: 20, fontSize: 10, bgcolor: item.external ? '#f59e0b20' : '#06b6d420', color: item.external ? '#f59e0b' : '#06b6d4' }} />
                      {item.external ? <ExternalLink size={14} color="var(--cc-muted)" /> : <Activity size={14} color="var(--cc-muted)" />}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
