import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { loadData, getDictionary, db } from './db/dexie'
import { useStations } from './hooks/useStations'
import { useGeolocation } from './hooks/useGeolocation'
import { useTheme } from './hooks/useTheme'
import MapView from './components/Map/MapView'
import FiltersPanel from './components/Filters/FiltersPanel'
import StationPanel from './components/StationPanel/StationPanel'
import type { ChargerStation, EIPADictionary } from './types'
import './i18n'

function getStationIdFromUrl(): number | null {
  const params = new URLSearchParams(window.location.search)
  const val = params.get('station')
  if (!val) return null
  const id = parseInt(val, 10)
  return isNaN(id) ? null : id
}

function setStationInUrl(id: number | null) {
  const url = new URL(window.location.href)
  if (id != null) {
    url.searchParams.set('station', String(id))
  } else {
    url.searchParams.delete('station')
  }
  window.history.pushState({}, '', url.toString())
}

export default function App() {
  const { t, i18n } = useTranslation()
  const { theme, toggle: toggleTheme } = useTheme()
  const { lat: userLat, lng: userLng, loading: geoLoading, error: geoError, locate } = useGeolocation()
  const [dataLoaded, setDataLoaded] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [dictionary, setDictionary] = useState<EIPADictionary | null>(null)
  const [selectedStation, setSelectedStation] = useState<ChargerStation | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { stations, filters, updateFilters, clearFilters } = useStations(dataLoaded)

  useEffect(() => {
    loadData((loaded, total) => setImportProgress({ loaded, total }))
      .then(({ dictionary: dict }) => {
        setDictionary(dict)
        setImportProgress(null)
        setDataLoaded(true)
      })
      .catch((e) => {
        console.error(e)
        setDataError(e.message)
      })
  }, [])

  useEffect(() => {
    if (dataLoaded && !dictionary) {
      setDictionary(getDictionary())
    }
  }, [dataLoaded, dictionary])

  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null)

  // On data loaded, open station from URL if present and fly to it
  useEffect(() => {
    if (!dataLoaded) return
    const id = getStationIdFromUrl()
    if (id == null) return
    db.stations.get(id).then((s) => {
      if (s) {
        setSelectedStation(s)
        setFlyTo({ lat: s.lat, lng: s.lng, zoom: 17 })
      }
    })
  }, [dataLoaded])

  const handleStationClick = useCallback((station: ChargerStation) => {
    setSelectedStation(station)
    setStationInUrl(station.id)
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedStation(null)
    setStationInUrl(null)
  }, [])

  // Geo error toast — auto-dismiss after 8 s
  const [geoToastVisible, setGeoToastVisible] = useState(false)
  useEffect(() => {
    if (!geoError) return
    setGeoToastVisible(true)
    const t = setTimeout(() => setGeoToastVisible(false), 8000)
    return () => clearTimeout(t)
  }, [geoError])

  const geoErrorTitle = geoError === 'denied' ? t('location_denied')
    : geoError === 'timeout' ? t('location_timeout')
    : geoError === 'not_supported' ? t('location_not_supported')
    : t('location_unavailable')

  const geoErrorHint = geoError === 'denied' ? t('location_denied_hint')
    : geoError === 'timeout' ? t('location_timeout_hint')
    : geoError === 'unavailable' ? t('location_unavailable_hint')
    : null

  const switchLang = () => {
    const next = i18n.language === 'pl' ? 'en' : 'pl'
    i18n.changeLanguage(next)
    localStorage.setItem('lang', next)
  }

  if (!dataLoaded && !dataError) {
    const pct = importProgress ? Math.round((importProgress.loaded / importProgress.total) * 100) : null
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">
        <div className="text-center w-64">
          <div className="animate-spin text-4xl mb-4">⚡</div>
          {pct !== null ? (
            <>
              <div className="text-sm mb-2">{t('loading_import')} {pct}%</div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {importProgress!.loaded} / {importProgress!.total}
              </div>
            </>
          ) : (
            <div>{t('loading')}</div>
          )}
        </div>
      </div>
    )
  }

  if (dataError) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900 text-red-600">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <div>{t('loading_error')}</div>
          <div className="text-sm mt-2 text-gray-500">{dataError}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Top bar */}
      <header className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-10 shrink-0">
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-lg"
          aria-label={t('filters')}
        >
          ☰
        </button>
        <span className="font-semibold text-green-700 dark:text-green-400 text-sm whitespace-nowrap">
          ⚡ {t('app_title')}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => { locate() }}
          disabled={geoLoading}
          title={geoError === 'denied' ? t('location_denied') : t('locate_me')}
          className={`p-2 rounded-lg text-lg transition-colors ${
            geoError
              ? 'text-red-500'
              : userLat !== null
              ? 'text-green-600'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {geoLoading ? '⏳' : '📍'}
        </button>
        <button
          onClick={switchLang}
          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {i18n.language === 'pl' ? t('lang_en') : t('lang_pl')}
        </button>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-lg"
          aria-label={theme === 'dark' ? t('light_mode') : t('dark_mode')}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside
          className={`
            absolute md:relative z-20 top-0 left-0 h-full
            bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
            transition-transform duration-200
            w-72 md:w-72
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <FiltersPanel
            filters={filters}
            dictionary={dictionary}
            onUpdate={updateFilters}
            onClear={clearFilters}
            stationCount={stations.length}
          />
        </aside>

        {/* Overlay on mobile when sidebar open */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Map */}
        <main className="flex-1 relative">
          <MapView
            stations={stations}
            userLat={flyTo?.lat ?? userLat}
            userLng={flyTo?.lng ?? userLng}
            flyZoom={flyTo?.zoom}
            onStationClick={handleStationClick}
          />
        </main>

        {/* Station detail panel */}
        {selectedStation && (
          <StationPanel
            station={selectedStation}
            dictionary={dictionary}
            onClose={handleClosePanel}
          />
        )}

        {/* Geo error toast */}
        {geoToastVisible && geoError && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(90vw,360px)] bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl px-4 py-3 flex gap-3 items-start">
            <span className="text-xl mt-0.5">📍</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{geoErrorTitle}</div>
              {geoErrorHint && <div className="text-xs text-gray-300 mt-0.5 leading-snug">{geoErrorHint}</div>}
            </div>
            <button
              onClick={() => setGeoToastVisible(false)}
              className="text-gray-400 hover:text-white text-lg leading-none shrink-0 mt-0.5"
            >✕</button>
          </div>
        )}
      </div>
    </div>
  )
}
