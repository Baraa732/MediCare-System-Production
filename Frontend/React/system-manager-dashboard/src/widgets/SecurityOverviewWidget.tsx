import { useMemo } from 'react'
import { DashboardCard, WidgetHeader, EmptyState } from '../components/ui'
import HudGeoMap, { type HudMarker } from '../components/maps/HudGeoMap'
import type { SecuritySummary } from '../api/types'
import obs from '../components/observability/obs.module.css'

/** Deterministic anonymous map placement — no country claims. */
function ipToAnonCoord(ip: string): [number, number] {
  let h = 0
  for (let i = 0; i < ip.length; i++) h = (h * 31 + ip.charCodeAt(i)) >>> 0
  const lat = ((h % 140) - 70) * 0.9
  const lng = ((((h >>> 8) % 360) - 180) * 0.85)
  return [lat, lng]
}

export default function SecurityOverviewWidget({
  delay = 0,
  security,
}: {
  delay?: number
  security?: SecuritySummary | null
}) {
  const markers: HudMarker[] = useMemo(() => {
    return (security?.topIps ?? []).slice(0, 10).map((ip) => {
      const [lat, lng] = ipToAnonCoord(ip.ip)
      return {
        id: ip.ip,
        lat,
        lng,
        label: ip.ip,
        status: ip.count > 10 ? 'bad' : ip.count > 3 ? 'warn' : 'ok',
        meta: `${ip.count} events · anonymous plot`,
      }
    })
  }, [security])

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader title="Security Overview" subtitle="Audit · sessions · threat plot" />
      {!security?.available ? (
        <EmptyState
          title="Security summary unavailable"
          hint={security?.warning ?? 'Auth aggregate offline.'}
        />
      ) : (
        <div className={obs.securityGrid}>
          <HudGeoMap
            markers={markers}
            title="THREAT ARRAY"
            subtitle="ANON PLOT"
            emptyHint="No IP activity in range"
          />
          <div className={obs.stack}>
            <div className={obs.miniGrid}>
              <div className={obs.metricTile}>
                <div className={obs.metricTileLabel}>Failed logins</div>
                <div className={obs.metricTileValue}>{security.failedLogins}</div>
              </div>
              <div className={obs.metricTile}>
                <div className={obs.metricTileLabel}>Blocked</div>
                <div className={obs.metricTileValue}>
                  {security.blockedIdentifiers.length}
                </div>
              </div>
              <div className={obs.metricTile}>
                <div className={obs.metricTileLabel}>Sessions</div>
                <div className={obs.metricTileValue}>{security.activeSessions}</div>
              </div>
            </div>
            <div className={obs.ipList} aria-label="Top source IPs">
              {security.topIps.slice(0, 6).map((ip) => (
                <div key={ip.ip} className={obs.ipRow}>
                  <span className={obs.ipAddr}>{ip.ip}</span>
                  <span className={obs.muted}>{ip.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
