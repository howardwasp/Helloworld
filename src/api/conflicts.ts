import { fetchGdeltDocEvents, fetchGdeltExportEvents, dedupeConflicts } from '@/api/gdelt'
import { clipText } from '@/api/geo'
import { tryFetchJson } from '@/api/http'
import { snapshotToEvents, snapshotToPolygons, type SnapshotBundle } from '@/api/snapshot'
import { startMs } from '@/api/windows'
import { publicUrl } from '@/lib/publicUrl'
import type { IntelEvent, IntelPolygon, LayerSourceInfo, TimeRange } from '@/types/intel'

const SNAPSHOT = publicUrl('data/live/conflicts.json')

export interface ConflictPayload {
  events: IntelEvent[]
  polygons: IntelPolygon[]
  source: LayerSourceInfo
}

function inRange(events: IntelEvent[], range: TimeRange, now: number): IntelEvent[] {
  const start = startMs(range, now)
  if (start === 0) return events
  return events.filter((event) => Date.parse(event.occurredAt) >= start)
}

function clusterPolygons(events: IntelEvent[], now: number): IntelPolygon[] {
  const cell = 2.4
  const buckets = new Map<string, IntelEvent[]>()
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
      const lons = group.map((event) => event.longitude)
      const lats = group.map((event) => event.latitude)
      const pad = 0.7
      const minLon = Math.min(...lons) - pad
      const maxLon = Math.max(...lons) + pad
      const minLat = Math.min(...lats) - pad
      const maxLat = Math.max(...lats) + pad
      const latest = group.reduce((best, event) => (event.occurredAt > best.occurredAt ? event : best))
      const place = latest.country ?? latest.title
      return {
        id: `gdelt-cluster-${index}`,
        layer: 'conflicts' as const,
        title: `Conflict cluster — ${place}`,
        description: clipText(
          `${group.length} GDELT conflict mentions clustered in this box. Density overlay, not a front line.`,
          360,
        ),
        severity: latest.severity,
        source: 'GDELT',
        occurredAt: latest.occurredAt || new Date(now).toISOString(),
        country: latest.country,
        rings: [
          [
            [minLon, maxLat],
            [maxLon, maxLat],
            [maxLon, minLat],
            [minLon, minLat],
            [minLon, maxLat],
          ],
        ],
      }
    })
}

export async function fetchConflicts(range: TimeRange, now = Date.now()): Promise<ConflictPayload> {
  const [exportEvents, docEvents] = await Promise.all([
    fetchGdeltExportEvents(range, now),
    fetchGdeltDocEvents(range, now),
  ])
  const live = inRange(dedupeConflicts([...exportEvents, ...docEvents]), range, now)
  if (live.length > 0) {
    return {
      events: live,
      polygons: clusterPolygons(live, now),
      source: {
        id: 'conflicts',
        label: 'Conflict Zones',
        mode: 'live',
        provider: 'GDELT Project',
        attribution: 'The GDELT Project — news-mention events, not verified incidents',
        url: 'https://www.gdeltproject.org/',
        fetchedAt: new Date(now).toISOString(),
        note: `Live GDELT 2.0 export${docEvents.length ? ' + DOC headlines' : ''} · ${live.length} points`,
      },
    }
  }

  const snapshot = await tryFetchJson<SnapshotBundle>(SNAPSHOT, { timeoutMs: 8_000, cacheTtlMs: 10 * 60_000 })
  const events = inRange(snapshotToEvents(snapshot?.events, 'conflicts', 'GDELT'), range, now)
  const polygons = snapshotToPolygons(snapshot?.polygons, 'conflicts', 'GDELT')
  if (events.length > 0) {
    return {
      events,
      polygons: polygons.length ? polygons : clusterPolygons(events, now),
      source: {
        id: 'conflicts',
        label: 'Conflict Zones',
        mode: 'cached',
        provider: 'GDELT Project',
        attribution: 'The GDELT Project — news-mention events, not verified incidents',
        url: 'https://www.gdeltproject.org/',
        fetchedAt: snapshot?.generatedAt ?? new Date(now).toISOString(),
        note: 'Snapshot in public/data/live/conflicts.json (GitHub Actions)',
      },
    }
  }

  return {
    events: [],
    polygons: [],
    source: {
      id: 'conflicts',
      label: 'Conflict Zones',
      mode: 'fallback',
      provider: 'GDELT Project',
      attribution: 'The GDELT Project',
      url: 'https://www.gdeltproject.org/',
      fetchedAt: new Date(now).toISOString(),
      note: 'GDELT live and snapshot unavailable — using curated sample conflicts',
    },
  }
}
