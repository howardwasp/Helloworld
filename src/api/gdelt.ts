import { centroidByName, resolveCentroid } from '@/api/centroids'
import { isoFromFips } from '@/api/fips'
import { clipText } from '@/api/geo'
import { tryFetchBuffer, tryFetchJson, tryFetchText } from '@/api/http'
import { queryWindow } from '@/api/windows'
import { unzipFirstFile } from '@/api/zip'
import type { IntelEvent, Severity, TimeRange } from '@/types/intel'

const GDELT_EXPORT = 'https://data.gdeltproject.org/gdeltv2'
const LASTUPDATE = `${GDELT_EXPORT}/lastupdate.txt`
const DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc'

const ROOT_LABEL: Record<string, string> = {
  '14': 'Protest',
  '18': 'Assault',
  '19': 'Armed clash',
  '20': 'Mass violence',
}

const ACTOR_HINT = /^(MIL|REB|INS|SEP)/

const WATCH_PLACE =
  /ukraine|israel|gaza|west bank|palestine|yemen|syria|iran|iraq|sudan|myanmar|haiti|mali|burkina|niger\b|libya|lebanon|afghanistan|pakistan|somalia|congo|ethiopia|russia|taiwan|korea|venezuela|armenia|azerbaijan|belarus|sahel|khartoum|donbas|kyiv|tehran|sanaa|rafah|port-au-prince|houthis|hezbollah|hamas/i

const WAR_WORDS =
  /airstrike|air strike|artillery|missile|rocket|offensive|invasion|bombard|drone strike|ceasefire|shelling|warplane|fighter jet|armed group|militia|insurgent|front.?line|occupied|killed in (a )?strike|clash with/i

/** Cap browser ZIP downloads so a time-chip click stays polite. */
const LIVE_FILE_CAP = 8

export function parseGdeltStamp(value: string | undefined): Date | null {
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

export function gdeltFileStamps(range: TimeRange, now = Date.now(), stepMinutes = 15): string[] {
  const window = queryWindow(range, now)
  const step = stepMinutes * 60_000
  const latest = Math.floor(now / step) * step - step
  const start = Math.max(window.startIso ? Date.parse(window.startIso) : latest - 24 * 3600_000, latest - 7 * 24 * 3600_000)
  const stamps: string[] = []
  for (let t = latest; t >= start; t -= step) {
    const date = new Date(t)
    const stamp = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
      String(date.getUTCHours()).padStart(2, '0'),
      String(date.getUTCMinutes()).padStart(2, '0'),
      '00',
    ].join('')
    stamps.push(stamp)
  }
  return stamps
}

function countryFromRow(fullName: string, fips: string): string | undefined {
  const tail = fullName.split(',').map((part) => part.trim()).filter(Boolean).at(-1)
  if (tail) {
    const hit = centroidByName(tail)
    if (hit) return hit.name
    return tail
  }
  const iso = isoFromFips(fips)
  return iso ? resolveCentroid(iso)?.name : undefined
}

function severityFor(root: string, mentions: number): Severity {
  if (root === '20' || mentions >= 40) return 'critical'
  if (root === '19' && mentions >= 10) return 'high'
  if (root === '19' || root === '18') return 'elevated'
  return 'watch'
}

function keepConflict(parts: string[]): boolean {
  const root = parts[28]
  if (!['14', '18', '19', '20'].includes(root)) return false
  const lat = Number(parts[56])
  const lon = Number(parts[57])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false
  const mentions = Number(parts[31] || 0)
  const actorType = parts[12] ?? ''
  const url = parts[60] ?? ''
  const name = parts[52] ?? ''
  const actor = `${parts[6] ?? ''} ${parts[16] ?? ''}`
  const hay = `${name} ${url} ${actor}`
  if (/september-11|9\/11|911-fake|pentagon-flag|remembering-911|x-men|prnewswire|comicbook/i.test(url)) {
    return false
  }
  const watch = WATCH_PLACE.test(hay)
  const war = WAR_WORDS.test(hay)
  const typed = ACTOR_HINT.test(actorType)
  if (root === '14' && !(watch && mentions >= 10)) return false
  if (watch || war || typed) return mentions >= 2
  return false
}

export function parseGdeltExport(tsv: string): IntelEvent[] {
  const events: IntelEvent[] = []
  const seen = new Set<string>()
  for (const line of tsv.split(/\r?\n/)) {
    if (!line) continue
    const parts = line.split('\t')
    if (parts.length < 61) continue
    if (!keepConflict(parts)) continue
    const id = parts[0]
    const lat = Number(parts[56])
    const lon = Number(parts[57])
    const root = parts[28]
    const mentions = Number(parts[31] || 0)
    const goldstein = Number(parts[30] || 0)
    const fullName = parts[52] || ''
    const country = countryFromRow(fullName, parts[53])
    const added = parseGdeltStamp(parts[59]) ?? parseGdeltStamp(parts[1]) ?? new Date()
    const place = fullName.split(',').map((part) => part.trim()).filter(Boolean)[0] || country || 'Unknown location'
    const label = ROOT_LABEL[root] ?? 'Conflict'
    const actor = (parts[6] || parts[16] || '').replace(/_/g, ' ').trim()
    const title = `${label} — ${place}`
    const key = `${root}|${lat.toFixed(2)}|${lon.toFixed(2)}|${(parts[60] ?? '').slice(0, 80)}`
    if (seen.has(key)) continue
    seen.add(key)
    events.push({
      id: `gdelt-${id}`,
      layer: 'conflicts',
      title: clipText(title, 120),
      description: clipText(
        `GDELT CAMEO ${root} (${label.toLowerCase()}) near ${fullName || place}. ${mentions} mention${mentions === 1 ? '' : 's'}, Goldstein ${goldstein || '—'}.${actor ? ` Actor: ${actor}.` : ''} News-mention event, not a verified incident.`,
        420,
      ),
      severity: severityFor(root, mentions),
      source: 'GDELT',
      occurredAt: added.toISOString(),
      longitude: lon,
      latitude: lat,
      country,
      label: label.split(' ')[0]?.slice(0, 8),
      url: parts[60] || undefined,
    })
  }
  return events
}

