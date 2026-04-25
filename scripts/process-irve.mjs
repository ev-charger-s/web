#!/usr/bin/env node
// scripts/process-irve.mjs
// Converts French IRVE CSV (schema v2.3.x) → public/irve.db.json
// Same ChargerStation format as eipa.db.json, with source: 'fr'
//
// IRVE CSV: UTF-8, comma-separated, one row = one PDC (point de charge)
// Grouping: by id_station_itinerance (station ID)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data', 'irve')
const outputDir = path.join(__dirname, '..', 'public')

// --- Connector mapping: IRVE boolean columns → EIPA interface_id ---
// Negative IDs: new types not present in EIPA dictionary
const CONNECTOR_COLUMNS = [
  { col: 'prise_type_2',         id: 17,  name: 'IEC 62196 Type 2' },
  { col: 'prise_type_combo_ccs', id: 29,  name: 'CCS/Combo 2' },
  { col: 'prise_type_chademo',   id: 11,  name: 'CHAdeMO' },
  { col: 'prise_type_ef',        id: -4,  name: 'Type E/F (FR)' },
  { col: 'prise_type_autre',     id: -5,  name: 'Autre (FR)' },
]

const EXTRA_CONNECTORS = [
  { id: -4, name: 'TYPE-EF', description: 'Type E/F (French domestic / Schuko)' },
  { id: -5, name: 'AUTRE',   description: 'Autre type de prise (IRVE)' },
]

// --- CSV parser (UTF-8, comma separator, RFC 4180 quoting) ---
function parseCSVLine(line) {
  const fields = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields
}

// Find latest CSV file
const latestFile = fs.existsSync(path.join(dataDir, 'latest.txt'))
  ? fs.readFileSync(path.join(dataDir, 'latest.txt'), 'utf8').trim()
  : fs.readdirSync(dataDir).find(f => f.endsWith('.csv'))

if (!latestFile) {
  console.error('No IRVE CSV found in data/irve/. Run fetch-irve.mjs first.')
  process.exit(1)
}

const csvPath = path.join(dataDir, latestFile)
console.log(`Reading: ${latestFile} ...`)
const content = fs.readFileSync(csvPath, 'utf8')
const lines = content.split(/\r?\n/)

const header = parseCSVLine(lines[0])
console.log(`Columns: ${header.length}, rows: ${lines.length - 1}`)

// Column indices
function col(name) {
  const i = header.indexOf(name)
  if (i === -1) throw new Error(`Column not found: ${name}`)
  return i
}

const COL = {
  STATION_ID:   col('id_station_itinerance'),
  STATION_NAME: col('nom_station'),
  PDC_ID:       col('id_pdc_itinerance'),
  OPERATOR:     col('nom_operateur'),
  ADDRESS:      col('adresse_station'),
  COMMUNE:      col('consolidated_commune'),
  POSTAL:       col('consolidated_code_postal'),
  LNG:          col('consolidated_longitude'),
  LAT:          col('consolidated_latitude'),
  POWER:        col('puissance_nominale'),
  GRATUIT:      col('gratuit'),
  PAIEMENT_CB:  col('paiement_cb'),
  PAIEMENT_AUTRE: col('paiement_autre'),
  HORAIRES:     col('horaires'),
}
// Connector column indices
const CONN_COLS = CONNECTOR_COLUMNS.map(c => ({ ...c, idx: col(c.col) }))

console.log('Column indices OK')

