import { clipText, firstStateFromArea, nwsSeverity, ringsFromGeometry, centroidOfRings } from '@/api/geo'
import { fetchJson, tryFetchJson } from '@/api/http'
import { publicUrl } from '@/lib/publicUrl'
import type { IntelEvent, IntelPolygon, LayerSourceInfo, Severity } from '@/types/intel'

const NWS_ALERTS =
  'https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe,Moderate'
const NHC_STORMS = 'https://www.nhc.noaa.gov/CurrentStorms.json'
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'
const NWS_SNAPSHOT = publicUrl('data/live/weather-alerts.geojson')
const NHC_SNAPSHOT = publicUrl('data/live/storms.json')

const PRIORITY_EVENT = /tornado|thunderstorm|flash flood|hurricane|tropical|storm surge|blizzard|ice storm|extreme wind|extreme heat|red flag|high wind|flood warning|winter storm|tsunami|typhoon|cyclone/i

export const OPEN_METEO_STATIONS = [
  { name: 'Miami', country: 'United States', latitude: 25.76, longitude: -80.19 },
  { name: 'Houston', country: 'United States', latitude: 29.76, longitude: -95.37 },
  { name: 'Mexico City', country: 'Mexico', latitude: 19.43, longitude: -99.13 },
  { name: 'Havana', country: 'Cuba', latitude: 23.11, longitude: -82.37 },
  { name: 'Bogotá', country: 'Colombia', latitude: 4.71, longitude: -74.07 },
  { name: 'Caracas', country: 'Venezuela', latitude: 10.48, longitude: -66.9 },
  { name: 'Lima', country: 'Peru', latitude: -12.05, longitude: -77.04 },
  { name: 'São Paulo', country: 'Brazil', latitude: -23.55, longitude: -46.63 },
  { name: 'Buenos Aires', country: 'Argentina', latitude: -34.6, longitude: -58.38 },
  { name: 'London', country: 'United Kingdom', latitude: 51.51, longitude: -0.13 },
  { name: 'Paris', country: 'France', latitude: 48.86, longitude: 2.35 },
  { name: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.41 },
  { name: 'Rome', country: 'Italy', latitude: 41.9, longitude: 12.5 },
  { name: 'Lagos', country: 'Nigeria', latitude: 6.52, longitude: 3.38 },
  { name: 'Nairobi', country: 'Kenya', latitude: -1.29, longitude: 36.82 },
  { name: 'Tokyo', country: 'Japan', latitude: 35.68, longitude: 139.69 },
  { name: 'Manila', country: 'Philippines', latitude: 14.6, longitude: 120.98 },
  { name: 'Jakarta', country: 'Indonesia', latitude: -6.21, longitude: 106.85 },
  { name: 'Mumbai', country: 'India', latitude: 19.08, longitude: 72.88 },
  { name: 'Dhaka', country: 'Bangladesh', latitude: 23.81, longitude: 90.41 },
  { name: 'Taipei', country: 'Taiwan', latitude: 25.03, longitude: 121.57 },
  { name: 'Sydney', country: 'Australia', latitude: -33.87, longitude: 151.21 },
  { name: 'Dubai', country: 'United Arab Emirates', latitude: 25.2, longitude: 55.27 },
  { name: 'Manila Basin', country: 'Philippine Sea', latitude: 15.0, longitude: 130.0 },
] as const

const WMO_LABEL: Record<number, string> = {
  65: 'Heavy rain',
  67: 'Heavy freezing rain',
  75: 'Heavy snow',
  82: 'Violent rain showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
}

interface NwsFeature {
  id?: string
  properties?: {
    id?: string
    event?: string
    headline?: string
    description?: string
    instruction?: string
    severity?: string
    sent?: string
    onset?: string
    effective?: string
    expires?: string
    areaDesc?: string
    senderName?: string
    web?: string
  }
  geometry?: { type: string; coordinates: unknown } | null
}

interface NwsCollection {
  features?: NwsFeature[]
}

interface NhcStorm {
  id?: string
  name?: string
  classification?: string
  intensity?: string
  pressure?: string
  latitudeNumeric?: number
  longitudeNumeric?: number
  lastUpdate?: string
  movementDir?: number
  movementSpeed?: number
}

interface NhcCollection {
  activeStorms?: NhcStorm[]
}

interface OpenMeteoCurrent {
  time?: string
  weather_code?: number
  wind_speed_10m?: number
  precipitation?: number
}

interface OpenMeteoStation {
  latitude?: number
  longitude?: number
  current?: OpenMeteoCurrent
}

export interface WeatherPayload {
  events: IntelEvent[]
  polygons: IntelPolygon[]
  source: LayerSourceInfo
}

function safeIso(value: string | undefined, fallback = Date.now()): string {
  if (!value) return new Date(fallback).toISOString()
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? new Date(fallback).toISOString() : new Date(parsed).toISOString()
}

function nwsId(feature: NwsFeature, index: number): string {
  const raw = feature.properties?.id ?? feature.id ?? `nws-${index}`
  return `nws-${raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(-40)}`
}

