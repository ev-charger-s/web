#!/usr/bin/env node
// scripts/fetch-bnetza.mjs
// Fetches the latest BNetzA Ladesäulenregister CSV and saves to data/bnetza/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { downloadFile } from './lib/download.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(__dirname, '..', 'data', 'bnetza')

fs.mkdirSync(outputDir, { recursive: true })

// BNetzA publishes the file with the date in the filename.
// We try today and the past 60 days to find the latest available file.
function getCandidateUrls() {
  const base = 'https://data.bundesnetzagentur.de/Bundesnetzagentur/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet'
  const urls = []
  const now = new Date()
  for (let i = 0; i < 60; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    urls.push(`${base}/Ladesaeulenregister_BNetzA_${yyyy}-${mm}-${dd}.csv`)
  }
  return urls
}

async function fetchLatest() {
  const candidates = getCandidateUrls()
  for (const url of candidates) {
    const filename = path.basename(url)
    const dest = path.join(outputDir, filename)

    if (fs.existsSync(dest)) {
      console.log(`Already up to date: ${filename}`)
      fs.writeFileSync(path.join(outputDir, 'latest.txt'), filename)
      return filename
    }

    process.stdout.write(`Trying: ${filename} ... `)
    try {
      await downloadFile(url, dest)
      console.log(`Downloaded: ${filename}`)
      // Remove old CSV files
      const old = fs.readdirSync(outputDir).filter(f => f.endsWith('.csv') && f !== filename)
      for (const f of old) {
        fs.unlinkSync(path.join(outputDir, f))
        console.log(`Removed old: ${f}`)
      }
      fs.writeFileSync(path.join(outputDir, 'latest.txt'), filename)
      return filename
    } catch (e) {
      console.log(`not found (${e.message})`)
    }
  }
  throw new Error('Could not find any BNetzA CSV file in the last 60 days')
}

fetchLatest()
  .then(f => console.log(`Done: ${f}`))
  .catch(e => { console.error(e.message); process.exit(1) })