// Process rows — group PDCs into stations by id_station_itinerance
const stationMap = new Map() // id_station_itinerance → station data
let skipped = 0
let pdcCount = 0

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim()
  if (!line) continue

  const row = parseCSVLine(line)
  if (row.length < 20) continue

  const lngStr = row[COL.LNG]?.trim()
  const latStr = row[COL.LAT]?.trim()
  const lng = parseFloat(lngStr)
  const lat = parseFloat(latStr)
  if (isNaN(lat) || isNaN(lng)) { skipped++; continue }

  const stationId = row[COL.STATION_ID]?.trim()
  if (!stationId) { skipped++; continue }

  const powerKw = parseFloat(row[COL.POWER]?.trim()) || 0

  // Determine connectors for this PDC
  const connectors = CONN_COLS
    .filter(c => row[c.idx]?.trim().toLowerCase() === 'true')
    .map(c => ({
      id: c.id,
      interface_id: c.id,
      power_kw: powerKw,
      max_power_kw: powerKw,
    }))

  // Payment methods: 1=free, 2=CB, 32=other
  const paymentSet = new Set()
  if (row[COL.GRATUIT]?.trim().toLowerCase() === 'true') paymentSet.add(1)
  if (row[COL.PAIEMENT_CB]?.trim().toLowerCase() === 'true') paymentSet.add(2)
  if (row[COL.PAIEMENT_AUTRE]?.trim().toLowerCase() === 'true') paymentSet.add(32)

  const pdcId = row[COL.PDC_ID]?.trim() || `${stationId}-${i}`
  const point = {
    id: hashId(pdcId),
    connectors,
  }

  pdcCount++

  if (!stationMap.has(stationId)) {
    // Parse address: "street, city" or full string
    const address = row[COL.ADDRESS]?.trim() || ''
    const commune = row[COL.COMMUNE]?.trim() || ''
    const postal = row[COL.POSTAL]?.trim() || ''

    // Derive street from address (remove postal/city suffix if present)
    let street = address
    let streetNumber = ''
    // Try to extract street number: leading digits
    const numMatch = street.match(/^(\d+[\w-]*)\s+(.+)/)
    if (numMatch) { streetNumber = numMatch[1]; street = numMatch[2] }

    stationMap.set(stationId, {
      id: hashId(stationId),
      pool_id: hashId(stationId),
      source: 'fr',
      lat,
      lng,
      city: commune,
      province: '',
      postal_code: postal,
      street,
      street_number: streetNumber,
      operator_id: 0,
      operator_name: row[COL.OPERATOR]?.trim() || '',
      payment_methods: [...paymentSet],
      points: [point],
      connector_interface_ids: [...new Set(connectors.map(c => c.interface_id))],
      connector_names: [...new Set(
        connectors.map(c => CONN_COLS.find(cc => cc.id === c.id)?.name).filter(Boolean)
      )],
      max_power_kw: powerKw,
    })
  } else {
    const st = stationMap.get(stationId)
    st.points.push(point)
    const connIfaceIds = connectors.map(c => c.id)
    st.connector_interface_ids = [...new Set([...st.connector_interface_ids, ...connIfaceIds])]
    st.connector_names = [...new Set([
      ...st.connector_names,
      ...connectors.map(c => CONN_COLS.find(cc => cc.id === c.id)?.name).filter(Boolean),
    ])]
    st.max_power_kw = Math.max(st.max_power_kw, powerKw)
    for (const p of paymentSet) st.payment_methods = [...new Set([...st.payment_methods, p])]
  }
}

const stations = Array.from(stationMap.values())
console.log(`PDCs processed: ${pdcCount}, skipped: ${skipped}`)
console.log(`Stations: ${stations.length}`)

// Simple string → numeric hash (FNV-1a 32-bit, always positive)
function hashId(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  // Prefix with 9 to avoid collisions with EIPA/BNetzA IDs
  return parseInt('9' + (h % 100000000).toString().padStart(8, '0'))
}

const output = {
  stations,
  dictionary: { connector_interface_extra: EXTRA_CONNECTORS },
  source: 'fr',
  generated_at: new Date().toISOString(),
}

fs.mkdirSync(outputDir, { recursive: true })
const outputFile = path.join(outputDir, 'irve.db.json')
const json = JSON.stringify(output, (key, val) => {
  if (val === null) return undefined
  if (Array.isArray(val) && val.length === 0 && ['charging_modes', 'authentication_methods'].includes(key)) return undefined
  return val
})
fs.writeFileSync(outputFile, json)

const sizeMB = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)
console.log(`Done! Output: ${outputFile} (${sizeMB} MB)`)
