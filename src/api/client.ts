/**
 * SignalMap data access.
 *
 * Live, browser-callable HTTPS APIs first; then GitHub Pages snapshots in
 * `public/data/live/`; then in-memory fixtures so the dashboard still works
 * offline or when a provider is down.
 *
 * Do not scrape World Monitor or any third-party dashboard.
 */
import { fetchOutages } from '@/api/outages'
import { assembleNews } from '@/api/news'
import { sampleConflictBundle } from '@/api/sampleLayers'
import { fetchEarthquakes } from '@/api/usgs'
import { fetchWeather } from '@/api/weather'
import { buildFixtureEvents, buildFixturePolygons } from '@/data/fixtures'
import type { IntelBundle, IntelEvent, TimeRange } from '@/types/intel'

export interface FetchIntelOptions {
  timeRange?: TimeRange
  now?: number
}

function withSampleSource(events: IntelEvent[]): IntelEvent[] {
  return events.map((event) =>
    event.source.includes('sample') || event.source.includes('mock')
      ? event
      : { ...event, source: `${event.source} (sample)` },
  )
}

export async function fetchIntelBundle(options: FetchIntelOptions = {}): Promise<IntelBundle> {
  const timeRange = options.timeRange ?? '7d'
  const now = options.now ?? Date.now()

  const [quakes, weather, outages] = await Promise.all([
    fetchEarthquakes(timeRange, now),
    fetchWeather(now),
    fetchOutages(now),
  ])

  const sample = sampleConflictBundle(now)
  const fixtureEvents = buildFixtureEvents(now)
  const fixturePolygons = buildFixturePolygons(now)

  const naturalEvents =
    quakes.items.length > 0
      ? quakes.items
      : withSampleSource(fixtureEvents.filter((event) => event.layer === 'natural'))
  if (quakes.items.length === 0) {
    quakes.source.mode = 'fallback'
  }

  const weatherEvents =
    weather.events.length > 0
      ? weather.events
      : withSampleSource(fixtureEvents.filter((event) => event.layer === 'weather'))
  const weatherPolygons =
    weather.polygons.length > 0
      ? weather.polygons
      : fixturePolygons.filter((polygon) => polygon.layer === 'weather')
  if (weather.events.length === 0) {
    weather.source.mode = 'fallback'
  }

  const outageEvents =
    outages.events.length > 0
      ? outages.events
      : withSampleSource(fixtureEvents.filter((event) => event.layer === 'outages'))

  const events = [...naturalEvents, ...weatherEvents, ...outageEvents, ...sample.events]
  const polygons = [...weatherPolygons, ...sample.polygons]
  const news = assembleNews(events, now)

  return {
    events,
    polygons,
    news: news.news,
    generatedAt: new Date(now).toISOString(),
    sources: [quakes.source, weather.source, outages.source, ...sample.sources, news.source],
  }
}

export const LIVE_API_NOTES = {
  natural: 'USGS FDSN GeoJSON (live, CORS-safe). Snapshot: public/data/live/earthquakes.geojson',
  weather:
    'NWS active alerts + Open-Meteo current conditions + NHC storms (NHC may need the Action snapshot).',
  outages:
    'Hooked for Cloudflare Radar / public/data/live/outages.json. Sample fixtures until a CORS-safe feed exists.',
  conflicts: 'Sample fixtures. ACLED needs a key; do not scrape commercial dashboards.',
  sanctions: 'Sample overlays. Official lists are legal text, not geometries.',
  hotspots: 'Sample points, plus a derived ranking of whatever is on the map.',
} as const
