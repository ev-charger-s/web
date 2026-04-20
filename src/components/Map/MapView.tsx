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

// Custom cluster icon: green circle with total point count
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount()
  // colour scale: green → amber → red
  const color = count < 10 ? '#16a34a' : count < 50 ? '#d97706' : '#dc2626'
  const size = count < 10 ? 38 : count < 100 ? 46 : 54
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${color};border:3px solid #fff;
        box-shadow:0 2px 10px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        flex-direction:column;gap:0;
      ">
        <span style="color:#fff;font-size:10px;font-family:sans-serif;line-height:1;opacity:0.85;">⚡</span>
        <span style="color:#fff;font-size:${count > 999 ? 10 : 13}px;font-weight:700;font-family:sans-serif;line-height:1.1;">${count}</span>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

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
  flyZoom?: number
  onStationClick: (station: ChargerStation) => void
}

export default function MapView({ stations, userLat, userLng, flyZoom, onStationClick }: MapViewProps) {
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
      <MarkerClusterGroup chunkedLoading maxClusterRadius={60} iconCreateFunction={createClusterIcon}>
        {stations.map((station) => (
          <StationMarker key={station.id} station={station} onClick={onStationClick} />
        ))}
      </MarkerClusterGroup>
      {userLat !== null && userLng !== null && (
        <FlyTo lat={userLat} lng={userLng} zoom={flyZoom} />
      )}
    </MapContainer>
  )
}
