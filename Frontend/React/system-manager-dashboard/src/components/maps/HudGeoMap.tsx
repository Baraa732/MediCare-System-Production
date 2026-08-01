import { useEffect, useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './hudMap.module.css'

export type HudMarker = {
  id: string
  lat: number
  lng: number
  label: string
  status: 'ok' | 'warn' | 'bad'
  meta?: string
}

export type HudArc = {
  id: string
  from: [number, number]
  to: [number, number]
  tone?: 'ok' | 'warn' | 'bad'
}

const statusColor = {
  ok: '#10b981',
  warn: '#f59e0b',
  bad: '#ef4444',
} as const

function FitBounds({ markers }: { markers: HudMarker[] }) {
  const map = useMap()
  useEffect(() => {
    if (!markers.length) return
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]))
    map.fitBounds(bounds.pad(0.35), { animate: false, maxZoom: 7 })
  }, [map, markers])
  return null
}

export default function HudGeoMap({
  markers,
  arcs = [],
  title = 'GEO ARRAY',
  subtitle = 'ACTIVE',
  emptyHint = 'No geolocated nodes yet',
  heightClass,
}: {
  markers: HudMarker[]
  arcs?: HudArc[]
  title?: string
  subtitle?: string
  emptyHint?: string
  heightClass?: string
}) {
  const center = useMemo<[number, number]>(() => {
    if (!markers.length) return [33.5, 36.3]
    const lat = markers.reduce((s, m) => s + m.lat, 0) / markers.length
    const lng = markers.reduce((s, m) => s + m.lng, 0) / markers.length
    return [lat, lng]
  }, [markers])

  if (!markers.length) {
    return (
      <div className={`${styles.frame} ${heightClass ?? ''}`}>
        <div className={styles.empty}>{emptyHint}</div>
      </div>
    )
  }

  return (
    <div className={`${styles.frame} ${heightClass ?? ''}`} role="img" aria-label={title}>
      <MapContainer
        center={center}
        zoom={5}
        className={styles.map}
        zoomControl={false}
        attributionControl
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <FitBounds markers={markers} />
        {arcs.map((a) => (
          <Polyline
            key={a.id}
            positions={[a.from, a.to]}
            pathOptions={{
              color: statusColor[a.tone ?? 'ok'],
              weight: 1.5,
              opacity: 0.55,
              dashArray: '4 6',
            }}
          />
        ))}
        {markers.map((m) => (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={m.status === 'bad' ? 8 : 6}
            pathOptions={{
              color: '#0f1117',
              weight: 2,
              fillColor: statusColor[m.status],
              fillOpacity: 0.95,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <strong>{m.label}</strong>
              {m.meta ? <div>{m.meta}</div> : null}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className={styles.gridOverlay} aria-hidden />
      <div className={`${styles.hudCorner} ${styles.topLeft}`}>
        {title}
        <div className={styles.active}>{subtitle}</div>
      </div>
      <div className={`${styles.hudCorner} ${styles.topRight}`}>
        NODES {markers.length}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotOk}`} /> Healthy
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotWarn}`} /> Degraded
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotBad}`} /> Critical
        </span>
      </div>
    </div>
  )
}
