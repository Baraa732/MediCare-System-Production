import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { Copy, LocateFixed, MapPin, Search } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import './clinicLocationMap.css'
import { notify } from '../../lib/toast'
import { AdvancedPanel } from '../../components/advanced/AdvancedPage'
import {
  clinicPulseIcon,
  DEFAULT_SERVICE_RADIUS_KM,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  roundCoordinate,
  SELECTED_ZOOM,
  SERVICE_RADIUS_OPTIONS_KM,
  SYRIA_CENTER,
  SYRIA_DEFAULT_ZOOM,
  toMapPosition,
} from './clinicMapConstants'
import {
  formatCoordinates,
  reverseGeocode,
  searchPlaces,
  type NominatimPlace,
} from './nominatim'
import { consoleFieldSx, consoleMenuProps } from './console/formFieldSx'

export type ClinicMapSelection = {
  latitude: number
  longitude: number
}

type ClinicLocationPickerProps = {
  latitude: number | null
  longitude: number | null
  address: string
  serviceRadiusKm: number
  embedded?: boolean
  onLocationChange: (coords: ClinicMapSelection) => void
  onAddressChange: (address: string) => void
  onRadiusChange: (radiusKm: number) => void
}

const MapClickHandler = memo(function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
})

const FlyToPin = memo(function FlyToPin({
  position,
  zoom,
}: {
  position: [number, number] | null
  zoom?: number
}) {
  const map = useMap()

  useEffect(() => {
    if (!position) return
    map.flyTo(position, zoom ?? Math.max(map.getZoom(), SELECTED_ZOOM), { duration: 0.65 })
  }, [map, position, zoom])

  return null
})

