import { eventsToGeoJSON, featureFromProps, polygonsToGeoJSON } from '@/map/geo'
import { SIGNALMAP_STYLE } from '@/map/style'
import type { IntelEvent, IntelPolygon, MapView, SelectableFeature } from '@/types/intel'
import maplibregl from 'maplibre-gl'
import { useEffect, useRef } from 'react'

const POINT_LAYER = 'intel-points'
const POINT_HALO = 'intel-points-halo'
const POINT_LABELS = 'intel-labels'
const POLY_FILL = 'intel-poly-fill'
const POLY_LINE = 'intel-poly-line'

interface SituationMapProps {
  events: IntelEvent[]
  polygons: IntelPolygon[]
  view: MapView
  selectedId: string | null
  onViewChange: (view: MapView) => void
  onSelect: (feature: SelectableFeature | null) => void
}

export function SituationMap({
  events,
  polygons,
  view,
  selectedId,
  onViewChange,
  onSelect,
}: SituationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const readyRef = useRef(false)
  const onViewChangeRef = useRef(onViewChange)
  const onSelectRef = useRef(onSelect)
  const applyingView = useRef(false)
  const eventsRef = useRef(events)
  const polygonsRef = useRef(polygons)

  onViewChangeRef.current = onViewChange
  onSelectRef.current = onSelect
  eventsRef.current = events
  polygonsRef.current = polygons

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SIGNALMAP_STYLE,
      center: [view.longitude, view.latitude],
      zoom: view.zoom,
      pitch: view.pitch,
      attributionControl: false,
      dragRotate: false,
    })
    mapRef.current = map

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Land © Natural Earth · Demo intel (mock)',
      }),
      'bottom-right',
    )

    map.on('load', () => {
      map.addSource('intel-events', {
        type: 'geojson',
        data: eventsToGeoJSON(eventsRef.current),
      })
      map.addSource('intel-polygons', {
        type: 'geojson',
        data: polygonsToGeoJSON(polygonsRef.current),
      })

      map.addLayer({
        id: POLY_FILL,
        type: 'fill',
        source: 'intel-polygons',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.16,
        },
      })
      map.addLayer({
        id: POLY_LINE,
        type: 'line',
        source: 'intel-polygons',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.4,
          'line-dasharray': [1.6, 1.2],
        },
      })
      map.addLayer({
        id: POINT_HALO,
        type: 'circle',
        source: 'intel-events',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'magnitude'], 0],
            0,
            9,
            3,
            10,
            6,
            16,
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
          'circle-stroke-width': 0,
        },
      })
      map.addLayer({
        id: POINT_LAYER,
        type: 'circle',
        source: 'intel-events',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'magnitude'], 0],
            0,
            5.5,
            3,
            6,
            6,
            8.5,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'id'], selectedId ?? ''],
            '#1f1f1f',
            '#fff8ee',
          ],
          'circle-stroke-width': [
            'case',
            ['==', ['get', 'id'], selectedId ?? ''],
            2.2,
            1.4,
          ],
          'circle-opacity': 0.95,
        },
      })
      map.addLayer({
        id: POINT_LABELS,
        type: 'symbol',
        source: 'intel-events',
        filter: ['!=', ['get', 'label'], ''],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-offset': [0, 1.25],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#5a5040',
          'text-halo-color': '#f4efe4',
          'text-halo-width': 1.2,
        },
      })

      const pick = (e: maplibregl.MapMouseEvent) => {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: [POINT_LAYER, POLY_FILL],
        })
        if (!hits.length) {
          onSelectRef.current(null)
          return
        }
        const hit = hits[0]
        const coords =
          hit.geometry.type === 'Point'
            ? (hit.geometry.coordinates as [number, number])
            : ([e.lngLat.lng, e.lngLat.lat] as [number, number])
        onSelectRef.current(featureFromProps(hit.properties, coords))
      }

      map.on('click', pick)
      map.on('mouseenter', POINT_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', POINT_LAYER, () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('mouseenter', POLY_FILL, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', POLY_FILL, () => {
        map.getCanvas().style.cursor = ''
      })

      readyRef.current = true
    })

    const emitView = () => {
      if (applyingView.current) return
      const center = map.getCenter()
      onViewChangeRef.current({
        longitude: center.lng,
        latitude: center.lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
      })
    }

    map.on('moveend', emitView)
    map.on('pitchend', emitView)

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

    return () => {
      readyRef.current = false
      observer.disconnect()
      map.remove()
      mapRef.current = null
    }
    // Map is created once; view/data updates happen in later effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const eventsSource = map.getSource('intel-events') as maplibregl.GeoJSONSource | undefined
    const polySource = map.getSource('intel-polygons') as maplibregl.GeoJSONSource | undefined
    eventsSource?.setData(eventsToGeoJSON(events))
    polySource?.setData(polygonsToGeoJSON(polygons))
  }, [events, polygons])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current || !map.getLayer(POINT_LAYER)) return
    map.setPaintProperty(POINT_LAYER, 'circle-stroke-color', [
      'case',
      ['==', ['get', 'id'], selectedId ?? ''],
      '#1f1f1f',
      '#fff8ee',
    ])
    map.setPaintProperty(POINT_LAYER, 'circle-stroke-width', [
      'case',
      ['==', ['get', 'id'], selectedId ?? ''],
      2.2,
      1.4,
    ])
  }, [selectedId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const center = map.getCenter()
    const same =
      Math.abs(center.lng - view.longitude) < 0.008 &&
      Math.abs(center.lat - view.latitude) < 0.008 &&
      Math.abs(map.getZoom() - view.zoom) < 0.03 &&
      Math.abs(map.getPitch() - view.pitch) < 0.8
    if (same) return
    applyingView.current = true
    map.easeTo({
      center: [view.longitude, view.latitude],
      zoom: view.zoom,
      pitch: view.pitch,
      duration: 700,
    })
    const done = () => {
      applyingView.current = false
      map.off('moveend', done)
    }
    map.on('moveend', done)
  }, [view])

  return <div ref={containerRef} className="absolute inset-0" />
}
