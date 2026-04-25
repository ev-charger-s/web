#!/usr/bin/env node
// scripts/process-ndw.mjs
// Converts NDW OCPI JSON → public/ndw.db.json
// Same ChargerStation format as eipa.db.json, with source: 'nl'
//
// Input: data/ndw/charging_point_locations_ocpi.json
// Format: OCPI 2.x Location objects (one location = one station)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { EXTRA_CONNECTORS, mapConnector, powerKw, hashId } from './lib/ocpi-connectors.mjs'
import { writeDbJson } from './lib/json-output.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inputFile = path.join(__dirname, '..', 'data', 'ndw', 'charging_point_locations_ocpi.json')
const outputDir = path.join(__dirname, '..', 'public')

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
      id: hashId(evse.uid || evse.evse_id || String(Math.random()), 8),
      connectors,
    })
  }

  // Parse address — strip postal code from address if it appears there
  const street = (loc.address || '').trim()
  const streetNumMatch = street.match(/^(\d+[\w-]*)\s+(.+)/)
  const streetName = streetNumMatch ? streetNumMatch[2] : street
  const streetNum  = streetNumMatch ? streetNumMatch[1] : ''

  stations.push({
    id: hashId(loc.party_id + '|' + loc.id, 8),
    pool_id: hashId(loc.party_id + '|' + loc.id, 8),
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

writeDbJson(outputDir, 'ndw.db.json', {
  stations,
  dictionary: { connector_interface_extra: EXTRA_CONNECTORS },
  source: 'nl',
  generated_at: new Date().toISOString(),
})