/** Always-visible advanced map picker — coordinates owned by parent form. */
export default function ClinicLocationPicker({
  latitude,
  longitude,
  address,
  serviceRadiusKm,
  embedded = false,
  onLocationChange,
  onAddressChange,
  onRadiusChange,
}: ClinicLocationPickerProps) {
  const theme = useTheme()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimPlace[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [geocodeLoading, setGeocodeLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const searchAbortRef = useRef<AbortController | null>(null)
  const reverseAbortRef = useRef<AbortController | null>(null)

  const markerPosition = toMapPosition(latitude, longitude)
  const mapCenter = markerPosition ?? SYRIA_CENTER
  const mapZoom = markerPosition ? SELECTED_ZOOM : SYRIA_DEFAULT_ZOOM
  const radiusMeters = (serviceRadiusKm || DEFAULT_SERVICE_RADIUS_KM) * 1000

  const applyCoordinates = useCallback(
    (lat: number, lng: number) => {
      onLocationChange({
        latitude: roundCoordinate(lat),
        longitude: roundCoordinate(lng),
      })
    },
    [onLocationChange],
  )

  const runReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      reverseAbortRef.current?.abort()
      const controller = new AbortController()
      reverseAbortRef.current = controller
      setGeocodeLoading(true)
      try {
        const resolved = await reverseGeocode(lat, lng, controller.signal)
        if (resolved) onAddressChange(resolved)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          notify.error('Could not resolve address for this pin.')
        }
      } finally {
        if (!controller.signal.aborted) setGeocodeLoading(false)
      }
    },
    [onAddressChange],
  )

  const handleLocationPick = useCallback(
    (lat: number, lng: number) => {
      applyCoordinates(lat, lng)
      void runReverseGeocode(lat, lng)
      setShowDropdown(false)
    },
    [applyCoordinates, runReverseGeocode],
  )

  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2) {
      setSearchResults([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }

    const timer = window.setTimeout(() => {
      searchAbortRef.current?.abort()
      const controller = new AbortController()
      searchAbortRef.current = controller
      setSearchLoading(true)
      setSearchError(null)

      void searchPlaces(trimmed, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return
          setSearchResults(results)
          setShowDropdown(true)
          if (!results.length) setSearchError('No places found. Try a different search.')
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return
          setSearchResults([])
          setSearchError('Search failed. Please try again.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false)
        })
    }, 450)

    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const handleSelectPlace = (place: NominatimPlace) => {
    const lat = Number(place.lat)
    const lng = Number(place.lon)
    applyCoordinates(lat, lng)
    onAddressChange(place.display_name)
    setSearchQuery(place.display_name)
    setShowDropdown(false)
    setSearchResults([])
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      notify.error('Geolocation is not supported in this browser.')
      return
    }

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        handleLocationPick(lat, lng)
        setGeoLoading(false)
      },
      (err) => {
        setGeoLoading(false)
        if (err.code === err.PERMISSION_DENIED) {
          notify.error('Location permission denied. Enable it in browser settings.')
        } else if (err.code === err.TIMEOUT) {
          notify.error('Location request timed out. Try again.')
        } else {
          notify.error('Could not get your current location.')
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  }

  const copyCoordinates = () => {
    if (latitude == null || longitude == null) return
    void navigator.clipboard?.writeText(formatCoordinates(latitude, longitude))
    notify.success('Coordinates copied')
  }

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ position: 'relative' }}>
          <TextField
            size="small"
            fullWidth
            label="Search clinic / hospital / address / city"
            placeholder="Damascus, Al Assad Hospital, Baghdad Street..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            sx={consoleFieldSx}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start" sx={{ color: 'var(--ac-muted)' }}>
                    {searchLoading ? <CircularProgress size={14} sx={{ color: '#22d3ee' }} /> : <Search size={14} />}
                  </InputAdornment>
                ),
              },
            }}
          />

          {showDropdown && (searchResults.length > 0 || searchError) && (
            <Box className="clinic-map-search-dropdown">
              {searchResults.map((place) => (
                <button
                  key={place.place_id}
                  type="button"
                  className="clinic-map-search-item"
                  onClick={() => handleSelectPlace(place)}
                >
                  {place.display_name}
                </button>
              ))}
              {!searchResults.length && searchError && (
                <Typography className="clinic-map-search-empty">{searchError}</Typography>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={geoLoading ? <CircularProgress size={12} sx={{ color: '#22d3ee' }} /> : <LocateFixed size={14} />}
            onClick={handleUseCurrentLocation}
            disabled={geoLoading}
            sx={{
              borderColor: 'rgba(34, 211, 238, 0.35)',
              color: 'primary.main',
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              '&:hover': { borderColor: '#22d3ee', bgcolor: 'rgba(34, 211, 238, 0.08)' },
            }}
          >
            Use Current Location
          </Button>
          <Typography variant="caption" className="clinic-map-hint" sx={{ alignSelf: 'center', color: 'text.secondary' }}>
            Click the map or drag the pin for exact placement.
          </Typography>
        </Box>

        <Box className={theme.palette.mode === 'dark' ? 'clinic-map-shell clinic-map-shell--dark' : 'clinic-map-shell'}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            className="clinic-map-view"
            scrollWheelZoom
          >
            <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
            <MapClickHandler onPick={handleLocationPick} />
            <FlyToPin position={markerPosition} />
            {markerPosition && (
              <>
                <Circle
                  center={markerPosition}
                  radius={radiusMeters}
                  pathOptions={{
                    className: 'clinic-map-radius-circle',
                    color: theme.palette.primary.main,
                    fillColor: theme.palette.primary.main,
                    fillOpacity: 0.12,
                    weight: 2,
                  }}
                />
                <Marker
                  position={markerPosition}
                  icon={clinicPulseIcon}
                  draggable
                  eventHandlers={{
                    dragend: (event) => {
                      const { lat, lng } = event.target.getLatLng()
                      handleLocationPick(lat, lng)
                    },
                  }}
                >
                  <Popup>Clinic location — drag to refine</Popup>
                </Marker>
              </>
            )}
          </MapContainer>
        </Box>

        <Box className="clinic-map-coords">
          <TextField
            size="small"
            label="Latitude"
            value={latitude ?? ''}
            slotProps={{ input: { readOnly: true } }}
            placeholder="—"
            sx={consoleFieldSx}
          />
          <TextField
            size="small"
            label="Longitude"
            value={longitude ?? ''}
            slotProps={{ input: { readOnly: true } }}
            placeholder="—"
            sx={consoleFieldSx}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<Copy size={13} />}
            onClick={copyCoordinates}
            disabled={latitude == null || longitude == null}
            sx={{
              mt: { xs: 0, sm: 0.25 },
              minWidth: 120,
              borderColor: 'rgba(34, 211, 238, 0.35)',
              color: 'primary.main',
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              '&:hover': { borderColor: '#22d3ee', bgcolor: 'rgba(34, 211, 238, 0.08)' },
            }}
          >
            Copy
          </Button>
        </Box>

        <Box className="clinic-map-details">
          <TextField
            size="small"
            label="Resolved address"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder={geocodeLoading ? 'Resolving address…' : 'Auto-filled from map pin'}
            multiline
            minRows={2}
            sx={consoleFieldSx}
            slotProps={{
              input: {
                endAdornment: geocodeLoading ? (
                  <InputAdornment position="end">
                    <CircularProgress size={14} sx={{ color: '#22d3ee' }} />
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />

          <FormControl size="small" fullWidth sx={consoleFieldSx}>
            <InputLabel id="clinic-radius-label">Service radius</InputLabel>
            <Select
              labelId="clinic-radius-label"
              label="Service radius"
              value={serviceRadiusKm}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              MenuProps={consoleMenuProps}
            >
              {SERVICE_RADIUS_OPTIONS_KM.map((km) => (
                <MenuItem key={km} value={km}>
                  {km} km
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MapPin size={14} color="#22d3ee" />
          <Typography variant="caption" sx={{ color: 'var(--ac-muted)' }}>
            Coverage: {serviceRadiusKm} km radius
            {latitude != null && longitude != null
              ? ` · ${formatCoordinates(latitude, longitude)}`
              : ' · pin not set'}
          </Typography>
        </Box>
      </Box>
  )

  if (embedded) return content

  return (
    <AdvancedPanel title="Clinic Location Map" caption="Search, click, or drag the pin — location is required before code generation">
      {content}
    </AdvancedPanel>
  )
}
