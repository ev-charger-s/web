#!/usr/bin/env node
// scripts/process-data.mjs
// Merges EIPA JSON files into public/chargers.db.json for Dexie

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
const outputDir = path.join(__dirname, '..', 'public')

function readJSON(name) {
  const file = path.join(dataDir, `${name}.json`)
  if (!fs.existsSync(file)) {
    console.warn(`Warning: ${file} not found, using empty fallback`)
    return { data: [] }
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

console.log('Reading source files...')
const operatorData = readJSON('operator')
const poolData = readJSON('pool')
const stationData = readJSON('station')
const pointData = readJSON('point')
const dictionaryData = readJSON('dictionary')

const operators = operatorData.data || []
const pools = poolData.data || []
const stations = stationData.data || []
const points = pointData.data || []

// Build lookup maps
const operatorMap = new Map(operators.map(o => [o.id, o]))
const poolMap = new Map(pools.map(p => [p.id, p]))

// Group points by station_id
const pointsByStation = new Map()
for (const point of points) {
  const sid = point.station_id
  if (!pointsByStation.has(sid)) pointsByStation.set(sid, [])
  pointsByStation.get(sid).push(point)
}

console.log(`Processing ${stations.length} stations, ${points.length} points...`)

const processedStations = stations.map(station => {
  const pool = poolMap.get(station.pool_id) || {}
  const operator = operatorMap.get(pool.operator_id) || {}
  const stationPoints = pointsByStation.get(station.id) || []

  // Process points
  const processedPoints = stationPoints.map(point => {
    // Each connector has `interfaces` (array) and `power` in the raw data
    const connectors = (point.connectors || []).flatMap(conn => {
      const interfaces = conn.interfaces || (conn.interface_id != null ? [conn.interface_id] : [])
      const power = conn.max_power_kw || conn.power_kw || conn.power || null
      return interfaces.map(iface => ({
        id: conn.id,
        interface_id: iface,
        power_kw: power,
        max_power_kw: power,
      }))
    })

    // charging_modes may come as direct array or via charging_solutions[].mode
    const chargingModes = point.charging_modes?.length
      ? point.charging_modes
      : (point.charging_solutions || []).map(s => s.mode).filter(Boolean)

    return {
      id: point.id,
      name: point.name || null,
      status: point.status || null,
      charging_modes: chargingModes,
      connectors,
      price: point.price || null,
      price_details: point.price_details || null,
    }
  })

  // Collect all connector interface IDs and charging modes from points
  const allConnectorIds = [...new Set(
    processedPoints.flatMap(p => p.connectors.map(c => c.interface_id)).filter(Boolean)
  )]
  const allChargingModes = [...new Set(
    processedPoints.flatMap(p => p.charging_modes).filter(Boolean)
  )]
  const maxPower = processedPoints.reduce((max, p) => {
    const pts = p.connectors.reduce((m, c) => Math.max(m, c.max_power_kw || 0), 0)
    return Math.max(max, pts)
  }, 0)

  return {
    id: station.id,
    pool_id: station.pool_id,
    lat: station.latitude,
    lng: station.longitude,
    city: pool.city || station.location?.city || '',
    province: station.location?.province || '',
    postal_code: pool.postal_code || '',
    street: pool.street || '',
    street_number: pool.street_number || '',
    operator_id: pool.operator_id || 0,
    operator_name: operator.name || '',
    authentication_methods: station.authentication_methods || [],
    payment_methods: station.payment_methods || [],
    points: processedPoints,
    charging_modes: allChargingModes,
    connector_interface_ids: allConnectorIds,
    max_power_kw: maxPower,
  }
})

// Group stations at exactly the same coordinates into a single entry
// (different pools can share the same physical location)
const groupMap = new Map()
for (const station of processedStations) {
  // Key: exact lat/lng string — same coordinates = same physical location
  const key = `${station.lat}|${station.lng}`
  if (!groupMap.has(key)) {
    groupMap.set(key, { ...station, points: [...station.points] })
  } else {
    const existing = groupMap.get(key)
    // Merge points from all stations at this location
    existing.points = [...existing.points, ...station.points]
    // Merge connector ids, charging modes, auth/payment methods
    existing.connector_interface_ids = [...new Set([...existing.connector_interface_ids, ...station.connector_interface_ids])]
    existing.charging_modes = [...new Set([...existing.charging_modes, ...station.charging_modes])]
    existing.authentication_methods = [...new Set([...existing.authentication_methods, ...station.authentication_methods])]
    existing.payment_methods = [...new Set([...existing.payment_methods, ...station.payment_methods])]
    existing.max_power_kw = Math.max(existing.max_power_kw, station.max_power_kw)
    // Keep the lowest station id as canonical
    if (station.id < existing.id) existing.id = station.id
  }
}
const groupedStations = Array.from(groupMap.values())
console.log(`Grouped ${processedStations.length} stations → ${groupedStations.length} unique locations`)

const output = {
  stations: groupedStations,
  dictionary: dictionaryData,
  generated_at: new Date().toISOString(),
}

fs.mkdirSync(outputDir, { recursive: true })
const outputFile = path.join(outputDir, 'chargers.db.json')
fs.writeFileSync(outputFile, JSON.stringify(output))

const sizeMB = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)
console.log(`Done! Output: ${outputFile} (${sizeMB} MB)`)
console.log(`Stations: ${groupedStations.length} (from ${processedStations.length}), Points: ${points.length}`)
