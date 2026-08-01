import { DashboardCard, WidgetHeader } from '../components/ui'
import { ThreatMap } from '../components/observability'
import { SECURITY } from '../constants/overviewData'
import obs from '../components/observability/obs.module.css'

export default function SecurityOverviewWidget({ delay = 0 }: { delay?: number }) {
  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Security Overview" subtitle="Threats · sessions · access" />
      <div className={obs.securityGrid}>
        <ThreatMap points={SECURITY.threatPoints} />
        <div className={obs.stack}>
          <div className={obs.miniGrid}>
            <div className={obs.metricTile}>
              <div className={obs.metricTileLabel}>Failed logins</div>
              <div className={obs.metricTileValue}>{SECURITY.failedLogins}</div>
            </div>
            <div className={obs.metricTile}>
              <div className={obs.metricTileLabel}>Blocked IPs</div>
              <div className={obs.metricTileValue}>{SECURITY.blockedIps}</div>
            </div>
            <div className={obs.metricTile}>
              <div className={obs.metricTileLabel}>Sessions</div>
              <div className={obs.metricTileValue}>{SECURITY.activeSessions}</div>
            </div>
          </div>
          <div className={obs.ipList} aria-label="Top source IPs">
            {SECURITY.topIps.map((ip) => (
              <div key={ip.ip} className={obs.ipRow}>
                <span className={obs.ipAddr}>{ip.ip}</span>
                <span className={obs.muted}>
                  {ip.region} · {ip.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}
