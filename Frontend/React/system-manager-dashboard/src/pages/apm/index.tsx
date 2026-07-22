import { useState } from 'react'
import { Alert, Box, Grid, MenuItem, Select } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { ApmService } from '../../api/types'
import { useObservabilityData } from '../../hooks/useObservabilityData'
import { AdvancedPageHeader, AdvancedPanel, ObservabilityPage, PbiGrid } from '../../components/advanced/AdvancedPage'
import { MotionHeader, MotionPanel } from '../../components/motion/AnimatedSections'
import { PageMotion } from '../../components/motion/PageMotion'
import ServiceOverviewCards from './components/ServiceOverviewCards'
import ApmServiceMap from './components/ApmServiceMap'
import ErrorTracking from './components/ErrorTracking'
import LatencyChart from './components/LatencyChart'
import MetricChart from './components/MetricChart'

export default function APM() {
  const theme = useTheme()
  const [selectedService, setSelectedService] = useState<ApmService | null>(null)
  const [env, setEnv] = useState('production')
  const [range, setRange] = useState('1h')
  const { data, loading, error } = useObservabilityData(range, true)

  const handleSelectService = (svc: ApmService) => {
    setSelectedService(selectedService?.name === svc.name ? null : svc)
  }

  return (
    <ObservabilityPage fill>
      <PageMotion motionKey={`apm-${selectedService?.name ?? 'all'}`}>
      <MotionHeader>
      <AdvancedPageHeader
        title="APM — Application Performance"
        eyebrow="Observability / APM"
        description="Service health, dependency map, latency trends, and error tracking."
        color="#06b6d4"
        status="Live"
        compact
        actions={
          <Select value={env} onChange={(e) => { setEnv(e.target.value); setRange(e.target.value === 'production' ? '1h' : '15m') }} size="small" sx={{ fontSize: 13, height: 28 }}>
            <MenuItem value="production">production</MenuItem>
            <MenuItem value="staging">staging</MenuItem>
          </Select>
        }
      />
      </MotionHeader>

      {error && <Alert severity="error" sx={{ flexShrink: 0 }}>{error}</Alert>}

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <PbiGrid spacing={1.5}>
          <Grid size={{ xs: 12 }}>
            <MotionPanel index={0}>
            <AdvancedPanel title="Services" caption="click a card for detail" dense>
              <ServiceOverviewCards
                services={data?.apm.services ?? []}
                loading={loading}
                onSelectService={handleSelectService}
              />
            </AdvancedPanel>
            </MotionPanel>
          </Grid>

          {selectedService && (
            <Grid size={{ xs: 12, lg: 5 }}>
              <MotionPanel index={1}>
              <AdvancedPanel title={selectedService.name} caption={`${selectedService.instances} instances`} dense>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1 }}>
                  <Box><Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>Req/s</Box><Box sx={{ fontSize: 18, fontWeight: 700 }}>{selectedService.reqRate.toLocaleString()}</Box></Box>
                  <Box><Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>Error Rate</Box><Box sx={{ fontSize: 18, fontWeight: 700, color: selectedService.errorRate > 5 ? '#ef4444' : selectedService.errorRate > 1 ? '#f59e0b' : 'text.primary' }}>{selectedService.errorRate}%</Box></Box>
                  <Box><Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>P50 / P95 / P99</Box><Box sx={{ fontFamily: theme.typography.mono?.fontFamily, fontSize: 12 }}>{selectedService.p50} / {selectedService.p95 ?? '—'} / {selectedService.p99 ?? '—'} ms</Box></Box>
                </Box>
                <MetricChart data={selectedService.series} color="#06b6d4" height={100} />
              </AdvancedPanel>
              </MotionPanel>
            </Grid>
          )}

          <Grid size={{ xs: 12, lg: selectedService ? 7 : 12 }}>
            <MotionPanel index={selectedService ? 2 : 1}>
            <AdvancedPanel title="Service Map" caption="dependency topology" dense bodySx={{ p: 0 }}>
              <ApmServiceMap services={data?.apm.services ?? []} serviceMap={data?.apm.serviceMap} />
            </AdvancedPanel>
            </MotionPanel>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <MotionPanel index={selectedService ? 3 : 2}>
            <AdvancedPanel title="Latency" caption="P50 / P95 trends" dense>
              <LatencyChart latencySeries={data?.apm.latencySeries ?? []} />
            </AdvancedPanel>
            </MotionPanel>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <MotionPanel index={selectedService ? 4 : 3}>
            <AdvancedPanel title="Error Tracking" caption="top error signatures" dense bodySx={{ p: 0 }}>
              <ErrorTracking errors={data?.apm.errors ?? []} />
            </AdvancedPanel>
            </MotionPanel>
          </Grid>
        </PbiGrid>
      </Box>
      </PageMotion>
    </ObservabilityPage>
  )
}
