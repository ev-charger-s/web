import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { DexieStation } from '../../db/dexie'
import type { ChargerStation } from '../../types'
import { useTranslation } from 'react-i18next'

function makeStationIcon(pointCount: number) {
  const label = pointCount > 0 ? String(pointCount) : ''
  // Pin shape: circle on top of a triangle pointer
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:36px;height:44px;">
        <!-- pin circle -->
        <div style="
          position:absolute;top:0;left:0;
          width:36px;height:36px;border-radius:50%;
          background:#16a34a;border:2.5px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
        ">
          <span style="
            color:#fff;font-size:${label.length > 2 ? 9 : 11}px;
            font-weight:700;font-family:sans-serif;line-height:1;
            letter-spacing:-0.5px;
          ">⚡${label}</span>
        </div>
        <!-- pin pointer -->
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
    popupAnchor: [0, -46],
  })
}

interface Props {
  station: DexieStation
  onClick: (station: ChargerStation) => void
}

export default function StationMarker({ station, onClick }: Props) {
  const { t } = useTranslation()

  return (
    <Marker position={[station.lat, station.lng]} icon={makeStationIcon(station.points.length)}>
      <Popup>
        <div className="min-w-[180px]">
          <div className="font-semibold text-sm mb-1">{station.operator_name || '—'}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            {[station.street, station.street_number].filter(Boolean).join(' ')}
            {station.street && <br />}
            {station.postal_code} {station.city}
          </div>
          <div className="text-xs mb-2">
            {station.max_power_kw > 0 && (
              <span className="inline-block bg-green-100 text-green-800 rounded px-1.5 py-0.5 mr-1">
                max {station.max_power_kw} kW
              </span>
            )}
            <span className="inline-block bg-blue-100 text-blue-800 rounded px-1.5 py-0.5">
              {station.points.length} pkt
            </span>
          </div>
          {station.connector_names.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {station.connector_names.map((name) => (
                <span key={name} className="inline-block bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 text-xs">
                  ⚡ {name}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => onClick(station)}
            className="text-xs text-blue-600 hover:underline cursor-pointer"
          >
            {t('show_more')} →
          </button>
        </div>
      </Popup>
    </Marker>
  )
}
