const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const MIN_REQUEST_GAP_MS = 1100

let lastRequestAt = 0

async function throttleNominatim<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const wait = Math.max(0, MIN_REQUEST_GAP_MS - (now - lastRequestAt))
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
  lastRequestAt = Date.now()
  return fn()
}

export type NominatimPlace = {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<NominatimPlace[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  return throttleNominatim(async () => {
    const params = new URLSearchParams({
      q: trimmed,
      format: 'json',
      limit: '5',
      addressdetails: '1',
      countrycodes: 'sy',
    })

    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
    })

    if (!res.ok) {
      throw new Error('Place search failed. Try again in a moment.')
    }

    const data = (await res.json()) as NominatimPlace[]
    return Array.isArray(data) ? data : []
  })
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string> {
  return throttleNominatim(async () => {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'json',
    })

    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
    })

    if (!res.ok) {
      throw new Error('Could not resolve address for this location.')
    }

    const data = (await res.json()) as { display_name?: string }
    return data.display_name?.trim() ?? ''
  })
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}
