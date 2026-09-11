import { tryFetchJson } from '@/api/http'
import { publicUrl } from '@/lib/publicUrl'
import type { IntelEvent, LayerSourceInfo } from '@/types/intel'

/**
 * Outage hook.
 *
 * Cloudflare Radar annotations need an API token and typically fail CORS from
 * the browser. IODA / NetBlocks are similarly not CORS-safe without a proxy.
 *
 * Resolution order:
 *  1. `VITE_CLOUDFLARE_RADAR_TOKEN` (live Radar, if the browser is allowed)
 *  2. `public/data/live/outages.json` written by a scheduled Action
 *  3. Curated sample fixtures (client assembler)
 */
const RADAR_URL = 'https://api.cloudflare.com/client/v4/radar/annotations/outages?limit=25&dateRange=7d&format=json'
const SNAPSHOT = publicUrl('data/live/outages.json')

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

interface SnapshotEvent {
  id: string
  title: string
  description: string
  severity: IntelEvent['severity']
  occurredAt: string
  longitude: number
  latitude: number
  country?: string
  url?: string
}

const COUNTRY_CENTROIDS: Record<string, { longitude: number; latitude: number; name: string }> = {
  US: { longitude: -98.5, latitude: 39.8, name: 'United States' },
  CU: { longitude: -79.5, latitude: 22.0, name: 'Cuba' },
  HT: { longitude: -72.3, latitude: 18.97, name: 'Haiti' },
  VE: { longitude: -66.6, latitude: 6.4, name: 'Venezuela' },
  UA: { longitude: 31.2, latitude: 48.4, name: 'Ukraine' },
  MM: { longitude: 96.1, latitude: 21.9, name: 'Myanmar' },
  ML: { longitude: -3.5, latitude: 17.6, name: 'Mali' },
  IR: { longitude: 53.7, latitude: 32.4, name: 'Iran' },
  CN: { longitude: 104.2, latitude: 35.9, name: 'China' },
  IN: { longitude: 78.96, latitude: 20.6, name: 'India' },
  BR: { longitude: -51.9, latitude: -14.2, name: 'Brazil' },
}

function mapRadar(item: RadarOutage): IntelEvent | null {
  const code = item.locations?.[0] ?? item.locationsDetails?.[0]?.code
  const centroid = code ? COUNTRY_CENTROIDS[code] : undefined
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

function sampleSource(now: number, note: string): LayerSourceInfo {
  return {
    id: 'outages',
    label: 'Internet Disruptions',
    mode: 'sample',
    provider: 'Cloudflare Radar (hooked, not live)',
    attribution: 'Sample points until a CORS-safe outage GeoJSON or Radar token is configured',
    url: 'https://developers.cloudflare.com/radar/investigate/outages/',
    fetchedAt: new Date(now).toISOString(),
    note,
  }
}

export async function fetchOutages(now = Date.now()): Promise<{
  events: IntelEvent[]
  source: LayerSourceInfo
}> {
  const token = import.meta.env.VITE_CLOUDFLARE_RADAR_TOKEN
  if (token) {
    const radar = await tryFetchJson<RadarResponse>(RADAR_URL, {
      timeoutMs: 8_000,
      headers: { Authorization: `Bearer ${token}` },
    })
    const events = (radar?.result?.annotations ?? []).map(mapRadar).filter((event): event is IntelEvent => event != null)
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

  const snapshot = await tryFetchJson<{ events?: SnapshotEvent[] }>(SNAPSHOT, { timeoutMs: 6_000 })
  if (snapshot?.events?.length) {
    return {
      events: snapshot.events.map((item) => ({ ...item, layer: 'outages' as const, source: item.url ? 'Outage snapshot' : 'Outage snapshot' })),
      source: {
        id: 'outages',
        label: 'Internet Disruptions',
        mode: 'live',
        provider: 'Scheduled outage snapshot',
        attribution: 'See public/data/live/outages.json',
        fetchedAt: new Date(now).toISOString(),
        note: 'Loaded from public/data/live/outages.json',
      },
    }
  }

  return {
    events: [],
    source: sampleSource(
      now,
      token
        ? 'Radar token present but the request failed (likely CORS). Using sample outages.'
        : 'No CORS-safe public outage feed configured. Sample layer — set VITE_CLOUDFLARE_RADAR_TOKEN or add public/data/live/outages.json.',
    ),
  }
}
