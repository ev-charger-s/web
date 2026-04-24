import Dexie, { type Table } from 'dexie'
import type { ChargerStation, EIPADictionary } from '../types'

export interface DexieStation extends ChargerStation {
  // search fields (lowercased for case-insensitive matching)
  _search_city: string
  _search_street: string
  _search_postal: string
}

const DB_VERSION = 6
const EIPA_GENERATED_AT_KEY = 'chargers_generated_at'

const STORE_SCHEMA = [
  'id',
  'pool_id',
  'source',
  'operator_id',
  '_search_city',
  '_search_street',
  '_search_postal',
  '*charging_modes',
  '*connector_interface_ids',
  'max_power_kw',
].join(', ')

class ChargerDB extends Dexie {
  stations!: Table<DexieStation>
  bnetza_stations!: Table<DexieStation>
  irve_stations!: Table<DexieStation>
  ndw_stations!: Table<DexieStation>
  beev_stations!: Table<DexieStation>

  constructor() {
    super('ChargerDB')
    this.version(DB_VERSION).stores({
      stations: STORE_SCHEMA,
      bnetza_stations: STORE_SCHEMA,
      irve_stations: STORE_SCHEMA,
      ndw_stations: STORE_SCHEMA,
      beev_stations: STORE_SCHEMA,
    })
  }
}

export const db = new ChargerDB()

// Module-level dictionary — written once by loadData, extended by each country loader.
// Concurrent loaders only ever merge into it, never overwrite the whole object,
// so the lack of a lock is safe in practice.
let _dictionary: EIPADictionary | null = null

function toDexieStation(s: ChargerStation): DexieStation {
  return {
    ...s,
    source: s.source ?? 'pl',
    authentication_methods: s.authentication_methods ?? [],
    payment_methods: s.payment_methods ?? [],
    charging_modes: s.charging_modes ?? [],
    connector_interface_ids: s.connector_interface_ids ?? [],
    connector_names: s.connector_names ?? [],
    _search_city: (s.city ?? '').toLowerCase(),
    _search_street: (s.street ?? '').toLowerCase(),
    _search_postal: (s.postal_code ?? '').toLowerCase(),
  }
}

async function loadSource(opts: {
  url: string
  table: Table<DexieStation>
  generatedAtKey: string
  onProgress?: (loaded: number, total: number) => void
}): Promise<{ count: number; data: { stations: ChargerStation[]; dictionary?: Partial<EIPADictionary>; generated_at: string } }> {
  const res = await fetch(opts.url)
  if (!res.ok) throw new Error(`Failed to fetch ${opts.url}: ${res.status}`)

  const data: {
    stations: ChargerStation[]
    dictionary?: Partial<EIPADictionary>
    generated_at: string
  } = await res.json()

  const storedGeneratedAt = localStorage.getItem(opts.generatedAtKey)
  if (storedGeneratedAt !== data.generated_at) {
    await opts.table.clear()
    const total = data.stations.length
    const CHUNK = 500
    const dexieStations = data.stations.map(toDexieStation)
    for (let i = 0; i < total; i += CHUNK) {
      await opts.table.bulkPut(dexieStations.slice(i, i + CHUNK))
      opts.onProgress?.(Math.min(i + CHUNK, total), total)
    }
    localStorage.setItem(opts.generatedAtKey, data.generated_at)
  } else {
    // Already up to date — report full progress immediately
    opts.onProgress?.(data.stations.length, data.stations.length)
  }

  return { count: data.stations.length, data }
}

/**
 * Merge extra connector types from a country db.json into the shared dictionary.
 * Safe to call from concurrent loaders — only adds entries not already present.
 */
function mergeExtraConnectors(extra: EIPADictionary['connector_interface_extra']) {
  if (!_dictionary || !extra?.length) return
  const existing = _dictionary.connector_interface_extra ?? []
  const merged = [...existing]
  for (const entry of extra) {
    if (!merged.find((e) => e.id === entry.id)) merged.push(entry)
  }
  _dictionary = { ..._dictionary, connector_interface_extra: merged }
}

// ── Generic country loader ────────────────────────────────────────────────────
// Used by all country loaders except PL (which also handles the main dictionary).

interface CountrySourceOpts {
  file: string
  table: Table<DexieStation>
  generatedAtKey: string
  onProgress?: (loaded: number, total: number) => void
}

async function loadCountrySource(opts: CountrySourceOpts): Promise<{ count: number }> {
  const existingCount = await opts.table.count()
  const storedAt = localStorage.getItem(opts.generatedAtKey)
  if (existingCount > 0 && storedAt) {
    opts.onProgress?.(existingCount, existingCount)
    return { count: existingCount }
  }

  const { count, data } = await loadSource({
    url: `${import.meta.env.BASE_URL}${opts.file}`,
    table: opts.table,
    generatedAtKey: opts.generatedAtKey,
    onProgress: opts.onProgress,
  })

  mergeExtraConnectors(data.dictionary?.connector_interface_extra)

  return { count }
}

