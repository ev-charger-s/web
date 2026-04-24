#!/usr/bin/env node
// scripts/fetch-ndw.mjs
// Fetches the NDW charging point locations OCPI JSON from opendata.ndw.nu
// File: charging_point_locations_ocpi.json.gz (no auth required)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { downloadAndDecompress } from './lib/download.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(__dirname, '..', 'data', 'ndw')
const OUTPUT_FILE = path.join(outputDir, 'charging_point_locations_ocpi.json')
const URL = 'https://opendata.ndw.nu/charging_point_locations_ocpi.json.gz'

fs.mkdirSync(outputDir, { recursive: true })

async function fetchLatest() {
  if (fs.existsSync(OUTPUT_FILE)) {
    const age = Date.now() - fs.statSync(OUTPUT_FILE).mtimeMs
    if (age < 23 * 60 * 60 * 1000) {
      console.log(`Already up to date: charging_point_locations_ocpi.json (${(age / 3600000).toFixed(1)}h old)`)
      return
    }
  }

  process.stdout.write(`Downloading and decompressing from ${URL} ... `)
  await downloadAndDecompress(URL, OUTPUT_FILE)
  const sizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1)
  console.log(`Done: charging_point_locations_ocpi.json (${sizeMB} MB decompressed)`)
}

fetchLatest()
  .then(() => console.log('Fetch complete.'))
  .catch(e => { console.error(e.message); process.exit(1) })
