import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DexieStation } from '../../db/dexie'
import { db } from '../../db/dexie'
import type { ChargerStation } from '../../types'
import type { ClusterItem } from '../../hooks/useCluster'

// Fix default marker icons for Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function makeClusterIcon(count: number) {
  const color = count < 10 ? '#16a34a' : count < 50 ? '#d97706' : '#dc2626'
  const size = count < 10 ? 38 : count < 100 ? 46 : 54
  return L.divIcon({
    className: '',
    html: `<div style="
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

const STATION_ICON = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:36px;height:44px;">
      <div style="
        position:absolute;top:0;left:0;
        width:36px;height:36px;border-radius:50%;
        background:#16a34a;border:2.5px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="color:#fff;font-size:11px;font-weight:700;font-family:sans-serif;">⚡</span>
      </div>
      <div style="
        position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:10px solid #16a34a;
      "></div>
    </div>`,
  iconSize: [36, 44],
  iconAnchor: [18, 44],
})

// ── FlyTo ──────────────────────────────────────────────────────────────
interface FlyToProps { lat: number; lng: number; zoom?: number }
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

// ── ViewportListener ───────────────────────────────────────────────────
interface ViewportListenerProps {
  onViewChange: (bbox: [number, number, number, number], zoom: number) => void
}
function ViewportListener({ onViewChange }: ViewportListenerProps) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds()
      onViewChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], Math.round(map.getZoom()))
    },
    zoomend: () => {
      const b = map.getBounds()
      onViewChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], Math.round(map.getZoom()))
    },
  })
  const firedRef = useRef(false)
  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    const b = map.getBounds()
    onViewChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], Math.round(map.getZoom()))
  })
  return null
}

// ── SingleStationMarker ────────────────────────────────────────────────
interface SingleStationMarkerProps {
  id: number
  lat: number
  lng: number
  onStationClick: (station: ChargerStation) => void
}
function SingleStationMarker({ id, lat, lng, onStationClick }: SingleStationMarkerProps) {
  const stationRef = useRef<DexieStation | null>(null)
  return (
    <Marker
      position={[lat, lng]}
      icon={STATION_ICON}
      eventHandlers={{
        click: async () => {
          if (!stationRef.current) {
            let s = await db.stations.get(id)
            if (!s) s = await db.bnetza_stations.get(id)
            if (!s) s = await db.irve_stations.get(id)
            stationRef.current = s ?? null
          }
          if (stationRef.current) onStationClick(stationRef.current)
        },
      }}
    />
  )
}

// ── MapView ────────────────────────────────────────────────────────────
interface MapViewProps {
  clusters: ClusterItem[]
  clusterReady: boolean
  userLat: number | null
  userLng: number | null
  flyZoom?: number
  onViewChange: (bbox: [number, number, number, number], zoom: number) => void
  onClusterClick: (clusterId: number, lat: number, lng: number) => void
  onStationClick: (station: ChargerStation) => void
}

export default function MapView({
  clusters,
  clusterReady,
  userLat,
  userLng,
  flyZoom,
  onViewChange,
  onClusterClick,
  onStationClick,
}: MapViewProps) {
  return (
    <MapContainer
      center={[52.069167, 19.480556]}
      zoom={6}
      className="h-full w-full z-0"
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ViewportListener onViewChange={onViewChange} />

      {clusterReady && clusters.map((item) => {
        const [lng, lat] = item.geometry.coordinates
        const isCluster = 'cluster' in item.properties && item.properties.cluster === true

        if (isCluster) {
          const count = (item.properties as { point_count: number }).point_count
          const clusterId = (item as unknown as { id: number }).id
          return (
            <Marker
              key={`c-${clusterId}`}
              position={[lat, lng]}
              icon={makeClusterIcon(count)}
              eventHandlers={{ click: () => onClusterClick(clusterId, lat, lng) }}
            />
          )
        }

        const { id } = item.properties as { id: number }
        return (
          <SingleStationMarker
            key={`s-${id}`}
            id={id}
            lat={lat}
            lng={lng}
            onStationClick={onStationClick}
          />
        )
      })}

      {userLat !== null && userLng !== null && (
        <FlyTo lat={userLat} lng={userLng} zoom={flyZoom} />
      )}
    </MapContainer>
  )
}