function keepNwsAlert(feature: NwsFeature): boolean {
  const severity = (feature.properties?.severity ?? '').toLowerCase()
  const event = feature.properties?.event ?? ''
  if (severity === 'extreme' || severity === 'severe') return true
  if (feature.geometry && PRIORITY_EVENT.test(event)) return true
  return false
}

function mapNws(feature: NwsFeature, index: number): { event?: IntelEvent; polygon?: IntelPolygon } {
  const props = feature.properties ?? {}
  const rings = ringsFromGeometry(feature.geometry ?? null)
  const fromRing = rings ? centroidOfRings(rings) : null
  const fromState = firstStateFromArea(props.areaDesc)
  const point = fromRing ?? (fromState ? { longitude: fromState.longitude, latitude: fromState.latitude } : null)
  if (!point) return {}

  const occurredAt = safeIso(props.onset ?? props.effective ?? props.sent)
  const title = props.event ?? props.headline ?? 'Weather alert'
  const area = props.areaDesc ? clipText(props.areaDesc, 160) : fromState?.name ?? 'United States'
  const description = clipText(
    [props.headline, props.description].filter(Boolean).join(' — ') || 'National Weather Service alert.',
    420,
  )
  const severity = nwsSeverity(props.severity)
  const country = fromState?.name ?? 'United States'
  const shared = {
    title,
    description: `${description} Area: ${area}.`,
    severity,
    source: 'NWS',
    occurredAt,
    country,
    url: props.web ?? undefined,
  }

  const event: IntelEvent = {
    id: nwsId(feature, index),
    layer: 'weather',
    longitude: point.longitude,
    latitude: point.latitude,
    label: (props.event ?? 'WX').split(' ')[0]?.slice(0, 8),
    ...shared,
  }

  const polygon: IntelPolygon | undefined = rings
    ? {
        id: `${event.id}-poly`,
        layer: 'weather',
        rings,
        ...shared,
      }
    : undefined

  return { event, polygon }
}

function parseNws(data: NwsCollection | null): { events: IntelEvent[]; polygons: IntelPolygon[] } {
  const events: IntelEvent[] = []
  const polygons: IntelPolygon[] = []
  const seen = new Set<string>()
  for (const [index, feature] of (data?.features ?? []).entries()) {
    if (!keepNwsAlert(feature)) continue
    const mapped = mapNws(feature, index)
    if (mapped.event && !seen.has(mapped.event.id)) {
      seen.add(mapped.event.id)
      events.push(mapped.event)
    }
    if (mapped.polygon) polygons.push(mapped.polygon)
    if (events.length >= 80) break
  }
  return { events, polygons }
}

function stormTitle(storm: NhcStorm): string {
  const name = storm.name ?? 'Unnamed'
  const cls = (storm.classification ?? '').toUpperCase()
  const kind =
    cls === 'HU' ? 'Hurricane' : cls === 'TS' ? 'Tropical Storm' : cls === 'TD' ? 'Tropical Depression' : 'Cyclone'
  return `${kind} ${name}`
}

function stormSeverity(intensity: number): Severity {
  if (intensity >= 96) return 'critical'
  if (intensity >= 64) return 'high'
  if (intensity >= 39) return 'elevated'
  return 'watch'
}

function mapStorm(storm: NhcStorm): IntelEvent | null {
  if (storm.latitudeNumeric == null || storm.longitudeNumeric == null) return null
  const knots = Number(storm.intensity ?? 0)
  const movement =
    storm.movementDir != null && storm.movementSpeed != null
      ? ` Moving ${storm.movementDir}° at ${storm.movementSpeed} kt.`
      : ''
  return {
    id: `nhc-${storm.id ?? storm.name ?? 'storm'}`,
    layer: 'weather',
    title: stormTitle(storm),
    description: `National Hurricane Center active cyclone. Intensity ${storm.intensity ?? '?'} kt, pressure ${storm.pressure ?? '?'} mb.${movement}`,
    severity: stormSeverity(Number.isFinite(knots) ? knots : 0),
    source: 'NHC',
    occurredAt: safeIso(storm.lastUpdate),
    longitude: storm.longitudeNumeric,
    latitude: storm.latitudeNumeric,
    country: 'Atlantic / East Pacific',
    label: storm.name?.slice(0, 8),
    url: 'https://www.nhc.noaa.gov/',
  }
}

function isSevereOpenMeteo(current: OpenMeteoCurrent): { label: string; severity: Severity } | null {
  const code = current.weather_code ?? 0
  const wind = current.wind_speed_10m ?? 0
  const precip = current.precipitation ?? 0
  if (code === 99 || code === 96) return { label: WMO_LABEL[code], severity: 'high' }
  if (code === 95 || code === 82 || code === 86) return { label: WMO_LABEL[code] ?? 'Severe convection', severity: 'high' }
  if (code === 65 || code === 67 || code === 75) return { label: WMO_LABEL[code], severity: 'elevated' }
  if (wind >= 90) return { label: `Damaging wind ${Math.round(wind)} km/h`, severity: 'high' }
  if (wind >= 62) return { label: `Gale-force wind ${Math.round(wind)} km/h`, severity: 'elevated' }
  if (precip >= 15) return { label: `Heavy rain ${precip.toFixed(1)} mm`, severity: 'high' }
  if (precip >= 8) return { label: `Heavy rain ${precip.toFixed(1)} mm`, severity: 'elevated' }
  return null
}

