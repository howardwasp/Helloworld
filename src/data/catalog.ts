import type {
  LayerChip,
  LayerId,
  MapView,
  NewsSourceTab,
  RegionId,
  TimeRange,
} from '@/types/intel'

export const DEFAULT_LAYERS: LayerId[] = [
  'conflicts',
  'hotspots',
  'sanctions',
  'weather',
  'outages',
  'natural',
]

export const DEFAULT_REGION: RegionId = 'americas'
export const DEFAULT_TIME_RANGE: TimeRange = '7d'

export const REGION_VIEWS: Record<RegionId, MapView> = {
  americas: { longitude: -75, latitude: 12, zoom: 2.5, pitch: 0 },
  europe: { longitude: 12, latitude: 50, zoom: 3.2, pitch: 0 },
  asia: { longitude: 105, latitude: 28, zoom: 2.6, pitch: 0 },
  global: { longitude: 0, latitude: 18, zoom: 1.45, pitch: 0 },
}

export const REGION_LABELS: Record<RegionId, string> = {
  americas: 'Americas',
  europe: 'Europe',
  asia: 'Asia',
  global: 'Global',
}

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1h': '1H',
  '6h': '6H',
  '24h': '24H',
  '48h': '48H',
  '7d': '7D',
  all: 'ALL',
}

export const TIME_RANGE_HOURS: Record<Exclude<TimeRange, 'all'>, number> = {
  '1h': 1,
  '6h': 6,
  '24h': 24,
  '48h': 48,
  '7d': 24 * 7,
}

export const LAYER_CHIPS: LayerChip[] = [
  { id: 'conflicts', label: 'Conflict Zones', enabled: true },
  { id: 'hotspots', label: 'Intel Hotspots', enabled: true },
  { id: 'sanctions', label: 'Sanctions', enabled: true },
  { id: 'protests', label: 'Protests', enabled: false },
  { id: 'nuclear', label: 'Nuclear Sites', enabled: false },
  { id: 'bases', label: 'Military Bases', enabled: false },
  { id: 'cables', label: 'Undersea Cables', enabled: false },
  { id: 'pipelines', label: 'Pipelines', enabled: false },
  { id: 'outages', label: 'Internet Disruptions', enabled: true },
  { id: 'datacenters', label: 'Data Centers', enabled: false },
  { id: 'traffic', label: 'Ship Traffic', enabled: false },
  { id: 'aviation', label: 'Aviation', enabled: false },
  { id: 'jamming', label: 'GPS Jamming', enabled: false },
  { id: 'natural', label: 'Natural Events', enabled: true },
  { id: 'weather', label: 'Severe Weather Alerts', enabled: true },
  { id: 'economic', label: 'Economic Centers', enabled: false },
]

export const LAYER_LABELS: Record<LayerId, string> = Object.fromEntries(
  LAYER_CHIPS.map((chip) => [chip.id, chip.label]),
) as Record<LayerId, string>

export const LIVE_LAYER_IDS = ['natural', 'weather'] as const
export const SAMPLE_LAYER_IDS = ['conflicts', 'hotspots', 'sanctions', 'outages'] as const

export const NEWS_SOURCES: NewsSourceTab[] = [
  { id: 'all', label: 'All', accent: '#2f6f4e' },
  { id: 'usgs', label: 'USGS', accent: '#c45c14' },
  { id: 'nws', label: 'NWS', accent: '#2f7cae' },
  { id: 'openmeteo', label: 'Open-Meteo', accent: '#1f7a45' },
  { id: 'reuters', label: 'Reuters', accent: '#f4b400' },
  { id: 'ap', label: 'AP', accent: '#d62728' },
  { id: 'bbc', label: 'BBC', accent: '#bb1919' },
  { id: 'afp', label: 'AFP', accent: '#1f4e79' },
  { id: 'aljazeera', label: 'Al Jazeera', accent: '#fa9000' },
  { id: 'nhk', label: 'NHK', accent: '#e60012' },
  { id: 'france24', label: 'France 24', accent: '#17365d' },
]

export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#d83a2f',
  high: '#e56a1a',
  elevated: '#e39b14',
  watch: '#d6b84a',
  info: '#c9a36a',
}

export const LAYER_COLORS: Record<string, string> = {
  conflicts: '#d83a2f',
  hotspots: '#e56a1a',
  sanctions: '#c97816',
  outages: '#7c4a1a',
  natural: '#e39b14',
  weather: '#2f7cae',
}
