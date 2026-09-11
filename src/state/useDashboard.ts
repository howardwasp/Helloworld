import { fetchIntelBundle } from '@/api/client'
import { LAYER_CHIPS, REGION_VIEWS } from '@/data/catalog'
import { isWithinTimeRange } from '@/lib/time'
import {
  defaultUrlState,
  parseDashboardSearch,
  viewsAreClose,
  writeDashboardUrl,
  type DashboardUrlState,
} from '@/lib/urlState'
import { selectableFromEvent } from '@/map/geo'
import type {
  IntelBundle,
  IntelEvent,
  LayerId,
  MapView,
  RegionId,
  SelectableFeature,
  TimeRange,
} from '@/types/intel'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export function useDashboard() {
  const initial = typeof window === 'undefined' ? defaultUrlState() : parseDashboardSearch(window.location.search)
  const [region, setRegionState] = useState<RegionId>(initial.region)
  const [timeRange, setTimeRangeState] = useState<TimeRange>(initial.timeRange)
  const [layers, setLayersState] = useState<LayerId[]>(initial.layers)
  const [view, setViewState] = useState<MapView>(initial.view)
  const [bundle, setBundle] = useState<IntelBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SelectableFeature | null>(null)
  const [query, setQuery] = useState('')
  const [newsSource, setNewsSource] = useState('all')
  const [livePlaying, setLivePlaying] = useState(false)
  const [liveIndex, setLiveIndex] = useState(0)
  const skipUrlWrite = useRef(true)

  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    const next = await fetchIntelBundle({ timeRange })
    if (id !== requestId.current) return
    setBundle(next)
    setLoading(false)
  }, [timeRange])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (skipUrlWrite.current) {
      skipUrlWrite.current = false
      writeDashboardUrl({ region, timeRange, layers, view })
      return
    }
    const handle = window.setTimeout(() => {
      writeDashboardUrl({ region, timeRange, layers, view })
    }, 180)
    return () => window.clearTimeout(handle)
  }, [region, timeRange, layers, view])

  useEffect(() => {
    const onPop = () => {
      const parsed = parseDashboardSearch(window.location.search)
      applyParsed(parsed)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function applyParsed(parsed: DashboardUrlState) {
    setRegionState(parsed.region)
    setTimeRangeState(parsed.timeRange)
    setLayersState(parsed.layers)
    setViewState(parsed.view)
  }

  const events = bundle?.events ?? []
  const polygons = bundle?.polygons ?? []

  const visibleEvents = useMemo(
    () =>
      events.filter(
        (event) => layers.includes(event.layer) && isWithinTimeRange(event.occurredAt, timeRange),
      ),
    [events, layers, timeRange],
  )

  const visiblePolygons = useMemo(
    () =>
      polygons.filter(
        (polygon) => layers.includes(polygon.layer) && isWithinTimeRange(polygon.occurredAt, timeRange),
      ),
    [polygons, layers, timeRange],
  )

  const visibleNews = useMemo(() => {
    const items = (bundle?.news ?? []).filter((item) => isWithinTimeRange(item.occurredAt, timeRange))
    if (newsSource === 'all') return items
    return items.filter((item) => item.sourceId === newsSource)
  }, [bundle, timeRange, newsSource])

  const watchLevel = useMemo(() => {
    const live = visibleEvents.filter((event) => event.layer === 'natural' || event.layer === 'weather')
    if (live.some((event) => event.severity === 'critical')) return 4
    if (live.some((event) => event.severity === 'high')) return 3
    if (live.some((event) => event.severity === 'elevated')) return 2
    return live.length > 0 ? 1 : 2
  }, [visibleEvents])

  const hotspots = useMemo(() => {
    const rank: Record<string, number> = {
      critical: 0,
      high: 1,
      elevated: 2,
      watch: 3,
      info: 4,
    }
    return [...visibleEvents]
      .sort((a, b) => rank[a.severity] - rank[b.severity] || b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 6)
  }, [visibleEvents])

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return [] as IntelEvent[]
    return visibleEvents
      .filter((event) => {
        const hay = `${event.title} ${event.description} ${event.country ?? ''} ${event.layer}`.toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 8)
  }, [query, visibleEvents])

  const setRegion = (next: RegionId) => {
    setRegionState(next)
    setViewState({ ...REGION_VIEWS[next], pitch: view.pitch })
  }

  const setTimeRange = (next: TimeRange) => setTimeRangeState(next)

  const toggleLayer = (id: LayerId) => {
    const chip = LAYER_CHIPS.find((item) => item.id === id)
    if (!chip?.enabled) return
    setLayersState((current) =>
      current.includes(id) ? current.filter((layer) => layer !== id) : [...current, id],
    )
  }

  const setView = (next: MapView) => {
    setViewState((current) => (viewsAreClose(current, next) ? current : next))
  }

  const selectFeature = (feature: SelectableFeature | null) => {
    setSelected(feature)
    if (feature?.longitude != null && feature.latitude != null) {
      setViewState((current) => ({
        ...current,
        longitude: feature.longitude as number,
        latitude: feature.latitude as number,
        zoom: Math.max(current.zoom, 3.6),
      }))
    }
  }

  const selectEvent = (event: IntelEvent) => selectFeature(selectableFromEvent(event))

  const setMode3d = (on: boolean) => {
    setViewState((current) => ({ ...current, pitch: on ? 52 : 0 }))
  }

  const adjustZoom = (delta: number) => {
    setViewState((current) => ({
      ...current,
      zoom: Math.min(8, Math.max(1.1, current.zoom + delta)),
    }))
  }

  const resetView = () => {
    setViewState({ ...REGION_VIEWS[region], pitch: view.pitch })
  }

  return {
    region,
    timeRange,
    layers,
    view,
    bundle,
    loading,
    selected,
    query,
    newsSource,
    livePlaying,
    liveIndex,
    visibleEvents,
    visiblePolygons,
    visibleNews,
    hotspots,
    searchHits,
    lastUpdated: bundle?.generatedAt ?? null,
    sources: bundle?.sources ?? [],
    watchLevel,
    setRegion,
    setTimeRange,
    toggleLayer,
    setView,
    setQuery,
    setNewsSource,
    setLivePlaying,
    setLiveIndex,
    selectFeature,
    selectEvent,
    setMode3d,
    adjustZoom,
    resetView,
    refresh: load,
  }
}

export type DashboardModel = ReturnType<typeof useDashboard>
