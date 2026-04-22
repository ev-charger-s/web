#!/usr/bin/env node
// scripts/process-ndw.mjs
// Converts NDW OCPI JSON → public/ndw.db.json
// Same ChargerStation format as chargers.db.json, with source: 'nl'
//
// Input: data/ndw/charging_point_locations_ocpi.json
// Format: OCPI 2.x Location objects (one location = one station)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inputFile = path.join(__dirname, '..', 'data', 'ndw', 'charging_point_locations_ocpi.json')
const outputDir = path.join(__dirname, '..', 'public')

// OCPI connector standard → EIPA interface_id
// Negative IDs: new types not in EIPA dictionary
const STANDARD_MAP = {
  'IEC_62196_T2':        { socket: 10, cable: 17, name_socket: 'IEC 62196 Type 2', name_cable: 'IEC 62196 Type 2 (kabel)' },
  'IEC_62196_T2_COMBO':  { id: 29,  name: 'CCS/Combo 2' },
  'CHADEMO':             { id: 11,  name: 'CHAdeMO' },
  'IEC_62196_T1':        { id: 25,  name: 'IEC 62196 Type 1' },
  'IEC_62196_T1_COMBO':  { id: -7,  name: 'CCS/Combo 1' },
  'IEC_62196_T3C':       { id: -6,  name: 'IEC 62196 Type 3C (Scame)' },
  'DOMESTIC_F':          { id: 6,   name: 'Domestic-F (Schuko)' },
  'DOMESTIC_E':          { id: 6,   name: 'Domestic-F (Schuko)' },
  'TESLA_S':             { id: -2,  name: 'Tesla Type 2' },
}

const EXTRA_CONNECTORS = [
  { id: -6, name: 'TYPE-3C', description: 'IEC 62196 Type 3C (Scame)' },
  { id: -7, name: 'CCS1',    description: 'CCS/Combo 1 (Type 1 + DC)' },
]

function mapConnector(standard, format) {
  const entry = STANDARD_MAP[standard]
  if (!entry) return { id: null, name: standard }
  // IEC_62196_T2: distinguish socket vs cable
  if (standard === 'IEC_62196_T2') {
    if (format === 'CABLE') return { id: entry.cable, name: entry.name_cable }
    return { id: entry.socket, name: entry.name_socket }
  }
  return { id: entry.id, name: entry.name }
}

// max_electric_power is in W in OCPI, convert to kW
function powerKw(evse, connector) {
  if (connector.max_electric_power) return connector.max_electric_power / 1000
  // Fallback: V * A
  if (connector.max_voltage && connector.max_amperage) {
    return (connector.max_voltage * connector.max_amperage) / 1000
  }
  return 0
}

console.log(`Reading: ${inputFile} ...`)
const raw = fs.readFileSync(inputFile, 'utf8')
const locations = JSON.parse(raw)
console.log(`Locations: ${locations.length}`)

const stations = []
let skipped = 0

for (const loc of locations) {
  const lat = parseFloat(loc.coordinates?.latitude)
  const lng = parseFloat(loc.coordinates?.longitude)
  if (isNaN(lat) || isNaN(lng)) { skipped++; continue }

  const evses = loc.evses || []
  const points = []
  const connIfaceIds = new Set()
  const connNames = new Set()
  let maxPower = 0

  for (const evse of evses) {
    const connectors = []
    for (const c of (evse.connectors || [])) {
      const { id: ifaceId, name } = mapConnector(c.standard, c.format)
      const kw = powerKw(evse, c)
      connectors.push({
        id: ifaceId,
        interface_id: ifaceId,
        power_kw: kw || undefined,
        max_power_kw: kw || undefined,
      })
      if (ifaceId != null) connIfaceIds.add(ifaceId)
      if (name) connNames.add(name)
      if (kw > maxPower) maxPower = kw
    }
    points.push({
      id: hashId(evse.uid || evse.evse_id || String(Math.random())),
      connectors,
    })
  }

  // Parse address — strip postal code from address if it appears there
  const street = (loc.address || '').trim()
  const streetNumMatch = street.match(/^(\d+[\w-]*)\s+(.+)/)
  const streetName = streetNumMatch ? streetNumMatch[2] : street
  const streetNum = streetNumMatch ? streetNumMatch[1] : ''

  stations.push({
    id: hashId(loc.party_id + '|' + loc.id),
    pool_id: hashId(loc.party_id + '|' + loc.id),
    source: 'nl',
    lat,
    lng,
    city: (loc.city || '').trim(),
    province: (loc.state || '').trim(),
    postal_code: (loc.postal_code || '').trim(),
    street: streetName,
    street_number: streetNum,
    operator_id: 0,
    operator_name: (loc.operator?.name || '').trim(),
    payment_methods: [],
    points,
    connector_interface_ids: [...connIfaceIds],
    connector_names: [...connNames],
    max_power_kw: Math.round(maxPower * 10) / 10,
  })
}

console.log(`Processed: ${stations.length}, skipped: ${skipped}`)

// FNV-1a 32-bit hash → positive int with prefix 8 (to avoid collisions)
function hashId(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return parseInt('8' + (h % 100000000).toString().padStart(8, '0'))
}

const output = {
  stations,
  dictionary: { connector_interface_extra: EXTRA_CONNECTORS },
  source: 'nl',
  generated_at: new Date().toISOString(),
}

fs.mkdirSync(outputDir, { recursive: true })
const outputFile = path.join(outputDir, 'ndw.db.json')
const json = JSON.stringify(output, (key, val) => {
  if (val === null || val === undefined) return undefined
  if (Array.isArray(val) && val.length === 0 && ['charging_modes', 'authentication_methods'].includes(key)) return undefined
  return val
})
fs.writeFileSync(outputFile, json)

const sizeMB = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)
console.log(`Done! Output: ${outputFile} (${sizeMB} MB, ${stations.length} stations)`)
