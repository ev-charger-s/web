/**
 * scripts/lib/ocpi-connectors.mjs
 * Shared OCPI connector standard → EIPA interface_id mapping.
 * Used by process-ndw.mjs and process-beev.mjs.
 *
 * Negative IDs represent connector types not present in the EIPA dictionary;
 * they are passed through in connector_interface_extra so the UI can resolve them.
 */

/** @type {Record<string, {id?: number, name?: string, socket?: number, cable?: number, name_socket?: string, name_cable?: string}>} */
export const STANDARD_MAP = {
  'IEC_62196_T2':        { socket: 10, cable: 17, name_socket: 'IEC 62196 Type 2', name_cable: 'IEC 62196 Type 2 (kabel)' },
  'IEC_62196_T2_COMBO':  { id: 29,  name: 'CCS/Combo 2' },
  'CHADEMO':             { id: 11,  name: 'CHAdeMO' },
  'IEC_62196_T1':        { id: 25,  name: 'IEC 62196 Type 1' },
  'IEC_62196_T1_COMBO':  { id: -7,  name: 'CCS/Combo 1' },
  'IEC_62196_T3C':       { id: -6,  name: 'IEC 62196 Type 3C (Scame)' },
  'DOMESTIC_F':          { id: 6,   name: 'Domestic-F (Schuko)' },
  'DOMESTIC_E':          { id: 6,   name: 'Domestic-F (Schuko)' },
  'TESLA_S':             { id: -2,  name: 'Tesla Type 2' },
}

/**
 * Extra connector entries to include in dictionary.connector_interface_extra.
 * These cover IDs < 0 that are not in the base EIPA dictionary.
 */
export const EXTRA_CONNECTORS = [
  { id: -2, name: 'TESLA-T2', description: 'Tesla Type 2' },
  { id: -6, name: 'TYPE-3C',  description: 'IEC 62196 Type 3C (Scame)' },
  { id: -7, name: 'CCS1',     description: 'CCS/Combo 1 (Type 1 + DC)' },
]

/**
 * Map an OCPI connector standard + format to an EIPA interface_id and name.
 * @param {string} standard  OCPI standard string, e.g. 'IEC_62196_T2'
 * @param {string} format    OCPI format string, e.g. 'CABLE' or 'SOCKET'
 * @returns {{ id: number|null, name: string }}
 */
export function mapConnector(standard, format) {
  const entry = STANDARD_MAP[standard]
  if (!entry) return { id: null, name: standard || 'Unknown' }
  if (standard === 'IEC_62196_T2') {
    if (format === 'CABLE') return { id: entry.cable, name: entry.name_cable }
    return { id: entry.socket, name: entry.name_socket }
  }
  return { id: entry.id, name: entry.name }
}

/**
 * Compute connector power in kW from OCPI EVSE/connector objects.
 * OCPI max_electric_power is in watts; falls back to V * A.
 * @param {object} evse
 * @param {object} connector
 * @returns {number}  kW, 0 if unknown
 */
export function powerKw(evse, connector) {
  if (connector.max_electric_power) return connector.max_electric_power / 1000
  if (connector.max_voltage && connector.max_amperage) {
    return (connector.max_voltage * connector.max_amperage) / 1000
  }
  return 0
}

/**
 * FNV-1a 32-bit hash → positive integer with a given numeric prefix.
 * The prefix disambiguates IDs across country sources.
 *
 * Prefixes in use:
 *   PL  — native EIPA IDs (no prefix)
 *   DE  — no prefix (BNetzA IDs from coordinates hash, distinct range)
 *   FR  — 9
 *   NL  — 8
 *   BE  — 7
 *
 * @param {string} str
 * @param {number} prefix  Single-digit prefix (1-9)
 * @returns {number}
 */
export function hashId(str, prefix) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return parseInt(String(prefix) + (h % 100000000).toString().padStart(8, '0'))
}
