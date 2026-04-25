#!/usr/bin/env node
// scripts/process-beev.mjs
// Converts road.io OCPI 2.2.1 JSON → public/beev.db.json
// Same ChargerStation format as eipa.db.json, with source: 'be'
//
// Input: data/beev/locations.json
// Format: OCPI 2.2.1 Location objects (one location = one station)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { EXTRA_CONNECTORS, mapConnector, powerKw, hashId } from './lib/ocpi-connectors.mjs'
import { writeDbJson } from './lib/json-output.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inputFile = path.join(__dirname, '..', 'data', 'beev', 'locations.json')
const outputDir = path.join(__dirname, '..', 'public')

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
      // process-beev passes connector as both evse+connector args; powerKw uses connector.max_electric_power
      const kw = powerKw(c, c)
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
      id: hashId((evse.uid || evse.evse_id || '') + '-pt', 7),
      connectors,
    })
  }

  const street = (loc.address || '').trim()

  stations.push({
    id: hashId('BE|' + (loc.party_id || '') + '|' + (loc.id || ''), 7),
    pool_id: hashId('BE|' + (loc.party_id || '') + '|' + (loc.id || ''), 7),
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

writeDbJson(outputDir, 'beev.db.json', {
  stations,
  dictionary: { connector_interface_extra: EXTRA_CONNECTORS },
  source: 'be',
  generated_at: new Date().toISOString(),
})
