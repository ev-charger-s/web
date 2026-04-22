#!/usr/bin/env node
// scripts/process-beev.mjs
// Converts road.io OCPI 2.2.1 JSON → public/beev.db.json
// Same ChargerStation format as chargers.db.json, with source: 'be'
//
// Input: data/beev/locations.json
// Format: OCPI 2.2.1 Location objects (one location = one station)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inputFile = path.join(__dirname, '..', 'data', 'beev', 'locations.json')
const outputDir = path.join(__dirname, '..', 'public')

// OCPI connector standard → EIPA interface_id
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

// FNV-1a 32-bit hash → positive int with prefix 7 (avoid collisions: PL=1-6, DE=no prefix, FR=9, NL=8, BE=7)
function hashId(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return parseInt('7' + (h % 100000000).toString().padStart(8, '0'))
}

function mapConnector(standard, format) {
  const entry = STANDARD_MAP[standard]
  if (!entry) return { id: null, name: standard || 'Unknown' }
  if (standard === 'IEC_62196_T2') {
    if (format === 'CABLE') return { id: entry.cable, name: entry.name_cable }
    return { id: entry.socket, name: entry.name_socket }
  }
  return { id: entry.id, name: entry.name }
}

// max_electric_power is in W in OCPI 2.2.1, convert to kW
function powerKw(connector) {
  if (connector.max_electric_power) return connector.max_electric_power / 1000
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
  // Filter only Belgian locations
  if (loc.country_code !== 'BE' && loc.country !== 'BEL') { skipped++; continue }

  const lat = parseFloat(loc.coordinates?.latitude)
  const lng = parseFloat(loc.coordinates?.longitude)
  if (isNaN(lat) || isNaN(lng)) { skipped++; continue }

  const evses = (loc.evses || []).filter(e => e.status !== 'REMOVED')
  if (evses.length === 0) { skipped++; continue }

  const points = []
  const connIfaceIds = new Set()
  const connNames = new Set()
  let maxPower = 0

  for (const evse of evses) {
    const connectors = []
    for (const c of (evse.connectors || [])) {
      const { id: ifaceId, name } = mapConnector(c.standard, c.format)
      const kw = powerKw(c)
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
      id: hashId((evse.uid || evse.evse_id || '') + '-pt'),
      connectors,
    })
  }

  const street = (loc.address || '').trim()

  stations.push({
    id: hashId('BE|' + (loc.party_id || '') + '|' + (loc.id || '')),
    pool_id: hashId('BE|' + (loc.party_id || '') + '|' + (loc.id || '')),
    source: 'be',
    lat,
    lng,
    city: (loc.city || '').trim(),
    province: '',
    postal_code: (loc.postal_code || '').trim(),
    street,
    street_number: '',
    operator_id: 0,
    operator_name: (loc.operator?.name || loc.suboperator?.name || '').trim(),
    payment_methods: [],
    points,
    connector_interface_ids: [...connIfaceIds],
    connector_names: [...connNames],
    max_power_kw: Math.round(maxPower * 10) / 10,
  })
}

console.log(`Processed: ${stations.length}, skipped: ${skipped}`)

const output = {
  stations,
  dictionary: { connector_interface_extra: EXTRA_CONNECTORS },
  source: 'be',
  generated_at: new Date().toISOString(),
}

fs.mkdirSync(outputDir, { recursive: true })
const outputFile = path.join(outputDir, 'beev.db.json')
const json = JSON.stringify(output, (key, val) => {
  if (val === null || val === undefined) return undefined
  if (Array.isArray(val) && val.length === 0 && ['charging_modes', 'authentication_methods'].includes(key)) return undefined
  return val
})
fs.writeFileSync(outputFile, json)

const sizeMB = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)
console.log(`Done! Output: ${outputFile} (${sizeMB} MB, ${stations.length} stations)`)
