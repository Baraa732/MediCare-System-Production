import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import { GaugeCard, LiveIndicator } from '../components/observability'
import obs from '../components/observability/obs.module.css'

export default function LiveSystemLoadWidget({
  delay = 0,
  load,
}: {
  delay?: number
  load?: {
    overall: number
    cpu: number | null
    memory: number | null
    requests: number
    latency: number
    available: boolean
    services?: Array<{
      name: string
      cpu: number | null
      memoryBytes: number | null
      reqRate: number
    }>
  }
}) {
  const busy = [...(load?.services ?? [])]
    .sort((a, b) => b.reqRate - a.reqRate)
    .slice(0, 5)

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="Live System Load"
        subtitle="CPU · RAM · request pressure"
        badge={<LiveIndicator />}
      />
      {!load?.available ? (
        <EmptyState
          title="Resource metrics unavailable"
          hint="Waiting for APM / Prometheus process series."
        />
      ) : (
        <div className={obs.stack}>
          <GaugeCard
            overall={load.overall}
            metrics={[
              { key: 'cpu', label: 'CPU', value: load.cpu, cls: obs.loadCpu },
              { key: 'memory', label: 'RAM', value: load.memory, cls: obs.loadRam },
              { key: 'requests', label: 'Req', value: load.requests, cls: obs.loadNet },
              { key: 'latency', label: 'p95', value: load.latency, cls: obs.loadDisk },
            ]}
          />
          {busy.length > 0 && (
            <div className={obs.ipList} aria-label="Busiest services">
              {busy.map((s) => (
                <div key={s.name} className={obs.ipRow}>
                  <span className={obs.ipAddr}>{s.name}</span>
                  <span className={obs.muted}>
                    {s.reqRate.toFixed(2)} req/s
                    {s.cpu != null ? ` · CPU ${Math.round(s.cpu)}%` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  )
}
