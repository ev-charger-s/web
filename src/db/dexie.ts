import Dexie, { type Table } from 'dexie'
import type { ChargerStation, EIPADictionary } from '../types'

export interface DexieStation extends ChargerStation {
  // search fields (lowercased for case-insensitive matching)
  _search_city: string
  _search_street: string
  _search_postal: string
}

const DB_VERSION = 2
const GENERATED_AT_KEY = 'chargers_generated_at'

class ChargerDB extends Dexie {
  stations!: Table<DexieStation>

  constructor() {
    super('ChargerDB')
    this.version(DB_VERSION).stores({
      stations: [
        'id',
        'pool_id',
        'operator_id',
        '_search_city',
        '_search_street',
        '_search_postal',
        '*charging_modes',
        '*connector_interface_ids',
        'max_power_kw',
      ].join(', '),
    })
  }
}

export const db = new ChargerDB()

let _dictionary: EIPADictionary | null = null

export async function loadData(
  onProgress?: (loaded: number, total: number) => void
): Promise<{ count: number; dictionary: EIPADictionary }> {
  const count = await db.stations.count()
  if (count > 0 && _dictionary) {
    return { count, dictionary: _dictionary }
  }

  const res = await fetch(`${import.meta.env.BASE_URL}chargers.db.json`)
  if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`)

  const data: { stations: ChargerStation[]; dictionary: EIPADictionary; generated_at: string } =
    await res.json()

  _dictionary = data.dictionary

  // Repopulate if data file is newer than what we have stored
  const storedGeneratedAt = localStorage.getItem(GENERATED_AT_KEY)
  if (storedGeneratedAt !== data.generated_at) {
    await db.stations.clear()
    const total = data.stations.length
    const CHUNK = 500
    const dexieStations: DexieStation[] = data.stations.map((s) => ({
      ...s,
      _search_city: s.city.toLowerCase(),
      _search_street: s.street.toLowerCase(),
      _search_postal: s.postal_code.toLowerCase(),
    }))
    for (let i = 0; i < total; i += CHUNK) {
      await db.stations.bulkPut(dexieStations.slice(i, i + CHUNK))
      onProgress?.(Math.min(i + CHUNK, total), total)
    }
    localStorage.setItem(GENERATED_AT_KEY, data.generated_at)
  }

  return { count: data.stations.length, dictionary: _dictionary! }
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

export async function queryStations(filters: FilterParams): Promise<DexieStation[]> {
  let collection = db.stations.toCollection()

  if (filters.charging_modes && filters.charging_modes.length > 0) {
    const modes = filters.charging_modes
    collection = db.stations
      .where('charging_modes')
      .anyOf(modes)
  }

  if (filters.connector_interface_ids && filters.connector_interface_ids.length > 0) {
    const ifaces = filters.connector_interface_ids
    collection = db.stations
      .where('connector_interface_ids')
      .anyOf(ifaces)
  }

  let results = await collection.toArray()

  // Text search (post-filter - Dexie doesn't support full-text natively)
  if (filters.query && filters.query.trim().length > 0) {
    const q = filters.query.trim().toLowerCase()
    results = results.filter(
      (s) =>
        s._search_city.includes(q) ||
        s._search_street.includes(q) ||
        s._search_postal.includes(q),
    )
  }

  // Power filter
  if (filters.min_power_kw !== undefined) {
    results = results.filter((s) => s.max_power_kw >= (filters.min_power_kw ?? 0))
  }

  return results
}

export async function getAllStations(): Promise<DexieStation[]> {
  return db.stations.toArray()
}