// ── Public loaders ────────────────────────────────────────────────────────────

export async function loadData(
  onProgress?: (loaded: number, total: number) => void
): Promise<{ count: number; dictionary: EIPADictionary }> {
  const existingCount = await db.stations.count()
  const storedAt = localStorage.getItem(EIPA_GENERATED_AT_KEY)
  if (existingCount > 0 && storedAt && _dictionary) {
    onProgress?.(existingCount, existingCount)
    return { count: existingCount, dictionary: _dictionary }
  }

  const { count, data } = await loadSource({
    url: `${import.meta.env.BASE_URL}chargers.db.json`,
    table: db.stations,
    generatedAtKey: EIPA_GENERATED_AT_KEY,
    onProgress,
  })

  if (data.dictionary) {
    _dictionary = data.dictionary as EIPADictionary
  }

  return { count, dictionary: _dictionary! }
}

export function loadBNetzAData(onProgress?: (loaded: number, total: number) => void) {
  return loadCountrySource({
    file: 'bnetza.db.json',
    table: db.bnetza_stations,
    generatedAtKey: 'bnetza_generated_at',
    onProgress,
  })
}

export function loadIRVEData(onProgress?: (loaded: number, total: number) => void) {
  return loadCountrySource({
    file: 'irve.db.json',
    table: db.irve_stations,
    generatedAtKey: 'irve_generated_at',
    onProgress,
  })
}

export function loadNDWData(onProgress?: (loaded: number, total: number) => void) {
  return loadCountrySource({
    file: 'ndw.db.json',
    table: db.ndw_stations,
    generatedAtKey: 'ndw_generated_at',
    onProgress,
  })
}

export function loadBEEVData(onProgress?: (loaded: number, total: number) => void) {
  return loadCountrySource({
    file: 'beev.db.json',
    table: db.beev_stations,
    generatedAtKey: 'beev_generated_at',
    onProgress,
  })
}

export function getDictionary(): EIPADictionary | null {
  return _dictionary
}

export interface FilterParams {
  query?: string
  charging_modes?: number[]
  connector_interface_ids?: number[]
  min_power_kw?: number
  max_power_kw?: number
}

export type CountryFilter = 'pl' | 'de' | 'fr' | 'nl' | 'be' | 'all'

async function queryTable(table: Table<DexieStation>, filters: FilterParams): Promise<DexieStation[]> {
  let collection = table.toCollection()

  // Dexie can only use one index at a time — use the first applicable index,
  // then filter the second criterion in JavaScript to avoid silently dropping it.
  if (filters.charging_modes && filters.charging_modes.length > 0) {
    collection = table.where('charging_modes').anyOf(filters.charging_modes)
  }

  let results = await collection.toArray()

  // Apply connector_interface_ids filter in JS (cannot combine two where() calls)
  if (filters.connector_interface_ids && filters.connector_interface_ids.length > 0) {
    const ids = new Set(filters.connector_interface_ids)
    results = results.filter((s) => s.connector_interface_ids.some((id) => ids.has(id)))
  }

  if (filters.query && filters.query.trim().length > 0) {
    const q = filters.query.trim().toLowerCase()
    results = results.filter(
      (s) =>
        s._search_city.includes(q) ||
        s._search_street.includes(q) ||
        s._search_postal.includes(q),
    )
  }

  if (filters.min_power_kw !== undefined) {
    results = results.filter((s) => s.max_power_kw >= (filters.min_power_kw ?? 0))
  }

  return results
}

export async function queryStations(filters: FilterParams, country: CountryFilter = 'all'): Promise<DexieStation[]> {
  const [pl, de, fr, nl, be] = await Promise.all([
    country === 'pl' || country === 'all' ? queryTable(db.stations, filters) : Promise.resolve([]),
    country === 'de' || country === 'all' ? queryTable(db.bnetza_stations, filters) : Promise.resolve([]),
    country === 'fr' || country === 'all' ? queryTable(db.irve_stations, filters) : Promise.resolve([]),
    country === 'nl' || country === 'all' ? queryTable(db.ndw_stations, filters) : Promise.resolve([]),
    country === 'be' || country === 'all' ? queryTable(db.beev_stations, filters) : Promise.resolve([]),
  ])
  return [...pl, ...de, ...fr, ...nl, ...be]
}

export async function getAllStations(country: CountryFilter = 'all'): Promise<DexieStation[]> {
  const [pl, de, fr, nl, be] = await Promise.all([
    country === 'pl' || country === 'all' ? db.stations.toArray() : Promise.resolve([]),
    country === 'de' || country === 'all' ? db.bnetza_stations.toArray() : Promise.resolve([]),
    country === 'fr' || country === 'all' ? db.irve_stations.toArray() : Promise.resolve([]),
    country === 'nl' || country === 'all' ? db.ndw_stations.toArray() : Promise.resolve([]),
    country === 'be' || country === 'all' ? db.beev_stations.toArray() : Promise.resolve([]),
  ])
  return [...pl, ...de, ...fr, ...nl, ...be]
}
