/**
 * scripts/lib/download.mjs
 * Shared HTTP download utilities for fetch scripts.
 */

import fs from 'fs'
import https from 'https'
import zlib from 'zlib'

const UA = { 'User-Agent': 'ev-charger-map/1.0' }

/**
 * Download a URL to a local file with redirect following and progress reporting.
 * @param {string} url
 * @param {string} dest  Local file path to write to.
 * @returns {Promise<void>}
 */
export function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, { headers: UA }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        fs.unlinkSync(dest)
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      let downloaded = 0
      res.on('data', (chunk) => {
        downloaded += chunk.length
        process.stdout.write(`\r  Downloaded: ${(downloaded / 1024 / 1024).toFixed(1)} MB`)
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

/**
 * Download a gzip-compressed URL to a local file, decompressing on the fly.
 * @param {string} url
 * @param {string} dest  Local file path to write decompressed content to.
 * @returns {Promise<void>}
 */
export function downloadAndDecompress(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, { headers: UA }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        fs.unlinkSync(dest)
        return downloadAndDecompress(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
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

/**
 * Perform an HTTPS GET and return the response body as a string.
 * Follows redirects automatically.
 * @param {string} url
 * @returns {Promise<string>}
 */
export function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: UA }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString()
        return httpsGet(next).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}