function mapOpenMeteo(rows: OpenMeteoStation[]): IntelEvent[] {
  const events: IntelEvent[] = []
  rows.forEach((row, index) => {
    const station = OPEN_METEO_STATIONS[index]
    if (!station || !row.current) return
    const severe = isSevereOpenMeteo(row.current)
    if (!severe) return
    const occurredAt = row.current.time
      ? new Date(`${row.current.time.replace(' ', 'T')}Z`).toISOString()
      : new Date().toISOString()
    events.push({
      id: `om-${station.name.toLowerCase().replace(/\s+/g, '-')}`,
      layer: 'weather',
      title: `${severe.label} — ${station.name}`,
      description: `Open-Meteo current conditions at ${station.name}: weather code ${row.current.weather_code ?? '—'}, wind ${row.current.wind_speed_10m ?? '—'} km/h, precipitation ${row.current.precipitation ?? '—'} mm.`,
      severity: severe.severity,
      source: 'Open-Meteo',
      occurredAt,
      longitude: station.longitude,
      latitude: station.latitude,
      country: station.country,
      label: 'WX',
      url: 'https://open-meteo.com/',
    })
  })
  return events
}

async function fetchNws(): Promise<{ events: IntelEvent[]; polygons: IntelPolygon[]; via: 'live' | 'snapshot' | 'none' }> {
  try {
    const live = await fetchJson<NwsCollection>(NWS_ALERTS, {
      timeoutMs: 14_000,
      cacheTtlMs: 3 * 60_000,
      headers: { Accept: 'application/geo+json' },
    })
    const parsed = parseNws(live)
    if (parsed.events.length > 0 || parsed.polygons.length > 0) {
      return { ...parsed, via: 'live' }
    }
  } catch {
    // snapshot next
  }
  const snapshot = await tryFetchJson<NwsCollection>(NWS_SNAPSHOT, { timeoutMs: 8_000 })
  const parsed = parseNws(snapshot)
  if (parsed.events.length > 0 || parsed.polygons.length > 0) {
    return { ...parsed, via: 'snapshot' }
  }
  return { events: [], polygons: [], via: 'none' }
}

async function fetchNhc(): Promise<IntelEvent[]> {
  const live = await tryFetchJson<NhcCollection>(NHC_STORMS, { timeoutMs: 8_000, cacheTtlMs: 5 * 60_000 })
  const storms = live?.activeStorms ?? (await tryFetchJson<NhcCollection>(NHC_SNAPSHOT, { timeoutMs: 6_000 }))?.activeStorms
  return (storms ?? []).map(mapStorm).filter((event): event is IntelEvent => event != null)
}

async function fetchOpenMeteo(): Promise<IntelEvent[]> {
  const latitudes = OPEN_METEO_STATIONS.map((s) => s.latitude).join(',')
  const longitudes = OPEN_METEO_STATIONS.map((s) => s.longitude).join(',')
  const url = `${OPEN_METEO}?latitude=${latitudes}&longitude=${longitudes}&current=weather_code,wind_speed_10m,precipitation&wind_speed_unit=kmh&timezone=UTC`
  const data = await tryFetchJson<OpenMeteoStation[] | OpenMeteoStation>(url, {
    timeoutMs: 12_000,
    cacheTtlMs: 10 * 60_000,
  })
  if (!data) return []
  return mapOpenMeteo(Array.isArray(data) ? data : [data])
}

export async function fetchWeather(now = Date.now()): Promise<WeatherPayload> {
  const [nws, nhc, openMeteo] = await Promise.all([fetchNws(), fetchNhc(), fetchOpenMeteo()])
  const events = [...nws.events, ...nhc, ...openMeteo]
  const live = nws.via !== 'none' || nhc.length > 0 || openMeteo.length > 0
  const parts = [
    nws.via === 'live' ? 'NWS alerts (live)' : nws.via === 'snapshot' ? 'NWS alerts (snapshot)' : null,
    nhc.length ? 'NHC active cyclones' : null,
    openMeteo.length ? 'Open-Meteo severe conditions' : 'Open-Meteo station scan',
  ].filter(Boolean)

  const source: LayerSourceInfo = {
    id: 'weather',
    label: 'Severe Weather Alerts',
    mode: live ? 'live' : 'fallback',
    provider: 'NWS / NHC / Open-Meteo',
    attribution: 'NWS & NHC (U.S. public domain); Open-Meteo (CC BY 4.0)',
    url: 'https://www.weather.gov/documentation/services-web-api',
    fetchedAt: new Date(now).toISOString(),
    note: live
      ? parts.join(' · ')
      : 'Live weather feeds unavailable — using curated sample alerts',
  }

  return { events, polygons: nws.polygons, source }
}
