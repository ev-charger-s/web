#!/usr/bin/env node
/**
 * scripts/update.mjs
 *
 * Unified data update script. Fetches and processes one or more country
 * data sources, then writes the corresponding public/*.db.json files.
 *
 * Usage:
 *   node scripts/update.mjs --all          # all sources
 *   node scripts/update.mjs --eipa         # Poland (EIPA) — requires EIPA_TOKEN env var
 *   node scripts/update.mjs --bnetza       # Germany (BNetzA)
 *   node scripts/update.mjs --irve         # France (IRVE)
 *   node scripts/update.mjs --ndw          # Netherlands (NDW)
 *   node scripts/update.mjs --beev         # Belgium (road.io)
 *
 *   Multiple flags can be combined:
 *   node scripts/update.mjs --bnetza --irve --ndw
 *
 * npm run shortcuts (defined in package.json):
 *   npm run update            # --all
 *   npm run update:eipa       # --eipa
 *   npm run update:bnetza     # --bnetza
 *   npm run update:irve       # --irve
 *   npm run update:ndw        # --ndw
 *   npm run update:beev       # --beev
 */

import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Source definitions ────────────────────────────────────────────────────────

const SOURCES = {
  eipa: {
    label: '🇵🇱 EIPA (Poland)',
    fetch: null,           // EIPA fetch is handled inline by the GH Action via curl; locally use process only
    process: 'process-eipa.mjs',
    note: 'Requires EIPA_TOKEN env var and pre-fetched data/ files. Run fetch-eipa manually if needed.',
  },
  bnetza: {
    label: '🇩🇪 BNetzA (Germany)',
    fetch: 'fetch-bnetza.mjs',
    process: 'process-bnetza.mjs',
  },
  irve: {
    label: '🇫🇷 IRVE (France)',
    fetch: 'fetch-irve.mjs',
    process: 'process-irve.mjs',
  },
  ndw: {
    label: '🇳🇱 NDW (Netherlands)',
    fetch: 'fetch-ndw.mjs',
    process: 'process-ndw.mjs',
  },
  beev: {
    label: '🇧🇪 BEEV (Belgium)',
    fetch: 'fetch-beev.mjs',
    process: 'process-beev.mjs',
  },
}

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2)

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node scripts/update.mjs [flags]

Flags:
  --all       Update all sources
  --eipa      🇵🇱 Poland (EIPA)   — requires pre-fetched data/ files
  --bnetza    🇩🇪 Germany (BNetzA)
  --irve      🇫🇷 France (IRVE)
  --ndw       🇳🇱 Netherlands (NDW)
  --beev      🇧🇪 Belgium (BEEV / road.io)
  --help      Show this help

Multiple flags can be combined: --bnetza --irve --ndw
`)
  process.exit(0)
}

const selectedKeys = args.includes('--all')
  ? Object.keys(SOURCES)
  : Object.keys(SOURCES).filter((key) => args.includes(`--${key}`))

const unknown = args.filter((a) => a !== '--all' && !Object.keys(SOURCES).some((k) => `--${k}` === a))
if (unknown.length > 0) {
  console.error(`Unknown flag(s): ${unknown.join(', ')}`)
  console.error('Run with --help to see available options.')
  process.exit(1)
}

if (selectedKeys.length === 0) {
  console.error('No valid source selected. Run with --help to see available options.')
  process.exit(1)
}

// ── Runner ────────────────────────────────────────────────────────────────────

function runScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName)
  console.log(`\n  → node scripts/${scriptName}`)
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error(`scripts/${scriptName} exited with code ${result.status}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const errors = []

for (const key of selectedKeys) {
  const src = SOURCES[key]
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`${src.label}`)
  if (src.note) console.log(`  ℹ  ${src.note}`)
  console.log('─'.repeat(60))

  try {
    if (src.fetch) runScript(src.fetch)
    runScript(src.process)
    console.log(`✓ ${src.label} done`)
  } catch (e) {
    console.error(`✗ ${src.label} FAILED: ${e.message}`)
    errors.push(`${src.label}: ${e.message}`)
  }
}

console.log(`\n${'═'.repeat(60)}`)
if (errors.length === 0) {
  console.log(`✓ All done (${selectedKeys.length} source${selectedKeys.length > 1 ? 's' : ''} updated)`)
} else {
  console.error(`✗ ${errors.length} source(s) failed:`)
  for (const e of errors) console.error(`  • ${e}`)
  process.exit(1)
}
