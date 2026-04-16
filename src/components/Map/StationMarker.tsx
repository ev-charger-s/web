import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { DexieStation } from '../../db/dexie'
import type { ChargerStation } from '../../types'
import { useTranslation } from 'react-i18next'

const chargerIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    background:#16a34a;border:2px solid #fff;
    transform:rotate(-45deg);
    box-shadow:0 2px 6px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -30],
})

interface Props {
  station: DexieStation
  onClick: (station: ChargerStation) => void
}

export default function StationMarker({ station, onClick }: Props) {
  const { t } = useTranslation()

  return (
    <Marker position={[station.lat, station.lng]} icon={chargerIcon}>
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
