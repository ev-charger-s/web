/**
 * Searches all Dexie tables for a station by ID.
 *
 * Used wherever a station ID from the URL or map click needs to be
 * resolved to a full DexieStation object, avoiding repeated pyramid
 * chains of .then() / db.table.get() calls.
 */
import { db } from './dexie'
import type { DexieStation } from './dexie'

const TABLES = [
  db.stations,
  db.bnetza_stations,
  db.irve_stations,
  db.ndw_stations,
  db.beev_stations,
] as const

export async function findStation(id: number): Promise<DexieStation | undefined> {
  for (const table of TABLES) {
    const station = await table.get(id)
    if (station) return station
  }
  return undefined
}
