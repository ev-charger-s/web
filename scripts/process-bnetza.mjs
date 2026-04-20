#!/usr/bin/env node
// scripts/process-bnetza.mjs
// Converts BNetzA Ladesäulenregister CSV → public/bnetza.db.json
// Same ChargerStation format as chargers.db.json, with source: 'de'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data', 'bnetza')
const outputDir = path.join(__dirname, '..', 'public')

// --- Connector mapping: BNetzA text → EIPA interface_id ---
// Negative IDs are new types not present in EIPA dictionary
const CONNECTOR_MAP = {
  'AC Typ 2 Steckdose':                    { id: 10,  name: 'IEC 62196 Type 2' },
  'AC Typ 2 Fahrzeugkupplung':             { id: 17,  name: 'IEC 62196 Type 2 (kabel)' },
  'DC Fahrzeugkupplung Typ Combo 2 (CCS)': { id: 29,  name: 'CCS/Combo 2' },
  'DC CHAdeMO':                            { id: 11,  name: 'CHAdeMO' },
  'AC Typ 1 Steckdose':                    { id: 25,  name: 'IEC 62196 Type 1' },
  'AC Schuko':                             { id: 6,   name: 'Domestic-F (Schuko)' },
  'AC CEE 5-polig':                        { id: -1,  name: 'CEE 5-pin' },
  'DC Tesla Fahrzeugkupplung (Typ 2)':     { id: -2,  name: 'Tesla Type 2' },
  'DC Megawatt Charging System (MCS)':     { id: -3,  name: 'MCS' },
}

// Additional connector entries to inject into dictionary
const EXTRA_CONNECTORS = [
  { id: -1, name: 'CEE-5',   description: 'CEE 5-pin' },
  { id: -2, name: 'TESLA-T2', description: 'Tesla Type 2' },
  { id: -3, name: 'MCS',      description: 'Megawatt Charging System (MCS)' },
]

// Payment method mapping → EIPA station_payment_method IDs
// EIPA: 1=Kostenlos, 2=Karta płatnicza, 4=RFID, 8=SMS, 16=Aplikacja, 32=Inne
const PAYMENT_MAP = {
  'Kostenlos':                 1,
  'RFID-Karte':                4,
  'Onlinezahlungsverfahren':   16,
  'Kreditkarte (NFC)':         2,
  'Kreditkarte (Lesegerät)':   2,
  'Debitkarte (NFC)':          2,
  'Debitkarte (Lesegerät)':    2,
  'Plug & Charge':             32,
  'Bargeld':                   32,
  'Sonstige':                  32,
}

// --- Latin-1 CSV reader (Node has no built-in latin-1 TextDecoder for streams) ---
function readLatin1CSV(filePath) {
  const buf = fs.readFileSync(filePath)
  // Convert latin-1 buffer to string
  let str = ''
  for (let i = 0; i < buf.length; i++) {
    str += String.fromCharCode(buf[i])
  }
  return str
}

function parseCSVLine(line) {
  const fields = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ';' && !inQuotes) {
      fields.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields
}

function parseCSV(content) {
  const rows = []
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    rows.push(parseCSVLine(line))
  }
  return rows
}

// Find latest CSV file
const latestFile = fs.existsSync(path.join(dataDir, 'latest.txt'))
  ? fs.readFileSync(path.join(dataDir, 'latest.txt'), 'utf8').trim()
  : fs.readdirSync(dataDir).find(f => f.endsWith('.csv'))

if (!latestFile) {
  console.error('No BNetzA CSV found in data/bnetza/. Run fetch-bnetza.mjs first.')
  process.exit(1)
}

const csvPath = path.join(dataDir, latestFile)
console.log(`Reading: ${latestFile} ...`)
const content = readLatin1CSV(csvPath)
const rows = parseCSV(content)

// Find header row (contains 'Betreiber')
const headerIdx = rows.findIndex(r => r.includes('Betreiber'))
if (headerIdx === -1) {
  console.error('Could not find header row in CSV')
  process.exit(1)
}

const header = rows[headerIdx]
const dataRows = rows.slice(headerIdx + 1).filter(r => r.length > 10 && r[0].trim())

console.log(`Processing ${dataRows.length} rows...`)

// Column indices
const COL = {
  ID:         header.indexOf('Ladeeinrichtungs-ID'),
  OPERATOR:   header.indexOf('Betreiber'),
  STATUS:     header.indexOf('Status'),
  NUM_POINTS: header.indexOf('Anzahl Ladepunkte'),
  POWER:      header.indexOf('Nennleistung Ladeeinrichtung [kW]'),
  STREET:     header.findIndex(h => h.includes('Stra')),
  HOUSE:      header.indexOf('Hausnummer'),
  POSTAL:     header.indexOf('Postleitzahl'),
  CITY:       header.indexOf('Ort'),
  PROVINCE:   header.indexOf('Bundesland'),
  LAT:        header.findIndex(h => h.includes('Breitengrad')),
  LNG:        header.findIndex(h => h.includes('ngengrad')),
  PAYMENT:    header.indexOf('Bezahlsysteme'),
  // Connector slots: Steckertypen1..6 each 4 cols apart
  CONN_START: header.findIndex(h => h === 'Steckertypen1'),
}

console.log('Column indices:', COL)

