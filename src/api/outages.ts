import { resolveCentroid } from '@/api/centroids'
import { clipText } from '@/api/geo'
import { tryFetchJson } from '@/api/http'
import { snapshotToEvents, type SnapshotBundle, type SnapshotEvent } from '@/api/snapshot'
import { queryWindow } from '@/api/windows'
import { publicUrl } from '@/lib/publicUrl'
import type { IntelEvent, LayerSourceInfo, Severity, TimeRange } from '@/types/intel'

/**
 * Outages: Cloudflare Radar (optional token) → IODA live → Actions snapshot → fixtures.
 * IODA typically has no browser CORS header; the scheduled snapshot is the reliable path.
 */
const RADAR_URL =
  'https://api.cloudflare.com/client/v4/radar/annotations/outages?limit=25&dateRange=7d&format=json'
const IODA_EVENTS = 'https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events'
const IODA_SUMMARY = 'https://api.ioda.inetintel.cc.gatech.edu/v2/outages/summary'
const SNAPSHOT = publicUrl('data/live/outages.json')

const SKIP_CODES = new Set(['AQ', 'AS', 'MP', 'GU', 'VI', 'UM', 'BQ', 'TF', 'IO', 'HM', 'GS'])

interface RadarOutage {
  id?: string | number
  description?: string | null
  scope?: string | null
  startDate?: string
  locations?: string[]
  locationsDetails?: { code?: string; name?: string }[]
  outage?: { outageCause?: string; outageType?: string }
  linkedUrl?: string | null
}

interface RadarResponse {
  success?: boolean
  result?: { annotations?: RadarOutage[] }
}

interface IodaEvent {
  location?: string
  location_name?: string
  start?: number
  duration?: number
  datasource?: string
  method?: string
  score?: number
  overlaps_window?: boolean
}

interface IodaEnvelope<T> {
  data?: T
  error?: string | null
}

interface IodaSummaryRow {
  scores?: { overall?: number }
  event_cnt?: number
  entity?: { code?: string; name?: string; type?: string }
}

function severityForScore(score: number): Severity {
  if (score >= 20_000) return 'critical'
  if (score >= 2_000) return 'high'
  if (score >= 200) return 'elevated'
  return 'watch'
}

function mapRadar(item: RadarOutage): IntelEvent | null {
  const code = item.locations?.[0] ?? item.locationsDetails?.[0]?.code
  const centroid = resolveCentroid(code) ?? resolveCentroid(item.locationsDetails?.[0]?.name)
  if (!centroid) return null
  const cause = item.outage?.outageCause ?? 'UNKNOWN'
  const kind = item.outage?.outageType ?? 'OUTAGE'
  return {
    id: `radar-${item.id ?? `${centroid.name}-${item.startDate}`}`,
    layer: 'outages',
    title: `${kind.replace(/_/g, ' ')} — ${item.locationsDetails?.[0]?.name ?? centroid.name}`,
    description: item.description || item.scope || `Cloudflare Radar ${kind.toLowerCase()} (${cause}).`,
    severity: kind === 'NATIONWIDE' ? 'critical' : 'high',
    source: 'Cloudflare Radar',
    occurredAt: item.startDate ?? new Date().toISOString(),
    longitude: centroid.longitude,
    latitude: centroid.latitude,
    country: item.locationsDetails?.[0]?.name ?? centroid.name,
    url: item.linkedUrl ?? 'https://radar.cloudflare.com/',
  }
}

function mapIodaEvent(item: IodaEvent): IntelEvent | null {
  const code = item.location?.split('/')[1]
  if (!code || SKIP_CODES.has(code)) return null
  if (item.overlaps_window === false) return null
  const centroid = resolveCentroid(code) ?? resolveCentroid(item.location_name)
  if (!centroid) return null
  const hours = Math.max(1, Math.round((item.duration ?? 0) / 3600))
  const score = item.score ?? 0
  return {
    id: `ioda-${code}-${item.start ?? 'x'}`,
    layer: 'outages',
    title: `Internet outage — ${item.location_name ?? centroid.name}`,
    description: clipText(
      `IODA ${item.datasource ?? 'signal'} / ${item.method ?? 'detector'} scored ${Math.round(score)}. Duration about ${hours}h. Georgia Tech Internet Outage Detection and Analysis.`,
      420,
    ),
    severity: severityForScore(score),
    source: 'IODA',
    occurredAt: item.start ? new Date(item.start * 1000).toISOString() : new Date().toISOString(),
    longitude: centroid.longitude,
    latitude: centroid.latitude,
    country: item.location_name ?? centroid.name,
    label: item.datasource?.slice(0, 8),
    url: `https://ioda.inetintel.cc.gatech.edu/country/${code}`,
  }
}

function mapIodaSummary(row: IodaSummaryRow, occurredAt: string): IntelEvent | null {
  const code = row.entity?.code
  if (!code || SKIP_CODES.has(code) || row.entity?.type !== 'country') return null
  const centroid = resolveCentroid(code) ?? resolveCentroid(row.entity.name)
  if (!centroid) return null
  const score = row.scores?.overall ?? 0
  return {
    id: `ioda-sum-${code}`,
    layer: 'outages',
    title: `Internet disruption — ${row.entity.name ?? centroid.name}`,
    description: clipText(
      `IODA country summary: ${row.event_cnt ?? 0} events, overall score ${Math.round(score)}. Georgia Tech Internet Outage Detection and Analysis.`,
      420,
    ),
    severity: severityForScore(Math.min(score, 80_000)),
    source: 'IODA',
    occurredAt,
    longitude: centroid.longitude,
    latitude: centroid.latitude,
    country: row.entity.name ?? centroid.name,
    label: String(row.event_cnt ?? ''),
    url: `https://ioda.inetintel.cc.gatech.edu/country/${code}`,
  }
}

