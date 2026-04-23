/**
 * scripts/lib/json-output.mjs
 * Shared helper to serialise a processed DB object to a compact JSON file,
 * stripping null/undefined values and empty arrays for optional fields.
 */

import fs from 'fs'
import path from 'path'

/**
 * JSON.stringify replacer that omits null/undefined values and empty arrays
 * for a known set of optional fields (charging_modes, authentication_methods).
 * @param {string} key
 * @param {unknown} val
 */
function replacer(key, val) {
  if (val === null || val === undefined) return undefined
  if (Array.isArray(val) && val.length === 0 &&
      ['charging_modes', 'authentication_methods'].includes(key)) return undefined
  return val
}

/**
 * Write a processed database object to `public/<filename>`.
 * @param {string}  outputDir  Absolute path to the output directory (public/).
 * @param {string}  filename   Output filename, e.g. 'ndw.db.json'.
 * @param {object}  data       The object to serialise.
 * @returns {string}           Absolute path to the written file.
 */
export function writeDbJson(outputDir, filename, data) {
  fs.mkdirSync(outputDir, { recursive: true })
  const outputFile = path.join(outputDir, filename)
  fs.writeFileSync(outputFile, JSON.stringify(data, replacer))
  const sizeMB = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)
  const count = Array.isArray(data.stations) ? data.stations.length : '?'
  console.log(`Done! Output: ${outputFile} (${sizeMB} MB, ${count} stations)`)
  return outputFile
}
