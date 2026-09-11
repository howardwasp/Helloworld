/**
 * Pull public feeds into public/data/live/ so GitHub Pages can serve a
 * snapshot when a browser fetch fails (CORS, rate limits, or a down API).
 *
 * USGS / NWS / NHC / OFAC SDN: U.S. public domain.
 * GDELT: news-mention events (attribution required; not redistributing the full DB).
 * IODA: Georgia Tech outage detections (attribution required).
 * Open-Meteo is fetched live in the browser (CC BY 4.0).
 *
 * Run: node scripts/refresh-live-data.mjs
 */
import { inflateRawSync } from 'node:zlib'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

async function getBuffer(url) {
  const response = await fetch(url, { headers: { 'User-Agent': ua } })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

async function getText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': ua }, redirect: 'follow' })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.text()
}

function unzipFirst(buf) {
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('not zip')
  const method = buf.readUInt16LE(8)
  const compSize = buf.readUInt32LE(18)
  const nameLen = buf.readUInt16LE(26)
  const extraLen = buf.readUInt16LE(28)
  const start = 30 + nameLen + extraLen
  const compressed = buf.subarray(start, start + compSize)
  if (method === 0) return compressed.toString('utf8')
  if (method === 8) return inflateRawSync(compressed).toString('utf8')
  throw new Error(`zip method ${method}`)
}

function parseGdeltStamp(value) {
  if (!value) return null
  if (/^\d{14}$/.test(value)) {
    return new Date(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}Z`,
    )
  }
  if (/^\d{8}$/.test(value)) {
    return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`)
  }
  return null
}

function gdeltStamps(now = Date.now()) {
  const stamps = new Set()
  const add = (t) => {
    const step = 15 * 60_000
    const aligned = Math.floor(t / step) * step
    const d = new Date(aligned)
    const stamp = [
      d.getUTCFullYear(),
      String(d.getUTCMonth() + 1).padStart(2, '0'),
      String(d.getUTCDate()).padStart(2, '0'),
      String(d.getUTCHours()).padStart(2, '0'),
      String(d.getUTCMinutes()).padStart(2, '0'),
      '00',
    ].join('')
    stamps.add(stamp)
  }
  const latest = now - 20 * 60_000
  for (let t = latest; t >= now - 24 * 3600_000; t -= 30 * 60_000) add(t)
  for (let t = now - 24 * 3600_000; t >= now - 7 * 24 * 3600_000; t -= 6 * 3600_000) add(t)
  return [...stamps]
}

const WATCH_PLACE =
  /ukraine|israel|gaza|west bank|palestine|yemen|syria|iran|iraq|sudan|myanmar|haiti|mali|burkina|niger\b|libya|lebanon|afghanistan|pakistan|somalia|congo|ethiopia|russia|taiwan|korea|venezuela|armenia|azerbaijan|belarus|sahel|khartoum|donbas|kyiv|tehran|sanaa|rafah|port-au-prince|houthis|hezbollah|hamas/i
const WAR_WORDS =
  /airstrike|air strike|artillery|missile|rocket|offensive|invasion|bombard|drone strike|ceasefire|shelling|warplane|fighter jet|armed group|militia|insurgent|front.?line|occupied|killed in (a )?strike|clash with/i

function keepConflict(parts) {
  const root = parts[28]
  if (!['14', '18', '19', '20'].includes(root)) return false
  const lat = Number(parts[56])
  const lon = Number(parts[57])
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return false
  const mentions = Number(parts[31] || 0)
  const url = parts[60] ?? ''
  const name = parts[52] ?? ''
  const actor = `${parts[6] ?? ''} ${parts[16] ?? ''}`
  const hay = `${name} ${url} ${actor}`
  if (/september-11|9\/11|911-fake|pentagon-flag|remembering-911|x-men|prnewswire|comicbook/i.test(url)) return false
  const watch = WATCH_PLACE.test(hay)
  const war = WAR_WORDS.test(hay)
  const typed = /^(MIL|REB|INS|SEP)/.test(parts[12] ?? '')
  if (root === '14' && !(watch && mentions >= 10)) return false
  if (watch || war || typed) return mentions >= 2
  return false
}

const ROOT_LABEL = { 14: 'Protest', 18: 'Assault', 19: 'Armed clash', 20: 'Mass violence' }

function severityFor(root, mentions) {
  if (root === '20' || mentions >= 40) return 'critical'
  if (root === '19' && mentions >= 10) return 'high'
  if (root === '19' || root === '18') return 'elevated'
  return 'watch'
}

