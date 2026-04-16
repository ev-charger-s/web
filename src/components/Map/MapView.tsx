import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DexieStation } from '../../db/dexie'
import type { ChargerStation } from '../../types'
import StationMarker from './StationMarker'

// Fix default marker icons for Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface FlyToProps {
  lat: number
  lng: number
  zoom?: number
}

function FlyTo({ lat, lng, zoom = 13 }: FlyToProps) {
  const map = useMap()
  const prevRef = useRef<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (prevRef.current?.lat === lat && prevRef.current?.lng === lng) return
    prevRef.current = { lat, lng }
    map.flyTo([lat, lng], zoom, { duration: 1 })
  }, [lat, lng, zoom, map])
  return null
}

interface MapViewProps {
  stations: DexieStation[]
  userLat: number | null
  userLng: number | null
  onStationClick: (station: ChargerStation) => void
}

export default function MapView({ stations, userLat, userLng, onStationClick }: MapViewProps) {
  const initialCenter: [number, number] = [52.069167, 19.480556] // center of Poland
  const initialZoom = 6

  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      className="h-full w-full z-0"
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup chunkedLoading maxClusterRadius={60}>
        {stations.map((station) => (
          <StationMarker key={station.id} station={station} onClick={onStationClick} />
        ))}
      </MarkerClusterGroup>
      {userLat !== null && userLng !== null && (
        <FlyTo lat={userLat} lng={userLng} />
      )}
    </MapContainer>
  )
}
