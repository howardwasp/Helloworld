import { fetchJson, tryFetchJson } from '@/api/http'
import { countryFromUsgsPlace, magnitudeSeverity } from '@/api/geo'
import { queryWindow } from '@/api/windows'
import { publicUrl } from '@/lib/publicUrl'
import type { IntelEvent, LayerSourceInfo, TimeRange } from '@/types/intel'

const USGS_QUERY = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
const SNAPSHOT = publicUrl('data/live/earthquakes.geojson')

interface UsgsFeature {
  id?: string
  properties?: {
    mag?: number | null
    place?: string | null
    time?: number | null
    url?: string | null
    tsunami?: number | null
    magType?: string | null
    title?: string | null
    type?: string | null
  }
  geometry?: { type?: string; coordinates?: number[] } | null
}

interface UsgsCollection {
  features?: UsgsFeature[]
  metadata?: { generated?: number }
}

export interface LayerFetch<T> {
  items: T[]
  source: LayerSourceInfo
}

function mapQuake(feature: UsgsFeature): IntelEvent | null {
  const coords = feature.geometry?.coordinates
  const props = feature.properties
  if (!coords || coords.length < 2 || !props?.time) return null
  const mag = typeof props.mag === 'number' ? props.mag : 0
  const place = props.place ?? 'Unknown location'
  const depth = coords[2]
  const title = props.title ?? `M${mag.toFixed(1)} earthquake — ${place}`
  const depthText = typeof depth === 'number' ? ` Depth ${depth.toFixed(1)} km.` : ''
  const tsunami = props.tsunami ? ' Tsunami flag is set.' : ' No tsunami flag.'
  const magType = props.magType ? ` (${props.magType})` : ''
  return {
    id: `usgs-${feature.id ?? `${props.time}`}`,
    layer: 'natural',
    title,
    description: `${place}.${depthText}${tsunami} Magnitude ${mag.toFixed(1)}${magType}.`,
    severity: magnitudeSeverity(mag),
    source: 'USGS',
    occurredAt: new Date(props.time).toISOString(),
    longitude: coords[0],
    latitude: coords[1],
    country: countryFromUsgsPlace(place),
    label: `M${mag.toFixed(1)}`,
    magnitude: mag,
    url: props.url ?? undefined,
  }
}

function parseCollection(data: UsgsCollection | null): IntelEvent[] {
  return (data?.features ?? []).map(mapQuake).filter((event): event is IntelEvent => event != null)
}

export async function fetchEarthquakes(range: TimeRange, now = Date.now()): Promise<LayerFetch<IntelEvent>> {
  const window = queryWindow(range, now)
  const params = new URLSearchParams({
    format: 'geojson',
    starttime: window.startIso,
    endtime: window.endIso,
    minmagnitude: String(window.minMagnitude),
    orderby: 'time',
    limit: String(window.limit),
  })
  const liveUrl = `${USGS_QUERY}?${params.toString()}`

  try {
    const live = await fetchJson<UsgsCollection>(liveUrl, { timeoutMs: 14_000, cacheTtlMs: 4 * 60_000 })
    const items = parseCollection(live)
    if (items.length > 0) {
      return {
        items,
        source: {
          id: 'natural',
          label: 'Natural Events',
          mode: 'live',
          provider: 'USGS Earthquake Hazards Program',
          attribution: 'U.S. Geological Survey (public domain)',
          url: 'https://earthquake.usgs.gov/fdsnws/event/1/',
          fetchedAt: new Date(now).toISOString(),
          note: `Live FDSN GeoJSON · M≥${window.minMagnitude} · ${window.hours}h window`,
        },
      }
    }
  } catch {
    // Try the GitHub Pages snapshot, then fixtures in the client.
  }

  const snapshot = await tryFetchJson<UsgsCollection>(SNAPSHOT, {
    timeoutMs: 8_000,
    cacheTtlMs: 10 * 60_000,
  })
  const items = parseCollection(snapshot)
  if (items.length > 0) {
    return {
      items,
      source: {
        id: 'natural',
        label: 'Natural Events',
        mode: 'live',
        provider: 'USGS Earthquake Hazards Program',
        attribution: 'U.S. Geological Survey (public domain)',
        url: 'https://earthquake.usgs.gov/fdsnws/event/1/',
        fetchedAt: snapshot?.metadata?.generated
          ? new Date(snapshot.metadata.generated).toISOString()
          : new Date(now).toISOString(),
        note: 'Snapshot in public/data/live (refreshed by GitHub Actions)',
      },
    }
  }

  return {
    items: [],
    source: {
      id: 'natural',
      label: 'Natural Events',
      mode: 'fallback',
      provider: 'USGS Earthquake Hazards Program',
      attribution: 'U.S. Geological Survey (public domain)',
      url: 'https://earthquake.usgs.gov/fdsnws/event/1/',
      fetchedAt: new Date(now).toISOString(),
      note: 'Live feed unavailable — using curated sample earthquakes',
    },
  }
}
