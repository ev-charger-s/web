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
    const connectors = (point.connectors || []).map(conn => ({
      id: conn.id,
      interface_id: conn.interface_id,
      power_kw: conn.power_kw || null,
      max_power_kw: conn.max_power_kw || conn.power_kw || null,
    }))

    return {
      id: point.id,
      name: point.name || null,
      status: point.status || null,
      charging_modes: point.charging_modes || [],
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

const output = {
  stations: processedStations,
  dictionary: dictionaryData,
  generated_at: new Date().toISOString(),
}

fs.mkdirSync(outputDir, { recursive: true })
const outputFile = path.join(outputDir, 'chargers.db.json')
fs.writeFileSync(outputFile, JSON.stringify(output))

const sizeMB = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)
console.log(`Done! Output: ${outputFile} (${sizeMB} MB)`)
console.log(`Stations: ${processedStations.length}, Points: ${points.length}`)
