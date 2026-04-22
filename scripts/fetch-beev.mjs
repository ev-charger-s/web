#!/usr/bin/env node
// scripts/fetch-beev.mjs
// Fetches Belgian public EV charging locations from road.io (OCPI 2.2.1)
// Source: transportdata.be NAP — "Road Public Charging Network"
// URL: https://roaming.road.io/files/9ef09c78-2666-418a-aa45-4f2261e2e305/locations.json
// No auth required, public dataset.

import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(__dirname, '..', 'data', 'beev')
const OUTPUT_FILE = path.join(outputDir, 'locations.json')
const URL = 'https://roaming.road.io/files/9ef09c78-2666-418a-aa45-4f2261e2e305/locations.json?force=true'

fs.mkdirSync(outputDir, { recursive: true })

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, { headers: { 'User-Agent': 'ev-charger-map/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        fs.unlinkSync(dest)
        return download(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      let downloaded = 0
      res.on('data', (chunk) => {
        downloaded += chunk.length
        process.stdout.write(`\r  Downloaded: ${(downloaded / 1024).toFixed(0)} KB`)
      })
      res.pipe(file)
      file.on('finish', () => { file.close(); console.log(''); resolve() })
    }).on('error', (err) => {
      file.close()
      if (fs.existsSync(dest)) fs.unlinkSync(dest)
      reject(err)
    })
  })
}

async function fetchLatest() {
  if (fs.existsSync(OUTPUT_FILE)) {
    const age = Date.now() - fs.statSync(OUTPUT_FILE).mtimeMs
    if (age < 23 * 60 * 60 * 1000) {
      console.log(`Already up to date: locations.json (${(age / 3600000).toFixed(1)}h old)`)
      return
    }
  }

  process.stdout.write(`Downloading from ${URL} ... `)
  await download(URL, OUTPUT_FILE)
  const sizeKB = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(0)
  console.log(`Done: locations.json (${sizeKB} KB)`)
}

fetchLatest()
  .then(() => console.log('Fetch complete.'))
  .catch(e => { console.error(e.message); process.exit(1) })
