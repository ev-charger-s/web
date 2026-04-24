import { useTranslation } from 'react-i18next'
import type { EIPADictionary } from '../../types'
import type { FilterParams, CountryFilter } from '../../db/dexie'
import { COUNTRY_SOURCES } from '../../db/sources'

interface FiltersProps {
  filters: FilterParams
  dictionary: EIPADictionary | null
  onUpdate: (partial: Partial<FilterParams>) => void
  onClear: () => void
  stationCount: number
  country: CountryFilter
  onCountryChange: (c: CountryFilter) => void
}

export default function FiltersPanel({ filters, dictionary, onUpdate, onClear, stationCount, country, onCountryChange }: FiltersProps) {
  const { t } = useTranslation()

  const chargingModes = dictionary?.charging_mode ?? []
  const connectors = dictionary?.connector_interface ?? []

  // Only show meaningful connectors (exclude domestic/obscure)
  const mainConnectors = connectors.filter((c) =>
    ['IEC-62196-T2-F-NOCABLE', 'IEC-62196-T2-F-CABLE', 'IEC-62196-T2-COMBO', 'CHADEMO', 'IEC-62196-T1-COMBO', 'TESLA-SPECIFIC'].includes(c.name)
  )

  const toggleArrayFilter = (key: 'charging_modes' | 'connector_interface_ids', id: number) => {
    const current = (filters[key] as number[] | undefined) ?? []
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    onUpdate({ [key]: next.length > 0 ? next : undefined })
  }

  const isActive = (key: 'charging_modes' | 'connector_interface_ids', id: number) => {
    return ((filters[key] as number[] | undefined) ?? []).includes(id)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-4 text-sm">
      {/* Country filter */}
      <div>
        <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('station_type')}</div>
        <div className="flex flex-wrap gap-1.5">
          {(['all', ...COUNTRY_SOURCES.map((s) => s.key)] as CountryFilter[]).map((c) => (
            <button
              key={c}
              onClick={() => onCountryChange(c)}
              className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                country === c
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-green-500'
              }`}
            >
              {t(`source_${c}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="search"
          value={filters.query ?? ''}
          onChange={(e) => onUpdate({ query: e.target.value || undefined })}
          placeholder={t('search_placeholder')}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Stats */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {t('stations_count', { count: stationCount })}
      </div>

      {/* Charging modes */}
      <div>
        <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('charging_mode')}</div>
        <div className="flex flex-wrap gap-1.5">
          {chargingModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => toggleArrayFilter('charging_modes', mode.id)}
              className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                isActive('charging_modes', mode.id)
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-green-500'
              }`}
            >
              {mode.name}
            </button>
          ))}
        </div>
      </div>

      {/* Connectors */}
      <div>
        <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('connector')}</div>
        <div className="flex flex-wrap gap-1.5">
          {mainConnectors.map((c) => (
            <button
              key={c.id}
              onClick={() => toggleArrayFilter('connector_interface_ids', c.id)}
              title={c.description}
              className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                isActive('connector_interface_ids', c.id)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-500'
              }`}
            >
              {c.description}
            </button>
          ))}
        </div>
      </div>

      {/* Min power */}
      <div>
        <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {t('min_power')}: {filters.min_power_kw ?? 0} kW
        </div>
        <input
          type="range"
          min={0}
          max={350}
          step={10}
          value={filters.min_power_kw ?? 0}
          onChange={(e) => {
            const val = Number(e.target.value)
            onUpdate({ min_power_kw: val > 0 ? val : undefined })
          }}
          className="w-full accent-green-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0</span><span>350 kW</span>
        </div>
      </div>

      {/* Clear */}
      <button
        onClick={onClear}
        className="mt-auto w-full py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
      >
        {t('filters_clear')}
      </button>
    </div>
  )
}