function parseGdeltExport(tsv) {
  const events = []
  const seen = new Set()
  for (const line of tsv.split(/\r?\n/)) {
    if (!line) continue
    const parts = line.split('\t')
    if (parts.length < 61 || !keepConflict(parts)) continue
    const lat = Number(parts[56])
    const lon = Number(parts[57])
    const root = parts[28]
    const mentions = Number(parts[31] || 0)
    const goldstein = Number(parts[30] || 0)
    const fullName = parts[52] || ''
    const country = fullName.split(',').map((p) => p.trim()).filter(Boolean).at(-1)
    const added = parseGdeltStamp(parts[59]) ?? parseGdeltStamp(parts[1]) ?? new Date()
    const place = fullName.split(',').map((p) => p.trim()).filter(Boolean)[0] || country || 'Unknown location'
    const label = ROOT_LABEL[root] ?? 'Conflict'
    const actor = (parts[6] || '').replace(/_/g, ' ').trim()
    const key = `${root}|${lat.toFixed(2)}|${lon.toFixed(2)}|${(parts[60] ?? '').slice(0, 80)}`
    if (seen.has(key)) continue
    seen.add(key)
    events.push({
      id: `gdelt-${parts[0]}`,
      title: `${label} — ${place}`.slice(0, 120),
      description: `GDELT CAMEO ${root} (${label.toLowerCase()}) near ${fullName || place}. ${mentions} mentions, Goldstein ${goldstein || '—'}.${actor ? ` Actor: ${actor}.` : ''} News-mention event, not a verified incident.`.slice(0, 420),
      severity: severityFor(root, mentions),
      occurredAt: added.toISOString(),
      longitude: lon,
      latitude: lat,
      country,
      label: label.split(' ')[0].slice(0, 8),
      url: parts[60] || undefined,
      source: 'GDELT',
    })
  }
  return events
}

function clusterHotspots(events) {
  const cell = 3
  const buckets = new Map()
  for (const event of events) {
    const key = `${Math.round(event.latitude / cell)}:${Math.round(event.longitude / cell)}`
    const list = buckets.get(key)
    if (list) list.push(event)
    else buckets.set(key, [event])
  }
  return [...buckets.values()]
    .filter((group) => group.length >= 3)
    .sort((a, b) => b.length - a.length)
    .slice(0, 16)
    .map((group, index) => {
      const lon = group.reduce((s, e) => s + e.longitude, 0) / group.length
      const lat = group.reduce((s, e) => s + e.latitude, 0) / group.length
      const latest = group.reduce((best, e) => (e.occurredAt > best.occurredAt ? e : best))
      const place = latest.country ?? latest.title
      const sev = group.some((e) => e.severity === 'critical')
        ? 'critical'
        : group.some((e) => e.severity === 'high')
          ? 'high'
          : 'elevated'
      return {
        id: `hot-${index}`,
        title: `Hotspot — ${place}`,
        description: `${group.length} recent GDELT conflict/news mentions clustered here.`,
        severity: sev,
        occurredAt: latest.occurredAt,
        longitude: lon,
        latitude: lat,
        country: latest.country,
        label: String(group.length),
        url: latest.url,
        source: 'GDELT cluster',
      }
    })
}

function clusterPolygons(events) {
  const cell = 2.4
  const buckets = new Map()
  for (const event of events) {
    const key = `${Math.round(event.latitude / cell)}:${Math.round(event.longitude / cell)}`
    const list = buckets.get(key)
    if (list) list.push(event)
    else buckets.set(key, [event])
  }
  return [...buckets.values()]
    .filter((group) => group.length >= 4)
    .sort((a, b) => b.length - a.length)
    .slice(0, 10)
    .map((group, index) => {
      const lons = group.map((e) => e.longitude)
      const lats = group.map((e) => e.latitude)
      const pad = 0.7
      const minLon = Math.min(...lons) - pad
      const maxLon = Math.max(...lons) + pad
      const minLat = Math.min(...lats) - pad
      const maxLat = Math.max(...lats) + pad
      const latest = group.reduce((best, e) => (e.occurredAt > best.occurredAt ? e : best))
      return {
        id: `gdelt-cluster-${index}`,
        title: `Conflict cluster — ${latest.country ?? latest.title}`,
        description: `${group.length} GDELT conflict mentions clustered in this box. Density overlay, not a front line.`,
        severity: latest.severity,
        occurredAt: latest.occurredAt,
        country: latest.country,
        source: 'GDELT',
        rings: [[[minLon, maxLat], [maxLon, maxLat], [maxLon, minLat], [minLon, minLat], [minLon, maxLat]]],
      }
    })
}

