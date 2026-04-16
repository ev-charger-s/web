import { useState, useEffect, useCallback, useRef } from 'react'
import { getAllStations, queryStations, type DexieStation, type FilterParams } from '../db/dexie'

export function useStations() {
  const [stations, setStations] = useState<DexieStation[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterParams>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyFilters = useCallback(async (f: FilterParams) => {
    const isEmpty =
      !f.query &&
      (!f.charging_modes || f.charging_modes.length === 0) &&
      (!f.connector_interface_ids || f.connector_interface_ids.length === 0) &&
      f.min_power_kw === undefined

    if (isEmpty) {
      const all = await getAllStations()
      setStations(all)
    } else {
      const results = await queryStations(f)
      setStations(results)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      await applyFilters(filters)
      setLoading(false)
    }, 300)
  }, [filters, applyFilters])

  const updateFilters = useCallback((partial: Partial<FilterParams>) => {
    setFilters((prev) => ({ ...prev, ...partial }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
  }, [])

  return { stations, loading, filters, updateFilters, clearFilters }
}
