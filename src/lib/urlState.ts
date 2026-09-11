import { DEFAULT_LAYERS, DEFAULT_REGION, DEFAULT_TIME_RANGE, REGION_VIEWS } from '@/data/catalog'
import type { LayerId, MapView, RegionId, TimeRange } from '@/types/intel'
import { REGION_IDS, TIME_RANGES } from '@/types/intel'

export interface DashboardUrlState {
  region: RegionId
  timeRange: TimeRange
  layers: LayerId[]
  view: MapView
}

function parseNumber(value: string | null, fallback: number): number {
  if (value == null || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function parseRegion(value: string | null): RegionId {
  return REGION_IDS.includes(value as RegionId) ? (value as RegionId) : DEFAULT_REGION
}

function parseTimeRange(value: string | null): TimeRange {
  if (value === '7d' || TIME_RANGES.includes(value as TimeRange)) return value as TimeRange
  if (value === '168h') return '7d'
  return DEFAULT_TIME_RANGE
}

function parseLayers(value: string | null): LayerId[] {
  if (!value) return [...DEFAULT_LAYERS]
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean) as LayerId[]
  return parts.length > 0 ? parts : [...DEFAULT_LAYERS]
}

export function defaultUrlState(): DashboardUrlState {
  return {
    region: DEFAULT_REGION,
    timeRange: DEFAULT_TIME_RANGE,
    layers: [...DEFAULT_LAYERS],
    view: { ...REGION_VIEWS[DEFAULT_REGION] },
  }
}

export function parseDashboardSearch(search: string): DashboardUrlState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const region = parseRegion(params.get('region'))
  const fallback = REGION_VIEWS[region]
  return {
    region,
    timeRange: parseTimeRange(params.get('timeRange') ?? params.get('range')),
    layers: parseLayers(params.get('layers')),
    view: {
      longitude: parseNumber(params.get('lng'), fallback.longitude),
      latitude: parseNumber(params.get('lat'), fallback.latitude),
      zoom: parseNumber(params.get('zoom'), fallback.zoom),
      pitch: parseNumber(params.get('pitch'), fallback.pitch),
    },
  }
}

export function serializeDashboardSearch(state: DashboardUrlState): string {
  const params = new URLSearchParams()
  params.set('region', state.region)
  params.set('timeRange', state.timeRange)
  params.set('layers', state.layers.join(','))
  params.set('lng', state.view.longitude.toFixed(3))
  params.set('lat', state.view.latitude.toFixed(3))
  params.set('zoom', state.view.zoom.toFixed(2))
  if (state.view.pitch > 0.5) params.set('pitch', state.view.pitch.toFixed(0))
  return params.toString()
}

export function writeDashboardUrl(state: DashboardUrlState): void {
  const next = `?${serializeDashboardSearch(state)}`
  const current = window.location.search.startsWith('?')
    ? window.location.search
    : `?${window.location.search}`
  if (current === next) return
  window.history.replaceState(null, '', `${window.location.pathname}${next}${window.location.hash}`)
}

export function viewsAreClose(a: MapView, b: MapView): boolean {
  return (
    Math.abs(a.longitude - b.longitude) < 0.01 &&
    Math.abs(a.latitude - b.latitude) < 0.01 &&
    Math.abs(a.zoom - b.zoom) < 0.03 &&
    Math.abs(a.pitch - b.pitch) < 1
  )
}
