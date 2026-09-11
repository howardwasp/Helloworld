import { regionFromLonLat } from '@/api/geo'
import { buildFixtureNews } from '@/data/fixtures'
import type { IntelEvent, LayerSourceInfo, NewsItem } from '@/types/intel'

function sourceIdFor(event: IntelEvent): string {
  if (event.source === 'USGS') return 'usgs'
  if (event.source === 'NWS' || event.source === 'NHC') return 'nws'
  if (event.source === 'Open-Meteo') return 'openmeteo'
  return 'all'
}

function newsFromLive(events: IntelEvent[]): NewsItem[] {
  const rank: Record<string, number> = {
    critical: 0,
    high: 1,
    elevated: 2,
    watch: 3,
    info: 4,
  }
  return [...events]
    .filter((event) => event.layer === 'natural' || event.layer === 'weather')
    .sort((a, b) => rank[a.severity] - rank[b.severity] || b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 12)
    .map((event) => ({
      id: `news-${event.id}`,
      source: event.source,
      sourceId: sourceIdFor(event),
      headline: event.title,
      summary: event.description,
      region: regionFromLonLat(event.longitude, event.latitude),
      occurredAt: event.occurredAt,
      severity: event.severity,
      relatedEventId: event.id,
    }))
}

export function assembleNews(
  liveEvents: IntelEvent[],
  now: number,
): { news: NewsItem[]; source: LayerSourceInfo } {
  const live = newsFromLive(liveEvents)
  // Fixture briefings that belong to sample layers only (skip mock quake/weather copy).
  const sample = buildFixtureNews(now).filter((item) => {
    const id = item.relatedEventId ?? ''
    return id.startsWith('cf-') || id.startsWith('hs-') || id.startsWith('sn-') || id.startsWith('ou-')
  })

  const liveOn = live.length > 0
  return {
    news: [...live, ...sample],
    source: {
      id: 'news',
      label: 'Briefings',
      mode: liveOn ? 'live' : 'sample',
      provider: liveOn ? 'Derived from live USGS / NWS / Open-Meteo + sample desks' : 'Sample desks',
      attribution: 'Live cards quote public API fields. Outlet tabs (Reuters, AP, …) remain sample copy.',
      fetchedAt: new Date(now).toISOString(),
      note: liveOn
        ? `${live.length} live cards · ${sample.length} sample desk cards`
        : 'Sample briefings only',
    },
  }
}
