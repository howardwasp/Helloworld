export const ACTIVE_LAYER_IDS = [
  'conflicts',
  'hotspots',
  'sanctions',
  'outages',
  'natural',
  'weather',
] as const

export type ActiveLayerId = (typeof ACTIVE_LAYER_IDS)[number]

export const STUB_LAYER_IDS = [
  'protests',
  'nuclear',
  'bases',
  'cables',
  'pipelines',
  'aviation',
  'datacenters',
  'traffic',
  'jamming',
  'economic',
] as const

export type StubLayerId = (typeof STUB_LAYER_IDS)[number]
export type LayerId = ActiveLayerId | StubLayerId

export const SEVERITIES = ['critical', 'high', 'elevated', 'watch', 'info'] as const
export type Severity = (typeof SEVERITIES)[number]

export const TIME_RANGES = ['1h', '6h', '24h', '48h', '7d', 'all'] as const
export type TimeRange = (typeof TIME_RANGES)[number]

export const REGION_IDS = ['americas', 'europe', 'asia', 'global'] as const
export type RegionId = (typeof REGION_IDS)[number]

export interface MapView {
  longitude: number
  latitude: number
  zoom: number
  pitch: number
}

export interface IntelEvent {
  id: string
  layer: ActiveLayerId
  title: string
  description: string
  severity: Severity
  source: string
  occurredAt: string
  longitude: number
  latitude: number
  country?: string
  label?: string
  magnitude?: number
  url?: string
}

export interface IntelPolygon {
  id: string
  layer: Extract<ActiveLayerId, 'conflicts' | 'sanctions' | 'weather'>
  title: string
  description: string
  severity: Severity
  source: string
  occurredAt: string
  rings: number[][][]
  country?: string
  url?: string
}

export interface NewsItem {
  id: string
  source: string
  sourceId: string
  headline: string
  summary: string
  region: string
  occurredAt: string
  severity: Severity
  relatedEventId?: string
}

export type LayerMode = 'live' | 'cached' | 'sample' | 'fallback'

export interface LayerSourceInfo {
  id: ActiveLayerId | 'news'
  label: string
  mode: LayerMode
  provider: string
  attribution: string
  url?: string
  fetchedAt?: string
  note?: string
}

export interface IntelBundle {
  events: IntelEvent[]
  polygons: IntelPolygon[]
  news: NewsItem[]
  generatedAt: string
  sources: LayerSourceInfo[]
}

export interface SelectableFeature {
  id: string
  kind: 'event' | 'polygon'
  layer: ActiveLayerId
  title: string
  description: string
  severity: Severity
  source: string
  occurredAt: string
  country?: string
  longitude?: number
  latitude?: number
  label?: string
  url?: string
}

export interface LayerChip {
  id: LayerId
  label: string
  enabled: boolean
}

export interface NewsSourceTab {
  id: string
  label: string
  accent: string
}
