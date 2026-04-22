#!/usr/bin/env node
// scripts/fetch-ndw.mjs
// Fetches the NDW charging point locations OCPI JSON from opendata.ndw.nu
// File: charging_point_locations_ocpi.json.gz (no auth required)

import fs from 'fs'
import path from 'path'
import https from 'https'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(__dirname, '..', 'data', 'ndw')
const OUTPUT_FILE = path.join(outputDir, 'charging_point_locations_ocpi.json')
const URL = 'https://opendata.ndw.nu/charging_point_locations_ocpi.json.gz'

fs.mkdirSync(outputDir, { recursive: true })

function downloadAndDecompress(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, { headers: { 'User-Agent': 'ev-charger-map/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        fs.unlinkSync(dest)
        return downloadAndDecompress(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      let downloaded = 0
      const gunzip = zlib.createGunzip()
      res.on('data', (chunk) => {
        downloaded += chunk.length
        process.stdout.write(`\r  Downloaded (compressed): ${(downloaded / 1024 / 1024).toFixed(1)} MB`)
      })
      res.pipe(gunzip).pipe(file)
      file.on('finish', () => { file.close(); console.log(''); resolve() })
      gunzip.on('error', (err) => {
        file.close()
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        reject(err)
      })
    }).on('error', (err) => {
      file.close()
      if (fs.existsSync(dest)) fs.unlinkSync(dest)
      reject(err)
    })
  })
}

async function fetchLatest() {
  // Check if file exists and is recent (< 23 hours old) to avoid redundant downloads
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
