/**
 * SignalMap data access.
 *
 * The MVP loads typed in-memory fixtures so the dashboard works offline.
 * Swap the function bodies below when you are ready for live public feeds.
 *
 * Suggested live sources (check each provider's terms before shipping):
 *  - Natural events .... USGS earthquake GeoJSON
 *    https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson
 *  - Weather ........... Open-Meteo warnings / NWS API (alerts)
 *    https://api.open-meteo.com/  and  https://api.weather.gov/alerts/active
 *  - Outages ........... IODA / Cloudflare Radar (often need keys + attribution)
 *  - Conflicts ......... ACLED (key required) or other licensed incident feeds
 *  - Sanctions ......... OFAC SDN / EU consolidated lists (legal text, not geometries)
 *
 * Do not scrape World Monitor or any third-party dashboard.
 * Do not call unofficial clones of those APIs.
 */
import { buildFixtureEvents, buildFixtureNews, buildFixturePolygons } from '@/data/fixtures'
import type { IntelBundle } from '@/types/intel'

export async function fetchIntelBundle(): Promise<IntelBundle> {
  // TODO: replace this mock assembler with Promise.all of live fetchers.
  // Keep the IntelBundle contract so the UI does not need to change.
  await new Promise((resolve) => setTimeout(resolve, 180))
  const now = Date.now()
  return {
    events: buildFixtureEvents(now),
    polygons: buildFixturePolygons(now),
    news: buildFixtureNews(now),
    generatedAt: new Date(now).toISOString(),
  }
}

export const LIVE_API_NOTES = {
  natural: 'USGS GeoJSON feeds — map mag/place/time/coordinates into IntelEvent.',
  weather: 'Open-Meteo or NWS alerts — map event/headline/area to points or polygons.',
  outages: 'IODA outage signals — treat country centroids as points until polygons exist.',
  conflicts: 'Licensed incident API — never scrape a commercial dashboard.',
  sanctions: 'Official list text + your own geocoder; do not invent legal coverage.',
  hotspots: 'Derive from your own ranking of the other layers.',
} as const
