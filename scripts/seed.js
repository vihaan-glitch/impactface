// Run once: npm run seed
// Fetches real asteroid data from NASA JPL SBDB and writes public/asteroids.json

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Request 1500 — many early entries lack diameter data, so we over-fetch and filter
const params = new URLSearchParams({
  fields: 'full_name,name,pdes,diameter,albedo,spec_T,spec_B,a',
  'sb-kind': 'a',
  limit: '1500',
  'full-prec': 'true',
})

const API_URL = `https://ssd-api.jpl.nasa.gov/sbdb_query.api?${params}`

console.log('Fetching asteroid data from NASA JPL Small-Body Database...')

const res = await fetch(API_URL)
if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)

const json = await res.json()
const fields = json.fields

// Helper: get a value from a raw data row by field name (values arrive as strings)
const get = (row, fieldName) => row[fields.indexOf(fieldName)]
const num = (v) => (v === null || v === '' ? NaN : parseFloat(v))

const DENSITY_KG_PER_M3 = 1500 // typical rocky asteroid density

const asteroids = json.data
  .map(row => {
    const diameterKm = num(get(row, 'diameter'))
    const albedo     = num(get(row, 'albedo'))
    const a          = num(get(row, 'a'))

    // Prefer the short IAU name, fall back to full designation, then pdes
    const rawName = (get(row, 'name') || get(row, 'full_name') || get(row, 'pdes') || '').trim()

    // Mass estimated from diameter assuming solid sphere + mean rocky density
    const radiusM  = (diameterKm * 1000) / 2
    const volumeM3 = (4 / 3) * Math.PI * radiusM ** 3
    const massKg   = volumeM3 * DENSITY_KG_PER_M3

    return {
      id:              (get(row, 'pdes') || '').trim(),
      name:            rawName,
      diameterKm,
      massKg,
      albedo:          isNaN(albedo) ? 0.15 : albedo,
      spectralClass:   get(row, 'spec_T') || get(row, 'spec_B') || 'S',
      semiMajorAxisAU: isNaN(a) ? 2.5 : a,
    }
  })
  .filter(a => !isNaN(a.diameterKm) && a.diameterKm > 0 && a.name.length > 0)

console.log(`Kept ${asteroids.length} asteroids with usable data (from ${json.data.length} fetched)`)

console.log('\nSample (first 3):')
asteroids.slice(0, 3).forEach(a => console.log(JSON.stringify(a)))

const outPath = join(__dirname, '..', 'public', 'asteroids.json')
writeFileSync(outPath, JSON.stringify(asteroids, null, 2))
console.log(`\nSaved → ${outPath}`)
