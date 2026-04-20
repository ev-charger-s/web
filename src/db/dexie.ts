import Dexie, { type Table } from 'dexie'
import type { ChargerStation, EIPADictionary } from '../types'

export interface DexieStation extends ChargerStation {
  // search fields (lowercased for case-insensitive matching)
  _search_city: string
  _search_street: string
  _search_postal: string
}

const DB_VERSION = 3
const EIPA_GENERATED_AT_KEY = 'chargers_generated_at'
const BNETZA_GENERATED_AT_KEY = 'bnetza_generated_at'

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

  constructor() {
    super('ChargerDB')
    this.version(DB_VERSION).stores({
      stations: STORE_SCHEMA,
      bnetza_stations: STORE_SCHEMA,
    })
  }
}

export const db = new ChargerDB()

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

export async function loadBNetzAData(
  onProgress?: (loaded: number, total: number) => void
): Promise<{ count: number }> {
  const existingCount = await db.bnetza_stations.count()
  const storedAt = localStorage.getItem(BNETZA_GENERATED_AT_KEY)
  if (existingCount > 0 && storedAt) {
    onProgress?.(existingCount, existingCount)
    return { count: existingCount }
  }

  const { count, data } = await loadSource({
    url: `${import.meta.env.BASE_URL}bnetza.db.json`,
    table: db.bnetza_stations,
    generatedAtKey: BNETZA_GENERATED_AT_KEY,
    onProgress,
  })

  // Merge extra connector types into dictionary
  if (_dictionary && data.dictionary?.connector_interface_extra) {
    _dictionary = {
      ..._dictionary,
      connector_interface_extra: data.dictionary.connector_interface_extra,
    }
  }

  return { count }
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

export type CountryFilter = 'pl' | 'de' | 'all'

async function queryTable(table: Table<DexieStation>, filters: FilterParams): Promise<DexieStation[]> {
  let collection = table.toCollection()

  if (filters.charging_modes && filters.charging_modes.length > 0) {
    collection = table.where('charging_modes').anyOf(filters.charging_modes)
  }

  if (filters.connector_interface_ids && filters.connector_interface_ids.length > 0) {
    collection = table.where('connector_interface_ids').anyOf(filters.connector_interface_ids)
  }

  let results = await collection.toArray()

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
  const [pl, de] = await Promise.all([
    country !== 'de' ? queryTable(db.stations, filters) : Promise.resolve([]),
    country !== 'pl' ? queryTable(db.bnetza_stations, filters) : Promise.resolve([]),
  ])
  return [...pl, ...de]
}

export async function getAllStations(country: CountryFilter = 'all'): Promise<DexieStation[]> {
  const [pl, de] = await Promise.all([
    country !== 'de' ? db.stations.toArray() : Promise.resolve([]),
    country !== 'pl' ? db.bnetza_stations.toArray() : Promise.resolve([]),
  ])
  return [...pl, ...de]
}