async function refreshGdelt() {
  let stamps = gdeltStamps()
  try {
    const listing = await getText('https://data.gdeltproject.org/gdeltv2/lastupdate.txt')
    const latest = listing.match(/(\d{14})\.export\.CSV\.zip/)?.[1]
    if (latest) stamps = [latest, ...stamps.filter((s) => s !== latest)]
  } catch {
    // constructed stamps still work
  }
  const events = []
  const concurrency = 5
  for (let i = 0; i < stamps.length; i += concurrency) {
    const chunk = stamps.slice(i, i + concurrency)
    const parts = await Promise.all(
      chunk.map(async (stamp) => {
        try {
          const buf = await getBuffer(`https://data.gdeltproject.org/gdeltv2/${stamp}.export.CSV.zip`)
          return parseGdeltExport(unzipFirst(buf))
        } catch {
          return []
        }
      }),
    )
    events.push(...parts.flat())
  }
  const rank = { critical: 0, high: 1, elevated: 2, watch: 3, info: 4 }
  const unique = []
  const seen = new Set()
  for (const event of events.sort((a, b) => rank[a.severity] - rank[b.severity] || b.occurredAt.localeCompare(a.occurredAt))) {
    if (seen.has(event.id)) continue
    seen.add(event.id)
    unique.push(event)
    if (unique.length >= 220) break
  }
  return unique
}

function parseCsv(text) {
  const rows = []
  let field = ''
  let row = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (c === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }
    if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((cell) => cell && cell !== '-0-')) rows.push(row)
      field = ''
      row = []
      continue
    }
    field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function cleanCell(value) {
  const v = (value ?? '').trim()
  return v === '-0-' ? '' : v
}

const PROGRAM_COUNTRY = [
  [/CUBA/, 'Cuba'],
  [/IRAN/, 'Iran'],
  [/SYRIA/, 'Syria'],
  [/NORTH KOREA|DPRK|NKOREA/, 'North Korea'],
  [/BELARUS/, 'Belarus'],
  [/RUSSIA|UKRAINE-EO/, 'Russia'],
  [/VENEZUELA/, 'Venezuela'],
  [/BURMA|MYANMAR/, 'Myanmar'],
  [/NICARAGUA/, 'Nicaragua'],
  [/MALI/, 'Mali'],
  [/ETHIOPIA/, 'Ethiopia'],
  [/SUDAN/, 'Sudan'],
  [/SOMALIA/, 'Somalia'],
  [/YEMEN/, 'Yemen'],
  [/ZIMBABWE/, 'Zimbabwe'],
  [/LIBYA/, 'Libya'],
  [/IRAQ/, 'Iraq'],
  [/LEBANON/, 'Lebanon'],
  [/AFGHAN/, 'Afghanistan'],
  [/SOUTH SUDAN/, 'South Sudan'],
  [/CENTRAL AFRICAN|CAR\b/, 'Central African Republic'],
  [/DRCONGO|CONGO/, 'Dem. Rep. Congo'],
  [/HAITI/, 'Haiti'],
  [/HONG KONG/, 'China'],
  [/CHINA/, 'China'],
  [/ILLICIT DRUG.*MEXICO|MEXICO/, 'Mexico'],
]

