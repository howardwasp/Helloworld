/**
 * Pull CORS-safe public feeds into public/data/live/ so GitHub Pages can
 * serve a snapshot when a browser fetch fails (e.g. NHC has no CORS header).
 *
 * USGS and NWS are public-domain U.S. government works.
 * Run: node scripts/refresh-live-data.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/data/live')
const ua = 'SignalMap/0.1 (+https://github.com/howardwasp/Helloworld)'

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers: { 'User-Agent': ua, ...headers } })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.json()
}

const start = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&minmagnitude=4.5&orderby=time&limit=400`

const [usgs, nws, storms] = await Promise.all([
  getJson(usgsUrl),
  getJson('https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe,Moderate', {
    Accept: 'application/geo+json',
  }),
  getJson('https://www.nhc.noaa.gov/CurrentStorms.json').catch(() => ({ activeStorms: [] })),
])

await mkdir(outDir, { recursive: true })
await writeFile(join(outDir, 'earthquakes.geojson'), JSON.stringify(usgs))
await writeFile(join(outDir, 'weather-alerts.geojson'), JSON.stringify(nws))
await writeFile(join(outDir, 'storms.json'), JSON.stringify(storms))
await writeFile(
  join(outDir, 'sources.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sources: [
        {
          id: 'natural',
          provider: 'USGS Earthquake Hazards Program',
          url: 'https://earthquake.usgs.gov/fdsnws/event/1/',
          license: 'U.S. public domain',
          count: Array.isArray(usgs.features) ? usgs.features.length : 0,
        },
        {
          id: 'weather',
          provider: 'National Weather Service',
          url: 'https://api.weather.gov/alerts/active',
          license: 'U.S. public domain',
          count: Array.isArray(nws.features) ? nws.features.length : 0,
        },
        {
          id: 'storms',
          provider: 'National Hurricane Center',
          url: 'https://www.nhc.noaa.gov/CurrentStorms.json',
          license: 'U.S. public domain',
          count: Array.isArray(storms.activeStorms) ? storms.activeStorms.length : 0,
        },
      ],
    },
    null,
    2,
  )}\n`,
)

console.log(
  `Wrote snapshots: ${usgs.features?.length ?? 0} quakes, ${nws.features?.length ?? 0} alerts, ${storms.activeStorms?.length ?? 0} storms`,
)
