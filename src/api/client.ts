/**
 * SignalMap data access.
 *
 * Live, browser-callable HTTPS APIs first; then GitHub Pages snapshots in
 * `public/data/live/`; then in-memory fixtures so the dashboard still works
 * offline or when a provider is down.
 *
 * Do not scrape World Monitor or any third-party dashboard.
 */
import { fetchConflicts } from '@/api/conflicts'
import { fetchHotspots } from '@/api/hotspots'
import { assembleNews } from '@/api/news'
import { fetchOutages } from '@/api/outages'
import { fetchSanctions } from '@/api/sanctions'
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

  const [quakes, weather, outages, conflicts, sanctions] = await Promise.all([
    fetchEarthquakes(timeRange, now),
    fetchWeather(now),
    fetchOutages(timeRange, now),
    fetchConflicts(timeRange, now),
    fetchSanctions(now),
  ])

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
  if (outages.events.length === 0) {
    outages.source.mode = 'fallback'
  }

  const conflictEvents =
    conflicts.events.length > 0
      ? conflicts.events
      : withSampleSource(fixtureEvents.filter((event) => event.layer === 'conflicts'))
  const conflictPolygons =
    conflicts.polygons.length > 0
      ? conflicts.polygons
      : fixturePolygons.filter((polygon) => polygon.layer === 'conflicts')
  if (conflicts.events.length === 0) {
    conflicts.source.mode = 'fallback'
  }

  const hotspots = await fetchHotspots(timeRange, conflictEvents, conflicts.source.mode, now)
  const hotspotEvents =
    hotspots.events.length > 0
      ? hotspots.events
      : withSampleSource(fixtureEvents.filter((event) => event.layer === 'hotspots'))
  if (hotspots.events.length === 0) {
    hotspots.source.mode = 'fallback'
  }

  const sanctionEvents =
    sanctions.events.length > 0
      ? sanctions.events
      : withSampleSource(fixtureEvents.filter((event) => event.layer === 'sanctions'))
  const sanctionPolygons =
    sanctions.polygons.length > 0
      ? sanctions.polygons
      : fixturePolygons.filter((polygon) => polygon.layer === 'sanctions')
  if (sanctions.events.length === 0) {
    sanctions.source.mode = 'fallback'
  }

  const events = [
    ...naturalEvents,
    ...weatherEvents,
    ...outageEvents,
    ...conflictEvents,
    ...hotspotEvents,
    ...sanctionEvents,
  ]
  const polygons = [...weatherPolygons, ...conflictPolygons, ...sanctionPolygons]
  const news = assembleNews(events, now)

  return {
    events,
    polygons,
    news: news.news,
    generatedAt: new Date(now).toISOString(),
    sources: [
      quakes.source,
      weather.source,
      conflicts.source,
      hotspots.source,
      sanctions.source,
      outages.source,
      news.source,
    ],
  }
}

export const LIVE_API_NOTES = {
  natural: 'USGS FDSN GeoJSON (live, CORS-safe). Snapshot: public/data/live/earthquakes.geojson',
  weather:
    'NWS active alerts + Open-Meteo current conditions + NHC storms (NHC may need the Action snapshot).',
  outages:
    'IODA country outages (live if CORS allows, else public/data/live/outages.json). Optional Cloudflare Radar token.',
  conflicts:
    'GDELT 2.0 15-minute export ZIPs (CORS-safe) + DOC headlines; snapshot public/data/live/conflicts.json.',
  sanctions:
    'US Treasury OFAC SDN aggregated by country into public/data/live/sanctions.json (Actions, every 6h).',
  hotspots: 'Derived from GDELT conflict-point density for the selected time range.',
} as const
