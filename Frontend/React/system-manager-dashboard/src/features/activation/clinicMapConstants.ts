import type { LatLngExpression } from 'leaflet'
import L from 'leaflet'

/** Syria — default map viewport for MediCare clinic provisioning. */
export const SYRIA_CENTER: LatLngExpression = [34.8021, 38.9968]
export const SYRIA_DEFAULT_ZOOM = 6
export const SELECTED_ZOOM = 11

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

export const SERVICE_RADIUS_OPTIONS_KM = [1, 3, 5, 10] as const
export const DEFAULT_SERVICE_RADIUS_KM = 5

/** Pulsing div marker — premium pin without extra image assets. */
export const clinicPulseIcon = L.divIcon({
  className: 'clinic-map-pulse-marker',
  html: '<div class="clinic-map-pulse-pin"><div class="clinic-map-pulse-ring"></div><div class="clinic-map-pulse-dot"></div></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
})

export type ClinicMapPosition = {
  latitude: number
  longitude: number
}

export function toMapPosition(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): [number, number] | null {
  if (latitude == null || longitude == null) return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return [latitude, longitude]
}

export function roundCoordinate(value: number): number {
  return Number(value.toFixed(6))
}