function parseConnectors(row) {
  const connectors = []
  for (let slot = 0; slot < 6; slot++) {
    const base = COL.CONN_START + slot * 4
    if (base >= row.length) break
    const typeStr = row[base]?.trim()
    const powerStr = row[base + 1]?.trim()
    if (!typeStr) continue
    // Each slot can contain semicolon-separated types (rare but exists)
    for (const t of typeStr.split(';')) {
      const name = t.trim()
      if (!name) continue
      const mapped = CONNECTOR_MAP[name]
      const power = powerStr ? parseFloat(powerStr.replace(',', '.')) || null : null
      connectors.push({
        id: mapped?.id ?? null,
        interface_id: mapped?.id ?? null,
        power_kw: power,
        max_power_kw: power,
        _raw_type: mapped ? undefined : name, // keep unknown types for debugging
      })
    }
  }
  return connectors
}

function parsePayments(payStr) {
  if (!payStr) return []
  const ids = new Set()
  for (const p of payStr.split(';')) {
    const id = PAYMENT_MAP[p.trim()]
    if (id) ids.add(id)
  }
  return [...ids]
}

// Process all rows into stations
const processedStations = []
let skipped = 0

for (const row of dataRows) {
  const latStr = row[COL.LAT]?.trim().replace(',', '.')
  const lngStr = row[COL.LNG]?.trim().replace(',', '.')
  const lat = parseFloat(latStr)
  const lng = parseFloat(lngStr)
  if (isNaN(lat) || isNaN(lng)) { skipped++; continue }

  const connectors = parseConnectors(row)
  const allIfaceIds = [...new Set(connectors.map(c => c.interface_id).filter(x => x != null))]
  const allConnectorNames = [...new Set(
    connectors.map(c => {
      const m = Object.entries(CONNECTOR_MAP).find(([, v]) => v.id === c.interface_id)
      return m ? m[1].name : c._raw_type
    }).filter(Boolean)
  )]
  const maxPower = connectors.reduce((m, c) => Math.max(m, c.max_power_kw || 0), 0) ||
    (parseFloat(row[COL.POWER]?.replace(',', '.')) || 0)

  // Build one "point" per connector slot (each slot = one EVSE/outlet)
  const points = connectors.map((conn, i) => ({
    id: parseInt(row[COL.ID]) * 10 + i,
    name: null,
    status: null,
    charging_modes: [],
    connectors: [{
      id: conn.interface_id,
      interface_id: conn.interface_id,
      power_kw: conn.power_kw,
      max_power_kw: conn.max_power_kw,
    }],
    price: null,
    price_details: null,
  }))

  processedStations.push({
    id: parseInt(row[COL.ID]),
    pool_id: parseInt(row[COL.ID]), // no pool concept in BNetzA
    source: 'de',
    lat,
    lng,
    city: row[COL.CITY]?.trim() || '',
    province: row[COL.PROVINCE]?.trim() || '',
    postal_code: row[COL.POSTAL]?.trim() || '',
    street: row[COL.STREET]?.trim() || '',
    street_number: row[COL.HOUSE]?.trim() || '',
    operator_id: 0,
    operator_name: row[COL.OPERATOR]?.trim() || '',
    authentication_methods: [],
    payment_methods: parsePayments(row[COL.PAYMENT]),
    points,
    charging_modes: [],
    connector_interface_ids: allIfaceIds,
    connector_names: allConnectorNames,
    max_power_kw: maxPower,
  })
}

console.log(`Processed: ${processedStations.length}, skipped: ${skipped}`)

// Group by exact coordinates
const groupMap = new Map()
for (const station of processedStations) {
  const key = `${station.lat}|${station.lng}`
  if (!groupMap.has(key)) {
    groupMap.set(key, { ...station, points: [...station.points] })
  } else {
    const existing = groupMap.get(key)
    existing.points = [...existing.points, ...station.points]
    existing.connector_interface_ids = [...new Set([...existing.connector_interface_ids, ...station.connector_interface_ids])]
    existing.connector_names = [...new Set([...existing.connector_names, ...station.connector_names])]
    existing.payment_methods = [...new Set([...existing.payment_methods, ...station.payment_methods])]
    existing.max_power_kw = Math.max(existing.max_power_kw, station.max_power_kw)
    if (station.id < existing.id) existing.id = station.id
    // Merge operator names if different
    if (station.operator_name && !existing.operator_name.includes(station.operator_name)) {
      existing.operator_name = existing.operator_name
        ? `${existing.operator_name} / ${station.operator_name}`
        : station.operator_name
    }
  }
}

const groupedStations = Array.from(groupMap.values())
console.log(`Grouped ${processedStations.length} → ${groupedStations.length} unique locations`)

// Build extra dictionary entries for new connector types
const extraDictionary = {
  connector_interface_extra: EXTRA_CONNECTORS,
}

const output = {
  stations: groupedStations,
  dictionary: extraDictionary,
  source: 'de',
  generated_at: new Date().toISOString(),
}

fs.mkdirSync(outputDir, { recursive: true })
const outputFile = path.join(outputDir, 'bnetza.db.json')
// Write minified but strip null values from points to reduce size
const json = JSON.stringify(output, (key, val) => {
  // Drop null fields and empty arrays inside points to shrink output
  if (val === null) return undefined
  if (Array.isArray(val) && val.length === 0 && ['charging_modes', 'authentication_methods'].includes(key)) return undefined
  return val
})
fs.writeFileSync(outputFile, json)

const sizeMB = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)
console.log(`Done! Output: ${outputFile} (${sizeMB} MB)`)
console.log(`Stations: ${groupedStations.length} (from ${processedStations.length})`)
