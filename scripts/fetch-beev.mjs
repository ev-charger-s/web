#!/usr/bin/env node
// scripts/fetch-beev.mjs
// Fetches Belgian public EV charging locations from road.io (OCPI 2.2.1)
// Source: transportdata.be NAP — "Road Public Charging Network"
// No auth required, public dataset.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { downloadFile } from './lib/download.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(__dirname, '..', 'data', 'beev')
const OUTPUT_FILE = path.join(outputDir, 'locations.json')
const URL = 'https://roaming.road.io/files/9ef09c78-2666-418a-aa45-4f2261e2e305/locations.json?force=true'

fs.mkdirSync(outputDir, { recursive: true })

async function fetchLatest() {
  if (fs.existsSync(OUTPUT_FILE)) {
    const age = Date.now() - fs.statSync(OUTPUT_FILE).mtimeMs
    if (age < 23 * 60 * 60 * 1000) {
      console.log(`Already up to date: locations.json (${(age / 3600000).toFixed(1)}h old)`)
      return
    }
  }

  process.stdout.write(`Downloading from ${URL} ... `)
  await downloadFile(URL, OUTPUT_FILE)
  const sizeKB = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(0)
  console.log(`Done: locations.json (${sizeKB} KB)`)
}

fetchLatest()
  .then(() => console.log('Fetch complete.'))
  .catch(e => { console.error(e.message); process.exit(1) })
