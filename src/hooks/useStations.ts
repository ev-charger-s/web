import { useState, useEffect, useCallback, useRef } from 'react'
import { getAllStations, queryStations, type DexieStation, type FilterParams, type CountryFilter } from '../db/dexie'

export function useStations(dataLoaded: boolean, country: CountryFilter = 'all') {
  const [stations, setStations] = useState<DexieStation[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterParams>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyFilters = useCallback(async (f: FilterParams, c: CountryFilter) => {
    const isEmpty =
      !f.query &&
      (!f.charging_modes || f.charging_modes.length === 0) &&
      (!f.connector_interface_ids || f.connector_interface_ids.length === 0) &&
      f.min_power_kw === undefined

    if (isEmpty) {
      const all = await getAllStations(c)
      setStations(all)
    } else {
      const results = await queryStations(f, c)
      setStations(results)
    }
  }, [])

  useEffect(() => {
    if (!dataLoaded) return
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      await applyFilters(filters, country)
      setLoading(false)
    }, 300)
  }, [filters, applyFilters, dataLoaded, country])

  const updateFilters = useCallback((partial: Partial<FilterParams>) => {
    setFilters((prev) => ({ ...prev, ...partial }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
  }, [])

  return { stations, loading, filters, updateFilters, clearFilters }
}
