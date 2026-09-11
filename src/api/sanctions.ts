import { resolveCentroid } from '@/api/centroids'
import { clipText, ringsFromGeometry } from '@/api/geo'
import { tryFetchJson } from '@/api/http'
import { publicUrl } from '@/lib/publicUrl'
import type { IntelEvent, IntelPolygon, LayerSourceInfo, Severity } from '@/types/intel'
import type { FeatureCollection, Geometry } from 'geojson'

const SNAPSHOT = publicUrl('data/live/sanctions.json')
const COUNTRIES = publicUrl('data/countries-110m.geojson')

export interface SanctionCountryRow {
  code: string
  name: string
  longitude: number
  latitude: number
  count: number
  programs?: string[]
  samples?: { name: string; program?: string }[]
}

export interface SanctionsSnapshot {
  generatedAt?: string
  listDate?: string
  countries?: SanctionCountryRow[]
}

export interface SanctionsPayload {
  events: IntelEvent[]
  polygons: IntelPolygon[]
  source: LayerSourceInfo
}

function severityForCount(count: number): Severity {
  if (count >= 400) return 'critical'
  if (count >= 120) return 'high'
  if (count >= 40) return 'elevated'
  return 'watch'
}

function mapRow(row: SanctionCountryRow, listDate: string): IntelEvent | null {
  const centroid = resolveCentroid(row.code) ?? resolveCentroid(row.name)
  const longitude = row.longitude || centroid?.longitude
  const latitude = row.latitude || centroid?.latitude
  if (longitude == null || latitude == null) return null
  const programs = (row.programs ?? []).slice(0, 6).join(', ')
  const samples = (row.samples ?? [])
    .slice(0, 3)
    .map((item) => item.name)
    .join('; ')
  return {
    id: `ofac-${row.code || row.name}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    layer: 'sanctions',
    title: `OFAC designations — ${row.name}`,
    description: clipText(
      `${row.count} SDN address/program hits geocoded to ${row.name}. ${programs ? `Programs: ${programs}.` : ''} ${samples ? `Examples: ${samples}.` : ''} Aggregate of the public SDN list — not a legal coverage map.`,
      420,
    ),
    severity: severityForCount(row.count),
    source: 'OFAC',
    occurredAt: listDate,
    longitude,
    latitude,
    country: row.name,
    label: String(row.count),
    url: 'https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists',
  }
}

async function countryPolygons(events: IntelEvent[], listDate: string): Promise<IntelPolygon[]> {
  const geo = await tryFetchJson<FeatureCollection<Geometry>>(COUNTRIES, {
    timeoutMs: 10_000,
    cacheTtlMs: 60 * 60_000,
  })
  if (!geo?.features) return []
  const wanted = new Map(events.map((event) => [event.country?.toLowerCase(), event]))
  const polygons: IntelPolygon[] = []
  for (const feature of geo.features) {
    const props = feature.properties as { name?: string; admin?: string; iso_a2?: string } | null
    const name = props?.name ?? props?.admin
    const event = wanted.get(name?.toLowerCase() ?? '')
    const geometry = feature.geometry
    if (!event || !geometry || geometry.type === 'GeometryCollection') continue
    const rings = ringsFromGeometry(geometry)
    if (!rings) continue
    polygons.push({
      id: `${event.id}-poly`,
      layer: 'sanctions',
      title: event.title,
      description: event.description,
      severity: event.severity,
      source: 'OFAC',
      occurredAt: listDate,
      rings,
      country: event.country,
      url: event.url,
    })
    if (polygons.length >= 10) break
  }
  return polygons
}

export async function fetchSanctions(now = Date.now()): Promise<SanctionsPayload> {
  const snapshot = await tryFetchJson<SanctionsSnapshot>(SNAPSHOT, {
    timeoutMs: 8_000,
    cacheTtlMs: 30 * 60_000,
  })
  const listDate = snapshot?.listDate ?? snapshot?.generatedAt ?? new Date(now).toISOString()
  const asOf = new Date(now).toISOString()
  const rows = [...(snapshot?.countries ?? [])].sort((a, b) => b.count - a.count).slice(0, 36)
  const events = rows.map((row) => mapRow(row, asOf)).filter((event): event is IntelEvent => event != null)

  if (events.length > 0) {
    const polygons = await countryPolygons(events, listDate)
    return {
      events,
      polygons,
      source: {
        id: 'sanctions',
        label: 'Sanctions',
        mode: 'cached',
        provider: 'US Treasury OFAC SDN',
        attribution:
          'U.S. Treasury OFAC Specially Designated Nationals list (U.S. public domain). Country dots are address/program aggregates, not legal coverage.',
        url: 'https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists',
        fetchedAt: snapshot?.generatedAt ?? new Date(now).toISOString(),
        note: `Live (cached) SDN snapshot · ${events.length} countries · list ${listDate.slice(0, 10)}`,
      },
    }
  }

  return {
    events: [],
    polygons: [],
    source: {
      id: 'sanctions',
      label: 'Sanctions',
      mode: 'fallback',
      provider: 'US Treasury OFAC SDN',
      attribution: 'U.S. Treasury OFAC SDN list',
      url: 'https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists',
      fetchedAt: new Date(now).toISOString(),
      note: 'OFAC snapshot missing — using curated sample overlays (not legal coverage)',
    },
  }
}
