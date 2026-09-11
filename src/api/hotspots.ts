import { clipText } from '@/api/geo'
import { tryFetchJson } from '@/api/http'
import { snapshotToEvents, type SnapshotBundle } from '@/api/snapshot'
import { startMs } from '@/api/windows'
import { publicUrl } from '@/lib/publicUrl'
import type { IntelEvent, LayerSourceInfo, Severity, TimeRange } from '@/types/intel'

const SNAPSHOT = publicUrl('data/live/hotspots.json')

export interface HotspotPayload {
  events: IntelEvent[]
  source: LayerSourceInfo
}

function inRange(events: IntelEvent[], range: TimeRange, now: number): IntelEvent[] {
  const start = startMs(range, now)
  if (start === 0) return events
  return events.filter((event) => Date.parse(event.occurredAt) >= start)
}

function peakSeverity(events: IntelEvent[]): Severity {
  if (events.some((event) => event.severity === 'critical')) return 'critical'
  if (events.some((event) => event.severity === 'high')) return 'high'
  if (events.some((event) => event.severity === 'elevated')) return 'elevated'
  return 'watch'
}

/** Grid-cluster recent conflict/news points into hotspot markers. */
export function deriveHotspots(conflicts: IntelEvent[], now = Date.now()): IntelEvent[] {
  const cell = 3
  const buckets = new Map<string, IntelEvent[]>()
  for (const event of conflicts) {
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
      const lon = group.reduce((sum, event) => sum + event.longitude, 0) / group.length
      const lat = group.reduce((sum, event) => sum + event.latitude, 0) / group.length
      const latest = group.reduce((best, event) => (event.occurredAt > best.occurredAt ? event : best))
      const place = latest.country ?? latest.title.replace(/^[^—-]+[—-]\s*/, '')
      return {
        id: `hot-${index}-${place.slice(0, 16).replace(/\s+/g, '-').toLowerCase()}`,
        layer: 'hotspots' as const,
        title: `Hotspot — ${place}`,
        description: clipText(
          `${group.length} recent GDELT conflict/news mentions clustered here. Updates with the time-range chip.`,
          360,
        ),
        severity: peakSeverity(group),
        source: 'GDELT cluster',
        occurredAt: latest.occurredAt || new Date(now).toISOString(),
        longitude: lon,
        latitude: lat,
        country: latest.country,
        label: String(group.length),
        url: latest.url,
      }
    })
}

export async function fetchHotspots(
  range: TimeRange,
  conflicts: IntelEvent[],
  conflictMode: LayerSourceInfo['mode'],
  now = Date.now(),
): Promise<HotspotPayload> {
  const derived = deriveHotspots(inRange(conflicts, range, now), now)
  if (derived.length > 0 && conflictMode !== 'fallback' && conflictMode !== 'sample') {
    return {
      events: derived,
      source: {
        id: 'hotspots',
        label: 'Intel Hotspots',
        mode: conflictMode === 'live' ? 'live' : 'cached',
        provider: 'Derived from GDELT clusters',
        attribution: 'The GDELT Project — clustered news-mention density',
        url: 'https://www.gdeltproject.org/',
        fetchedAt: new Date(now).toISOString(),
        note: `${derived.length} density clusters from the current time window`,
      },
    }
  }

  const snapshot = await tryFetchJson<SnapshotBundle>(SNAPSHOT, { timeoutMs: 6_000, cacheTtlMs: 10 * 60_000 })
  const events = inRange(snapshotToEvents(snapshot?.events, 'hotspots', 'GDELT cluster'), range, now)
  if (events.length > 0) {
    return {
      events,
      source: {
        id: 'hotspots',
        label: 'Intel Hotspots',
        mode: 'cached',
        provider: 'Derived from GDELT clusters',
        attribution: 'The GDELT Project — clustered news-mention density',
        url: 'https://www.gdeltproject.org/',
        fetchedAt: snapshot?.generatedAt ?? new Date(now).toISOString(),
        note: 'Snapshot in public/data/live/hotspots.json',
      },
    }
  }

  if (derived.length > 0) {
    return {
      events: derived,
      source: {
        id: 'hotspots',
        label: 'Intel Hotspots',
        mode: 'fallback',
        provider: 'Derived from sample conflicts',
        attribution: 'Clustered from whatever conflict points are on the map',
        fetchedAt: new Date(now).toISOString(),
        note: 'Derived from fixture conflicts after GDELT failed',
      },
    }
  }

  return {
    events: [],
    source: {
      id: 'hotspots',
      label: 'Intel Hotspots',
      mode: 'fallback',
      provider: 'Derived from GDELT clusters',
      attribution: 'The GDELT Project',
      fetchedAt: new Date(now).toISOString(),
      note: 'No live clusters — using curated sample hotspots',
    },
  }
}