function normName(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function loadCountryIndex() {
  const geo = JSON.parse(await readFile(join(root, 'public/data/countries-110m.geojson'), 'utf8'))
  const byName = new Map()
  const byCode = new Map()
  for (const feature of geo.features) {
    const p = feature.properties
    const iso = (p.iso_a2 && p.iso_a2 !== '-99' ? p.iso_a2 : p.postal || '').toUpperCase()
    const names = [p.name, p.name_long, p.admin, p.formal_en, p.brk_name].filter(Boolean)
    const ring =
      feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates[0]
        : feature.geometry.coordinates.reduce((best, poly) => (poly[0].length > best.length ? poly[0] : best), [])
    const pts = ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring
    const lon = pts.reduce((s, c) => s + c[0], 0) / pts.length
    const lat = pts.reduce((s, c) => s + c[1], 0) / pts.length
    const rec = { code: iso, name: p.name, longitude: lon, latitude: lat }
    byCode.set(iso, rec)
    for (const name of names) byName.set(normName(name), rec)
  }
  const aliases = {
    usa: 'US',
    'united states of america': 'US',
    uk: 'GB',
    'great britain': 'GB',
    russia: 'RU',
    'russian federation': 'RU',
    burma: 'MM',
    myanmar: 'MM',
    syria: 'SY',
    iran: 'IR',
    venezuela: 'VE',
    'north korea': 'KP',
    'south korea': 'KR',
    'ivory coast': 'CI',
    'czech republic': 'CZ',
    'south sudan': 'SS',
    'central african republic': 'CF',
    'democratic republic of the congo': 'CD',
    'dem rep congo': 'CD',
    'congo democratic republic of the': 'CD',
    bolivia: 'BO',
    tanzania: 'TZ',
    laos: 'LA',
    moldova: 'MD',
    palestine: 'PS',
    'west bank': 'PS',
    gaza: 'PS',
    taiwan: 'TW',
    uae: 'AE',
    'united arab emirates': 'AE',
    'korea north': 'KP',
    'korea south': 'KR',
  }
  for (const [alias, code] of Object.entries(aliases)) {
    if (byCode.has(code) && !byName.has(alias)) byName.set(alias, byCode.get(code))
  }
  return { byName, byCode }
}

async function refreshOfac() {
  const { byName } = await loadCountryIndex()
  const [sdnText, addText] = await Promise.all([
    getText('https://www.treasury.gov/ofac/downloads/sdn.csv'),
    getText('https://www.treasury.gov/ofac/downloads/add.csv'),
  ])
  const sdnRows = parseCsv(sdnText)
  const addRows = parseCsv(addText)
  const names = new Map()
  const programs = new Map()
  const splitPrograms = (raw) =>
    cleanCell(raw)
      .replace(/^\[|\]$/g, '')
      .split(/\]\s*\[|;/)
      .map((part) => part.replace(/[\[\]]/g, '').trim())
      .filter(Boolean)
  for (const row of sdnRows) {
    const id = cleanCell(row[0])
    if (!id) continue
    names.set(id, cleanCell(row[1]))
    programs.set(id, splitPrograms(row[3]).join('; '))
  }
  const countryHits = new Map()
  const touch = (countryName, id, program, preferSample = false) => {
    const rec = byName.get(normName(countryName))
    if (!rec) return
    let bucket = countryHits.get(rec.code)
    if (!bucket) {
      bucket = { ...rec, entities: new Set(), programs: new Set(), samples: [] }
      countryHits.set(rec.code, bucket)
    }
    bucket.entities.add(id)
    if (program) {
      for (const part of splitPrograms(program)) bucket.programs.add(part)
    }
    if (preferSample && bucket.samples.length < 3) {
      const name = names.get(id)
      if (name && !bucket.samples.some((s) => s.name === name)) {
        bucket.samples.push({ name, program: program || undefined })
      }
    }
  }
  for (const row of addRows) {
    const id = cleanCell(row[0])
    const country = cleanCell(row[4])
    if (id && country) touch(country, id, programs.get(id), false)
  }
  for (const [id, program] of programs) {
    if (!program) continue
    for (const [re, country] of PROGRAM_COUNTRY) {
      if (re.test(program)) touch(country, id, program, true)
    }
  }
  const countries = [...countryHits.values()]
    .map((row) => ({
      code: row.code,
      name: row.name,
      longitude: Number(row.longitude.toFixed(4)),
      latitude: Number(row.latitude.toFixed(4)),
      count: row.entities.size,
      programs: [...row.programs].slice(0, 8),
      samples: row.samples,
    }))
    .filter((row) => row.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 48)
  return { countries, listDate: new Date().toISOString(), entityCount: sdnRows.length }
}

function iodaSeverity(score) {
  if (score >= 20_000) return 'critical'
  if (score >= 2_000) return 'high'
  if (score >= 200) return 'elevated'
  return 'watch'
}

async function refreshIoda() {
  const { byCode, byName } = await loadCountryIndex()
  const until = Math.floor(Date.now() / 1000)
  const from = until - 7 * 24 * 3600
  const skip = new Set(['AQ', 'AS', 'MP', 'GU', 'VI', 'UM'])
  const env = await getJson(
    `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events?entityType=country&from=${from}&until=${until}&limit=80&orderBy=score/desc`,
  )
  const best = new Map()
  for (const item of env.data ?? []) {
    const code = item.location?.split('/')[1]
    if (!code || skip.has(code) || item.overlaps_window === false) continue
    const rec = byCode.get(code) ?? byName.get(normName(item.location_name ?? ''))
    if (!rec) continue
    const prev = best.get(code)
    if (prev && (item.score ?? 0) <= (prev.score ?? 0)) continue
    const hours = Math.max(1, Math.round((item.duration ?? 0) / 3600))
    best.set(code, {
      id: `ioda-${code}-${item.start ?? 'x'}`,
      title: `Internet outage — ${item.location_name ?? rec.name}`,
      description: `IODA ${item.datasource ?? 'signal'} / ${item.method ?? 'detector'} scored ${Math.round(item.score ?? 0)}. Duration about ${hours}h. Georgia Tech Internet Outage Detection and Analysis.`,
      severity: iodaSeverity(item.score ?? 0),
      occurredAt: item.start ? new Date(item.start * 1000).toISOString() : new Date().toISOString(),
      longitude: rec.longitude,
      latitude: rec.latitude,
      country: item.location_name ?? rec.name,
      url: `https://ioda.inetintel.cc.gatech.edu/country/${code}`,
      source: 'IODA',
      score: item.score ?? 0,
    })
  }
  const summary = await getJson(
    `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/summary?entityType=country&from=${from}&until=${until}&limit=40&orderBy=score/desc`,
  )
  for (const row of summary.data ?? []) {
    const code = row.entity?.code
    if (!code || skip.has(code) || best.has(code)) continue
    const rec = byCode.get(code)
    if (!rec) continue
    const score = row.scores?.overall ?? 0
    if (score < 50) continue
    best.set(code, {
      id: `ioda-sum-${code}`,
      title: `Internet disruption — ${row.entity.name ?? rec.name}`,
      description: `IODA country summary: ${row.event_cnt ?? 0} events, overall score ${Math.round(score)}.`,
      severity: iodaSeverity(Math.min(score, 80_000)),
      occurredAt: new Date().toISOString(),
      longitude: rec.longitude,
      latitude: rec.latitude,
      country: row.entity.name ?? rec.name,
      url: `https://ioda.inetintel.cc.gatech.edu/country/${code}`,
      source: 'IODA',
    })
  }
  return [...best.values()].map(({ score, ...event }) => event).slice(0, 40)
}

const start = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&minmagnitude=4.5&orderby=time&limit=400`

const [usgs, nws, storms, conflicts, ofac, outages] = await Promise.all([
  getJson(usgsUrl),
  getJson('https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe,Moderate', {
    Accept: 'application/geo+json',
  }),
  getJson('https://www.nhc.noaa.gov/CurrentStorms.json').catch(() => ({ activeStorms: [] })),
  refreshGdelt(),
  refreshOfac(),
  refreshIoda(),
])

const hotspots = clusterHotspots(conflicts)
const conflictPolygons = clusterPolygons(conflicts)

await mkdir(outDir, { recursive: true })
await writeFile(join(outDir, 'earthquakes.geojson'), JSON.stringify(usgs))
await writeFile(join(outDir, 'weather-alerts.geojson'), JSON.stringify(nws))
await writeFile(join(outDir, 'storms.json'), JSON.stringify(storms))
await writeFile(
  join(outDir, 'conflicts.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), events: conflicts, polygons: conflictPolygons }, null, 2)}\n`,
)
await writeFile(
  join(outDir, 'hotspots.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), events: hotspots }, null, 2)}\n`,
)
await writeFile(
  join(outDir, 'sanctions.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      listDate: ofac.listDate,
      countries: ofac.countries,
    },
    null,
    2,
  )}\n`,
)
await writeFile(
  join(outDir, 'outages.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), events: outages }, null, 2)}\n`,
)
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
        {
          id: 'conflicts',
          provider: 'The GDELT Project',
          url: 'https://www.gdeltproject.org/',
          license: 'GDELT news-mention events (attribution). Snapshot is a filtered subset, not the full database.',
          count: conflicts.length,
        },
        {
          id: 'hotspots',
          provider: 'Derived from GDELT clusters',
          url: 'https://www.gdeltproject.org/',
          license: 'Derived from the GDELT conflict snapshot',
          count: hotspots.length,
        },
        {
          id: 'sanctions',
          provider: 'US Treasury OFAC SDN',
          url: 'https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists',
          license: 'U.S. public domain. Country aggregates only — not the full SDN file.',
          count: ofac.countries.length,
        },
        {
          id: 'outages',
          provider: 'IODA / Georgia Institute of Technology',
          url: 'https://ioda.inetintel.cc.gatech.edu/',
          license: 'Attribution required. Live client fetch preferred; this file is a short snapshot.',
          count: outages.length,
        },
      ],
    },
    null,
    2,
  )}\n`,
)

console.log(
  `Wrote snapshots: ${usgs.features?.length ?? 0} quakes, ${nws.features?.length ?? 0} alerts, ${storms.activeStorms?.length ?? 0} storms, ${conflicts.length} conflicts, ${hotspots.length} hotspots, ${ofac.countries.length} sanction countries, ${outages.length} outages`,
)
