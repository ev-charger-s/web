#!/usr/bin/env node
// scripts/fetch-irve.mjs
// Fetches the latest IRVE (Base nationale des IRVE) CSV from data.gouv.fr
// and saves to data/irve/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { downloadFile, httpsGet } from './lib/download.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(__dirname, '..', 'data', 'irve')
const DATASET_ID = 'fichier-consolide-des-bornes-de-recharge-pour-vehicules-electriques'
const API_URL = `https://www.data.gouv.fr/api/1/datasets/${DATASET_ID}/`
const LATEST_FILE = path.join(outputDir, 'latest.txt')

fs.mkdirSync(outputDir, { recursive: true })

async function fetchLatest() {
  console.log('Fetching IRVE dataset metadata from data.gouv.fr...')
  const meta = JSON.parse(await httpsGet(API_URL))

  // Find the most recent CSV resource — prefer "consolidation de la dernière version"
  const csvResources = meta.resources
    .filter(r => r.format === 'csv' && r.url && r.url.includes('consolidation-etalab-schema-irve-statique'))
    .sort((a, b) => new Date(b.last_modified ?? b.created_at) - new Date(a.last_modified ?? a.created_at))

  if (!csvResources.length) throw new Error('No IRVE CSV resource found in dataset')

  const resource = csvResources[0]
  const filename = path.basename(new URL(resource.url).pathname)
  const dest = path.join(outputDir, filename)

  console.log(`Latest resource: ${resource.title}`)
  console.log(`URL: ${resource.url}`)

  if (fs.existsSync(dest)) {
    console.log(`Already up to date: ${filename}`)
    fs.writeFileSync(LATEST_FILE, filename)
    return filename
  }

  process.stdout.write(`Downloading: ${filename} ... `)
  await downloadFile(resource.url, dest)
  console.log(`Downloaded: ${filename}`)

  // Remove old CSV files
  const old = fs.readdirSync(outputDir).filter(f => f.endsWith('.csv') && f !== filename)
  for (const f of old) {
    fs.unlinkSync(path.join(outputDir, f))
    console.log(`Removed old: ${f}`)
  }

  fs.writeFileSync(LATEST_FILE, filename)
  return filename
}

fetchLatest()
  .then(f => console.log(`Done: ${f}`))
  .catch(e => { console.error(e.message); process.exit(1) })
