import { useTranslation } from 'react-i18next'
import type { ChargerStation } from '../../types'
import type { EIPADictionary } from '../../types'

interface Props {
  station: ChargerStation | null
  dictionary: EIPADictionary | null
  onClose: () => void
}

export default function StationPanel({ station, dictionary, onClose }: Props) {
  const { t } = useTranslation()

  if (!station) return null

  const getConnectorName = (id: number) => {
    const c = dictionary?.connector_interface.find((x) => x.id === id)
    return c?.description ?? c?.name ?? `#${id}`
  }

  const getChargingMode = (id: number) => {
    const m = dictionary?.charging_mode.find((x) => x.id === id)
    return m?.name ?? `Mode ${id}`
  }

  const getAuthMethod = (id: number) => {
    const m = dictionary?.station_authentication_method.find((x) => x.id === id)
    return m?.description ?? `#${id}`
  }

  const getPaymentMethod = (id: number) => {
    const m = dictionary?.station_payment_method.find((x) => x.id === id)
    return m?.description ?? `#${id}`
  }

  return (
    <div className="absolute inset-0 z-20 bg-white dark:bg-gray-900 overflow-y-auto flex flex-col md:relative md:inset-auto md:w-96 md:shadow-xl md:rounded-l-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <h2 className="font-semibold text-base text-gray-900 dark:text-white">{t('station_details')}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none p-1"
          aria-label={t('close')}
        >
          ✕
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Operator */}
        <section>
          <Label>{t('operator')}</Label>
          <div className="text-gray-900 dark:text-white font-medium">{station.operator_name || '—'}</div>
        </section>

        {/* Address */}
        <section>
          <Label>{t('address')}</Label>
          <div className="text-gray-800 dark:text-gray-200">
            {[station.street, station.street_number].filter(Boolean).join(' ')}
            {station.street && <br />}
            {station.postal_code} {station.city}
          </div>
        </section>

        {/* Auth methods */}
        {station.authentication_methods.length > 0 && (
          <section>
            <Label>{t('auth_methods')}</Label>
            <div className="flex flex-wrap gap-1">
              {station.authentication_methods.map((id) => (
                <Badge key={id}>{getAuthMethod(id)}</Badge>
              ))}
            </div>
          </section>
        )}

        {/* Payment methods */}
        {station.payment_methods.length > 0 && (
          <section>
            <Label>{t('payment_methods')}</Label>
            <div className="flex flex-wrap gap-1">
              {station.payment_methods.map((id) => (
                <Badge key={id} color="blue">{getPaymentMethod(id)}</Badge>
              ))}
            </div>
          </section>
        )}

        {/* Points */}
        <section>
          <Label>{t('points')} ({station.points.length})</Label>
          <div className="flex flex-col gap-3 mt-1">
            {station.points.map((point, i) => (
              <div key={point.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  {point.name || `Punkt ${i + 1}`}
                  {point.status && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                      point.status === 'AVAILABLE'
                        ? 'bg-green-100 text-green-700'
                        : point.status === 'OCCUPIED'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {point.status === 'AVAILABLE' ? t('status_available') :
                       point.status === 'OCCUPIED' ? t('status_occupied') :
                       t('status_unknown')}
                    </span>
                  )}
                </div>

                {/* Connectors */}
                {point.connectors.map((conn, j) => (
                  <div key={j} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-1">
                    <span className="text-green-600">⚡</span>
                    <span>{getConnectorName(conn.interface_id)}</span>
                    {conn.max_power_kw && (
                      <span className="text-xs text-gray-500">({conn.max_power_kw} kW)</span>
                    )}
                  </div>
                ))}

                {/* Charging modes */}
                {(point.charging_modes?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {point.charging_modes!.map((m) => (
                      <span key={m} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-1.5 py-0.5">
                        {getChargingMode(m)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Price */}
                {point.price_details && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                    {point.price_details}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
      {children}
    </div>
  )
}

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: 'gray' | 'blue' }) {
  const cls = color === 'blue'
    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
  return (
    <span className={`text-xs rounded border px-1.5 py-0.5 ${cls}`}>{children}</span>
  )
}
