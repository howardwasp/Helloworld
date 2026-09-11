import { buildFixtureEvents, buildFixturePolygons } from '@/data/fixtures'
import type { IntelEvent, IntelPolygon, LayerSourceInfo } from '@/types/intel'

const SAMPLE_EVENT_LAYERS = ['conflicts', 'hotspots', 'sanctions'] as const

function sampleSource(
  id: LayerSourceInfo['id'],
  label: string,
  provider: string,
  now: number,
  note: string,
): LayerSourceInfo {
  return {
    id,
    label,
    mode: 'sample',
    provider,
    attribution: 'Curated demo geometries — not an official legal or operational map',
    fetchedAt: new Date(now).toISOString(),
    note,
  }
}

export function sampleConflictBundle(now: number): {
  events: IntelEvent[]
  polygons: IntelPolygon[]
  sources: LayerSourceInfo[]
} {
  const events = buildFixtureEvents(now).filter((event) =>
    (SAMPLE_EVENT_LAYERS as readonly string[]).includes(event.layer),
  )
  const polygons = buildFixturePolygons(now).filter(
    (polygon) => polygon.layer === 'conflicts' || polygon.layer === 'sanctions',
  )
  return {
    events,
    polygons,
    sources: [
      sampleSource(
        'conflicts',
        'Conflict Zones',
        'Curated sample',
        now,
        'ACLED requires a key and forbids unclear redistribution. GDELT GEO is news-mention noise, not verified incidents. Sample fixtures stay on until a licensed feed is wired.',
      ),
      sampleSource(
        'hotspots',
        'Intel Hotspots',
        'Curated sample',
        now,
        'Hotspot points are a curated sample. The Brief list still ranks whatever is visible on the map, including live quakes and alerts.',
      ),
      sampleSource(
        'sanctions',
        'Sanctions',
        'Curated sample',
        now,
        'OFAC SDN / EU lists are legal text, not geometries. Overlays remain illustrative samples and are not legal coverage.',
      ),
    ],
  }
}