export function dedupeConflicts(events: IntelEvent[], limit = 220): IntelEvent[] {
  const rank: Record<string, number> = { critical: 0, high: 1, elevated: 2, watch: 3, info: 4 }
  return [...events]
    .sort(
      (a, b) =>
        rank[a.severity] - rank[b.severity] || Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
    )
    .slice(0, limit)
}

async function latestExportStamp(): Promise<string | null> {
  const body = await tryFetchText(LASTUPDATE, { timeoutMs: 8_000, cacheTtlMs: 3 * 60_000 })
  return body?.match(/(\d{14})\.export\.CSV\.zip/)?.[1] ?? null
}

export async function fetchGdeltExportEvents(range: TimeRange, now = Date.now()): Promise<IntelEvent[]> {
  let stamps = gdeltFileStamps(range, now, range === '1h' || range === '6h' ? 15 : 30)
  const latest = await latestExportStamp()
  if (latest && !stamps.includes(latest)) {
    stamps = [latest, ...stamps]
  }
  const picked = stamps.slice(0, LIVE_FILE_CAP)
  const batches = await Promise.all(
    picked.map(async (stamp) => {
      const zip = await tryFetchBuffer(`${GDELT_EXPORT}/${stamp}.export.CSV.zip`, {
        timeoutMs: 12_000,
        cacheTtlMs: 8 * 60_000,
      })
      if (!zip) return [] as IntelEvent[]
      try {
        const tsv = await unzipFirstFile(zip)
        return parseGdeltExport(tsv)
      } catch {
        return []
      }
    }),
  )
  return dedupeConflicts(batches.flat())
}

interface GdeltArticle {
  url?: string
  title?: string
  seendate?: string
  domain?: string
  language?: string
  sourcecountry?: string
}

interface GdeltDocResponse {
  articles?: GdeltArticle[]
}

const DOC_QUERY =
  '(conflict OR war OR airstrike OR "armed clash" OR bombardment OR insurgent OR artillery OR "rocket attack" OR "air strike")'

function geocodeArticle(article: GdeltArticle): { longitude: number; latitude: number; country?: string } | null {
  const hay = `${article.title ?? ''} ${article.sourcecountry ?? ''}`
  const country = centroidByName(article.sourcecountry ?? '')
  const tokens = hay.split(/[^A-Za-z\u00C0-\u024F'-]+/).filter((token) => token.length > 3)
  for (const token of tokens) {
    const hit = centroidByName(token)
    if (hit) return { longitude: hit.longitude, latitude: hit.latitude, country: hit.name }
  }
  if (country) return { longitude: country.longitude, latitude: country.latitude, country: country.name }
  return null
}

export async function fetchGdeltDocEvents(range: TimeRange, now = Date.now()): Promise<IntelEvent[]> {
  const timespan =
    range === '1h' ? '1h' : range === '6h' ? '6h' : range === '24h' ? '1d' : range === '48h' ? '2d' : '7d'
  const params = new URLSearchParams({
    query: DOC_QUERY,
    mode: 'ArtList',
    maxrecords: '75',
    timespan,
    format: 'json',
    sort: 'DateDesc',
  })
  const data = await tryFetchJson<GdeltDocResponse | string>(`${DOC_API}?${params.toString()}`, {
    timeoutMs: 12_000,
    cacheTtlMs: 5 * 60_000,
  })
  const articles = data && typeof data === 'object' ? data.articles ?? [] : []
  const events: IntelEvent[] = []
  const seen = new Set<string>()
  for (const [index, article] of articles.entries()) {
    if (!article.title) continue
    const geo = geocodeArticle(article)
    if (!geo) continue
    const key = `${geo.latitude.toFixed(1)}|${geo.longitude.toFixed(1)}|${article.title.slice(0, 40)}`
    if (seen.has(key)) continue
    seen.add(key)
    const seenAt = article.seendate
      ? parseGdeltStamp(article.seendate.replace(/[^0-9]/g, '').slice(0, 14))
      : null
    events.push({
      id: `gdelt-doc-${index}-${article.domain ?? 'src'}`,
      layer: 'conflicts',
      title: clipText(article.title, 140),
      description: clipText(
        `GDELT DOC headline (${article.domain ?? 'news'}). Geocoded from the title or publisher country — a news mention, not a verified incident.`,
        420,
      ),
      severity: /airstrike|bombard|massacre|offensive|invasion/i.test(article.title) ? 'high' : 'elevated',
      source: 'GDELT',
      occurredAt: (seenAt ?? new Date(now)).toISOString(),
      longitude: geo.longitude,
      latitude: geo.latitude,
      country: geo.country,
      url: article.url,
      label: 'NEWS',
    })
    if (events.length >= 40) break
  }
  return events
}
