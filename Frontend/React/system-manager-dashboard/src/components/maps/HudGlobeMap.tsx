import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import type { HudMarker } from './HudGeoMap'
import styles from './hudGlobe.module.css'

/** Matches patient-app map brand blue (`0xFF0B74FA`). */
const CARE_BLUE = '#0B74FA'
const CARE_AZURE = '#38BDF8'

const STATUS_COLOR = {
  ok: CARE_BLUE,
  warn: '#f59e0b',
  bad: '#ef4444',
} as const

const EARTH_DAY = `${import.meta.env.BASE_URL}globe/earth-day.jpg`
const EARTH_TOPO = `${import.meta.env.BASE_URL}globe/earth-topology.png`
const NIGHT_SKY = `${import.meta.env.BASE_URL}globe/night-sky.png`

function buildPinElement(marker: HudMarker) {
  const wrap = document.createElement('button')
  wrap.type = 'button'
  wrap.className = styles.pin
  wrap.title = marker.meta ? `${marker.label} · ${marker.meta}` : marker.label
  wrap.setAttribute('data-status', marker.status)

  const head = document.createElement('span')
  head.className = styles.pinHead

  const pulse = document.createElement('span')
  pulse.className = styles.pinPulse
  pulse.setAttribute('aria-hidden', 'true')

  const label = document.createElement('span')
  label.className = styles.pinLabel
  label.textContent = marker.label

  const meta = document.createElement('span')
  meta.className = styles.pinMeta
  meta.textContent = marker.meta ?? marker.status

  const card = document.createElement('span')
  card.className = styles.pinCard
  card.append(label, meta)

  wrap.append(pulse, head, card)
  return wrap
}

export default function HudGlobeMap({
  markers,
  title = 'CLINIC FLEET',
  subtitle = 'ACTIVE',
  emptyHint = 'No clinics with latitude/longitude yet',
}: {
  markers: HudMarker[]
  title?: string
  subtitle?: string
  emptyHint?: string
}) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [mounted, setMounted] = useState(false)
  const [globeReady, setGlobeReady] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => {
      window.cancelAnimationFrame(id)
      setMounted(false)
      setGlobeReady(false)
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const sync = () => {
      const width = Math.max(1, Math.floor(stage.clientWidth))
      const height = Math.max(1, Math.floor(stage.clientHeight))
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      )
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [mounted])

  const htmlMarkers = useMemo(
    () =>
      markers.map((m) => ({
        ...m,
        altitude: 0.02,
      })),
    [markers],
  )

  const rings = useMemo(() => {
    const source = selectedId
      ? markers.filter((m) => m.id === selectedId)
      : markers.slice(0, 24)
    return source.map((m) => ({
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      color: m.id === selectedId ? CARE_AZURE : STATUS_COLOR[m.status],
    }))
  }, [markers, selectedId])

  const configureGlobe = useCallback(() => {
    const globe = globeRef.current
    if (!globe) return

    const lat = markers.length
      ? markers.reduce((s, m) => s + m.lat, 0) / markers.length
      : 33.5
    const lng = markers.length
      ? markers.reduce((s, m) => s + m.lng, 0) / markers.length
      : 36.3

    // Closer POV so continent detail and pins read clearly
    globe.pointOfView({ lat, lng, altitude: markers.length ? 1.55 : 2.0 }, 0)

    try {
      const controls = globe.controls()
      controls.autoRotate = false
      controls.enableZoom = true
      controls.enablePan = false
      controls.enableDamping = true
      controls.dampingFactor = 0.08
    } catch {
      // controls may not be ready yet
    }

    setGlobeReady(true)
  }, [markers])

  useEffect(() => {
    if (!mounted || !size.width || !size.height) return
    if (globeReady) configureGlobe()
  }, [configureGlobe, globeReady, mounted, size.height, size.width])

  const canRender = mounted && size.width > 0 && size.height > 0

  return (
    <div className={styles.stage} ref={stageRef} role="img" aria-label={title}>
      <div className={styles.globeHost}>
        {canRender ? (
          <Globe
            ref={globeRef}
            width={size.width}
            height={size.height}
            backgroundColor="#020617"
            backgroundImageUrl={NIGHT_SKY}
            globeImageUrl={EARTH_DAY}
            bumpImageUrl={EARTH_TOPO}
            globeCurvatureResolution={2}
            showAtmosphere
            atmosphereColor="#7dd3fc"
            atmosphereAltitude={0.18}
            showGraticules={false}
            onGlobeReady={configureGlobe}
            htmlElementsData={htmlMarkers}
            htmlLat="lat"
            htmlLng="lng"
            htmlAltitude="altitude"
            htmlElement={(d) => {
              const marker = d as HudMarker
              const el = buildPinElement(marker)
              el.addEventListener('pointerdown', (event) => {
                event.stopPropagation()
                setSelectedId(marker.id)
                const globe = globeRef.current
                if (!globe) return
                globe.pointOfView(
                  { lat: marker.lat, lng: marker.lng, altitude: 1.15 },
                  700,
                )
              })
              return el
            }}
            htmlElementVisibilityModifier={(el, isVisible) => {
              el.style.opacity = isVisible ? '1' : '0'
              el.style.pointerEvents = isVisible ? 'auto' : 'none'
            }}
            ringsData={rings}
            ringLat="lat"
            ringLng="lng"
            ringColor="color"
            ringMaxRadius={2.4}
            ringPropagationSpeed={1.4}
            ringRepeatPeriod={1400}
            enablePointerInteraction
          />
        ) : (
          <div className={styles.boot}>Initializing globe…</div>
        )}
      </div>

      <div className={styles.vignette} aria-hidden />

      <div className={`${styles.hud} ${styles.topLeft}`}>
        {title}
        <div className={styles.active}>{subtitle}</div>
      </div>
      <div className={`${styles.hud} ${styles.topRight}`}>
        EARTH MAP · {markers.length} CLINICS
        <div className={styles.hint}>Drag to rotate · scroll to zoom</div>
      </div>

      {!markers.length ? (
        <div className={styles.emptyOverlay}>{emptyHint}</div>
      ) : null}

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotClinic}`} /> Clinic pin
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotWarn}`} /> Warning
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotBad}`} /> Critical
        </span>
      </div>
    </div>
  )
}