function dedupeByCountry(events: IntelEvent[]): IntelEvent[] {
  const best = new Map<string, IntelEvent>()
  for (const event of events) {
    const key = event.country ?? event.id
    const prev = best.get(key)
    if (!prev) {
      best.set(key, event)
      continue
    }
    const rank: Record<string, number> = { critical: 0, high: 1, elevated: 2, watch: 3, info: 4 }
    if (rank[event.severity] < rank[prev.severity]) best.set(key, event)
  }
  return [...best.values()].slice(0, 40)
}

async function fetchIoda(range: TimeRange, now: number): Promise<IntelEvent[]> {
  const window = queryWindow(range, now)
  const from = Math.floor(Date.parse(window.startIso) / 1000)
  const until = Math.floor(now / 1000)
  const common = `entityType=country&from=${from}&until=${until}&limit=60&orderBy=score/desc`
  const eventsEnv = await tryFetchJson<IodaEnvelope<IodaEvent[]>>(`${IODA_EVENTS}?${common}`, {
    timeoutMs: 10_000,
    cacheTtlMs: 5 * 60_000,
  })
  const fromEvents = (eventsEnv?.data ?? []).map(mapIodaEvent).filter((event): event is IntelEvent => event != null)
  if (fromEvents.length > 0) return dedupeByCountry(fromEvents)

  const summaryEnv = await tryFetchJson<IodaEnvelope<IodaSummaryRow[]>>(`${IODA_SUMMARY}?${common}`, {
    timeoutMs: 10_000,
    cacheTtlMs: 5 * 60_000,
  })
  const occurredAt = new Date(now).toISOString()
  return dedupeByCountry(
    (summaryEnv?.data ?? []).map((row) => mapIodaSummary(row, occurredAt)).filter((event): event is IntelEvent => event != null),
  )
}

export async function fetchOutages(range: TimeRange, now = Date.now()): Promise<{
  events: IntelEvent[]
  source: LayerSourceInfo
}> {
  const token = import.meta.env.VITE_CLOUDFLARE_RADAR_TOKEN
  if (token) {
    const radar = await tryFetchJson<RadarResponse>(RADAR_URL, {
      timeoutMs: 8_000,
      headers: { Authorization: `Bearer ${token}` },
    })
    const events = (radar?.result?.annotations ?? [])
      .map(mapRadar)
      .filter((event): event is IntelEvent => event != null)
    if (events.length > 0) {
      return {
        events,
        source: {
          id: 'outages',
          label: 'Internet Disruptions',
          mode: 'live',
          provider: 'Cloudflare Radar',
          attribution: 'Cloudflare Radar Outage Center',
          url: 'https://radar.cloudflare.com/',
          fetchedAt: new Date(now).toISOString(),
          note: 'Live Radar annotations (token present)',
        },
      }
    }
  }

  const ioda = await fetchIoda(range, now)
  if (ioda.length > 0) {
    return {
      events: ioda,
      source: {
        id: 'outages',
        label: 'Internet Disruptions',
        mode: 'live',
        provider: 'IODA / Georgia Tech',
        attribution: 'Internet Outage Detection and Analysis (IODA), Georgia Institute of Technology',
        url: 'https://ioda.inetintel.cc.gatech.edu/',
        fetchedAt: new Date(now).toISOString(),
        note: `Live IODA country outages · ${ioda.length} locations`,
      },
    }
  }

  const snapshot = await tryFetchJson<SnapshotBundle>(SNAPSHOT, { timeoutMs: 6_000, cacheTtlMs: 10 * 60_000 })
  const snapEvents = snapshotToEvents(snapshot?.events as SnapshotEvent[] | undefined, 'outages', 'IODA')
  if (snapEvents.length > 0) {
    return {
      events: snapEvents,
      source: {
        id: 'outages',
        label: 'Internet Disruptions',
        mode: 'cached',
        provider: 'IODA / Georgia Tech',
        attribution: 'Internet Outage Detection and Analysis (IODA), Georgia Institute of Technology',
        url: 'https://ioda.inetintel.cc.gatech.edu/',
        fetchedAt: snapshot?.generatedAt ?? new Date(now).toISOString(),
        note: 'Snapshot in public/data/live/outages.json (IODA; Radar if a token is configured in Actions)',
      },
    }
  }

  return {
    events: [],
    source: {
      id: 'outages',
      label: 'Internet Disruptions',
      mode: 'fallback',
      provider: 'IODA / Georgia Tech',
      attribution: 'Internet Outage Detection and Analysis (IODA), Georgia Institute of Technology',
      url: 'https://ioda.inetintel.cc.gatech.edu/',
      fetchedAt: new Date(now).toISOString(),
      note: token
        ? 'Radar/IODA live and snapshot failed — using sample outages'
        : 'IODA is not CORS-safe in this browser and no snapshot is present — using sample outages',
    },
  }
}
