import { Suspense, lazy, useMemo } from 'react'
import { DashboardCard, WidgetHeader } from '../components/ui'
import { LiveIndicator } from '../components/observability'
import type { HudMarker } from '../components/maps/HudGeoMap'
import type { Clinic } from '../api/types'
import { clinicsWithCoords } from '../pages/control-center/overviewModel'
import styles from './infrastructureMap.module.css'

const HudGlobeMap = lazy(() => import('../components/maps/HudGlobeMap'))

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

  return (
    <DashboardCard minHeight={660} delay={delay} className={styles.card}>
      <WidgetHeader
        title="Infrastructure Map"
        subtitle="High-res Earth globe · clinic pins · drag to rotate"
        badge={<LiveIndicator />}
      />
      <Suspense
        fallback={
          <div className={styles.loading}>Loading 3D globe…</div>
        }
      >
        <HudGlobeMap
          markers={markers}
          title="CLINIC FLEET"
          subtitle="ACTIVE"
          emptyHint="No clinics with latitude/longitude yet"
        />
      </Suspense>
    </DashboardCard>
  )
}
