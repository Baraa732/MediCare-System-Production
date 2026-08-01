import { useMemo } from 'react'
import { DashboardCard, WidgetHeader } from '../components/ui'
import { LiveIndicator } from '../components/observability'
import HudGeoMap, { type HudArc, type HudMarker } from '../components/maps/HudGeoMap'
import type { Clinic } from '../api/types'
import { clinicsWithCoords } from '../pages/control-center/overviewModel'

function clinicStatus(status: string): HudMarker['status'] {
  const s = status.toUpperCase()
  if (s === 'ACTIVE' || s === 'HEALTHY') return 'ok'
  if (s === 'PENDING' || s === 'WARNING') return 'warn'
  return 'bad'
}

export default function InfrastructureMapWidget({
  delay = 0,
  clinics = [],
}: {
  delay?: number
  clinics?: Clinic[]
}) {
  const geo = useMemo(() => clinicsWithCoords(clinics), [clinics])

  const markers: HudMarker[] = useMemo(
    () =>
      geo.map((c) => ({
        id: c.id,
        lat: c.latitude!,
        lng: c.longitude!,
        label: c.name,
        status: clinicStatus(c.status),
        meta: [c.city, c.governorate].filter(Boolean).join(' · ') || c.status,
      })),
    [geo],
  )

  const arcs: HudArc[] = useMemo(() => {
    if (markers.length < 2) return []
    const hub = markers[0]
    return markers.slice(1, 8).map((m) => ({
      id: `${hub.id}-${m.id}`,
      from: [hub.lat, hub.lng] as [number, number],
      to: [m.lat, m.lng] as [number, number],
      tone: m.status === 'bad' ? 'bad' : m.status === 'warn' ? 'warn' : 'ok',
    }))
  }, [markers])

  return (
    <DashboardCard minHeight={280} delay={delay}>
      <WidgetHeader
        title="Infrastructure Map"
        subtitle="Clinic fleet · live coordinates"
        badge={<LiveIndicator />}
      />
      <HudGeoMap
        markers={markers}
        arcs={arcs}
        title="CLINIC FLEET"
        subtitle="ACTIVE"
        emptyHint="No clinics with latitude/longitude yet"
      />
    </DashboardCard>
  )
}
