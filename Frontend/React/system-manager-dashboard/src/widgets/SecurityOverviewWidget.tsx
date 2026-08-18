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

function threatTone(score: number) {
  if (score >= 60) return 'Critical'
  if (score >= 25) return 'Elevated'
  return 'Quiet'
}

export default function SecurityOverviewWidget({
  delay = 0,
  security,
  onSelectIp,
}: {
  delay?: number
  security?: SecuritySummary | null
  onSelectIp?: (ip: string) => void
}) {
  const markers: HudMarker[] = useMemo(() => {
    return (security?.topIps ?? []).slice(0, 12).map((ip) => {
      const [lat, lng] = ipToAnonCoord(ip.ip)
      const hostile = ip.actions.some((a) =>
        /fail|suspicious|rate_limit|blocked/i.test(a),
      )
      return {
        id: ip.ip,
        lat,
        lng,
        label: ip.ip,
        status: hostile ? (ip.count > 8 ? 'bad' : 'warn') : 'ok',
        meta: `${ip.count} events · ${ip.actions.slice(0, 3).join(', ') || 'activity'}`,
      }
    })
  }, [security])

  const score = security?.threatScore ?? 0

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="Security Overview"
        subtitle={`${threatTone(score)} · ${security?.range ?? 'live'} window`}
      />
      {!security?.available ? (
        <EmptyState
          title="Security summary unavailable"
          hint={security?.warning ?? 'Auth aggregate offline.'}
        />
      ) : (
        <div className={obs.securityGrid}>
          <HudGeoMap
            markers={markers}
            title="SOURCE ARRAY"
            subtitle="ANON PLOT"
            emptyHint="No source IPs in this window yet"
            onMarkerClick={onSelectIp ? (m) => onSelectIp(m.id) : undefined}
          />
          <div className={obs.stack}>
            <div className={obs.miniGrid}>
              <div className={obs.metricTile}>
                <div className={obs.metricTileLabel}>Threat</div>
                <div className={obs.metricTileValue}>{score}</div>
              </div>
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
              <div className={obs.metricTile}>
                <div className={obs.metricTileLabel}>Logins</div>
                <div className={obs.metricTileValue}>{security.loginEvents ?? 0}</div>
              </div>
              <div className={obs.metricTile}>
                <div className={obs.metricTileLabel}>Suspicious</div>
                <div className={obs.metricTileValue}>{security.suspicious}</div>
              </div>
            </div>
            <div className={obs.ipList} aria-label="Top source IPs">
              {(security.topIps.length ? security.topIps : []).slice(0, 6).map((ip) => (
                <div
                  key={ip.ip}
                  className={obs.ipRow}
                  role={onSelectIp ? 'button' : undefined}
                  tabIndex={onSelectIp ? 0 : undefined}
                  onClick={onSelectIp ? () => onSelectIp(ip.ip) : undefined}
                  onKeyDown={
                    onSelectIp
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onSelectIp(ip.ip)
                          }
                        }
                      : undefined
                  }
                  style={onSelectIp ? { cursor: 'pointer' } : undefined}
                >
                  <span className={obs.ipAddr}>{ip.ip}</span>
                  <span className={obs.muted}>{ip.count}</span>
                </div>
              ))}
              {!security.topIps.length && (
                <div className={obs.muted}>
                  {security.uniqueActors ?? 0} actors · {security.rateLimitExceeded} rate-limit events
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
