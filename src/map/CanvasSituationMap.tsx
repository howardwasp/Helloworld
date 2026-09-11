import { SEVERITY_COLORS } from '@/data/catalog'
import { eachPolygonRing, loadCountries } from '@/map/countries'
import { pointInRing, project, unproject } from '@/map/project'
import type { IntelEvent, IntelPolygon, MapView, SelectableFeature } from '@/types/intel'
import { selectableFromEvent } from '@/map/geo'
import type { FeatureCollection } from 'geojson'
import { useEffect, useRef } from 'react'

interface CanvasSituationMapProps {
  events: IntelEvent[]
  polygons: IntelPolygon[]
  view: MapView
  selectedId: string | null
  onViewChange: (view: MapView) => void
  onSelect: (feature: SelectableFeature | null) => void
}

export function CanvasSituationMap({
  events,
  polygons,
  view,
  selectedId,
  onViewChange,
  onSelect,
}: CanvasSituationMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const countriesRef = useRef<FeatureCollection | null>(null)
  const viewRef = useRef(view)
  const eventsRef = useRef(events)
  const polygonsRef = useRef(polygons)
  const selectedRef = useRef(selectedId)
  const dragRef = useRef<{ x: number; y: number; lng: number; lat: number } | null>(null)
  const onViewChangeRef = useRef(onViewChange)
  const onSelectRef = useRef(onSelect)

  if (!dragRef.current) viewRef.current = view
  eventsRef.current = events
  polygonsRef.current = polygons
  selectedRef.current = selectedId
  onViewChangeRef.current = onViewChange
  onSelectRef.current = onSelect

  useEffect(() => {
    let cancelled = false
    void loadCountries().then((data) => {
      if (cancelled) return
      countriesRef.current = data
      paint()
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    paint()
  }, [events, polygons, view, selectedId])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(() => paint())
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  function paint() {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    const width = wrap.clientWidth
    const height = wrap.clientHeight
    if (width < 2 || height < 2) return
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawScene(ctx, width, height, viewRef.current, countriesRef.current, polygonsRef.current, eventsRef.current, selectedRef.current)
  }

  function clientPoint(event: { clientX: number; clientY: number }): [number, number] {
    const canvas = canvasRef.current
    if (!canvas) return [0, 0]
    const rect = canvas.getBoundingClientRect()
    return [event.clientX - rect.left, event.clientY - rect.top]
  }

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
      style={{
        background: '#d7e6f2',
        transform: view.pitch > 10 ? `perspective(1100px) rotateX(${Math.min(view.pitch, 52) * 0.28}deg)` : undefined,
        transformOrigin: 'center bottom',
      }}
    >
      <div className="pointer-events-none absolute bottom-1 right-2 z-10 text-[10px] text-[#6d675c]">
        Land © Natural Earth · Demo intel (mock)
      </div>
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        onPointerDown={(event) => {
          dragRef.current = {
            x: event.clientX,
            y: event.clientY,
            lng: viewRef.current.longitude,
            lat: viewRef.current.latitude,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          if (!drag) return
          const scale = (256 * 2 ** viewRef.current.zoom) / 360
          viewRef.current = {
            ...viewRef.current,
            longitude: drag.lng - (event.clientX - drag.x) / scale,
            latitude: clampLat(drag.lat + (event.clientY - drag.y) / scale),
          }
          paint()
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current
          dragRef.current = null
          if (!drag) return
          const moved = Math.hypot(event.clientX - drag.x, event.clientY - drag.y)
          if (moved < 5) {
            const canvas = canvasRef.current
            if (!canvas) return
            const [x, y] = clientPoint(event.nativeEvent)
            const hit = hitTest(x, y, viewRef.current, canvas.clientWidth, canvas.clientHeight, eventsRef.current, polygonsRef.current)
            onSelectRef.current(hit)
          }
          onViewChangeRef.current(viewRef.current)
        }}
        onWheel={(event) => {
          event.preventDefault()
          const canvas = canvasRef.current
          if (!canvas) return
          const [x, y] = clientPoint(event)
          const before = unproject(x, y, viewRef.current, canvas.clientWidth, canvas.clientHeight)
          const nextZoom = Math.min(8, Math.max(1.1, viewRef.current.zoom + (event.deltaY > 0 ? -0.25 : 0.25)))
          const nextView = { ...viewRef.current, zoom: nextZoom }
          const after = unproject(x, y, nextView, canvas.clientWidth, canvas.clientHeight)
          viewRef.current = {
            ...nextView,
            longitude: nextView.longitude - (after[0] - before[0]),
            latitude: clampLat(nextView.latitude - (after[1] - before[1])),
          }
          paint()
          onViewChangeRef.current(viewRef.current)
        }}
      />
    </div>
  )
}

function clampLat(lat: number): number {
  return Math.max(-80, Math.min(80, lat))
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: MapView,
  countries: FeatureCollection | null,
  polygons: IntelPolygon[],
  events: IntelEvent[],
  selectedId: string | null,
) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#d7e6f2'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#c3d4e3'
  ctx.lineWidth = 0.7
  for (let lng = -180; lng <= 180; lng += 10) {
    const [x1, y1] = project(lng, -80, view, width, height)
    const [x2, y2] = project(lng, 80, view, width, height)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  for (let lat = -80; lat <= 80; lat += 10) {
    const [x1, y1] = project(-180, lat, view, width, height)
    const [x2, y2] = project(180, lat, view, width, height)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  if (countries) {
    ctx.fillStyle = '#efe6d2'
    ctx.strokeStyle = '#d5c9b0'
    ctx.lineWidth = 0.6
    for (const feature of countries.features) {
      if (!feature.geometry) continue
      ctx.beginPath()
      eachPolygonRing(feature.geometry, (ring) => traceRing(ctx, ring, view, width, height))
      ctx.fill()
      ctx.stroke()
    }
  }

  for (const polygon of polygons) {
    ctx.beginPath()
    polygon.rings.forEach((ring) => traceRing(ctx, ring, view, width, height))
    ctx.fillStyle = hexAlpha(SEVERITY_COLORS[polygon.severity], 0.18)
    ctx.fill()
    ctx.setLineDash([4, 3])
    ctx.strokeStyle = SEVERITY_COLORS[polygon.severity]
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.setLineDash([])
  }

  for (const event of events) {
    const [x, y] = project(event.longitude, event.latitude, view, width, height)
    if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue
    const selected = event.id === selectedId
    const radius = event.magnitude ? 5 + event.magnitude * 0.45 : 6
    ctx.beginPath()
    ctx.arc(x, y, radius + 5, 0, Math.PI * 2)
    ctx.fillStyle = hexAlpha(SEVERITY_COLORS[event.severity], 0.16)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = SEVERITY_COLORS[event.severity]
    ctx.fill()
    ctx.lineWidth = selected ? 2.2 : 1.4
    ctx.strokeStyle = selected ? '#1f1f1f' : '#fff8ee'
    ctx.stroke()
    if (event.label) {
      ctx.font = '600 10px "IBM Plex Sans", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.lineWidth = 3
      ctx.strokeStyle = '#f4efe4'
      ctx.strokeText(event.label, x, y + radius + 3)
      ctx.fillStyle = '#5a5040'
      ctx.fillText(event.label, x, y + radius + 3)
    }
  }
}

function traceRing(
  ctx: CanvasRenderingContext2D,
  ring: number[][],
  view: MapView,
  width: number,
  height: number,
) {
  ring.forEach(([lng, lat], index) => {
    const [x, y] = project(lng, lat, view, width, height)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
}

function hexAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function hitTest(
  x: number,
  y: number,
  view: MapView,
  width: number,
  height: number,
  events: IntelEvent[],
  polygons: IntelPolygon[],
): SelectableFeature | null {
  let best: { event: IntelEvent; dist: number } | null = null
  for (const event of events) {
    const [px, py] = project(event.longitude, event.latitude, view, width, height)
    const dist = Math.hypot(px - x, py - y)
    const threshold = (event.magnitude ? 8 + event.magnitude : 10) + 4
    if (dist <= threshold && (!best || dist < best.dist)) best = { event, dist }
  }
  if (best) return selectableFromEvent(best.event)

  const [lng, lat] = unproject(x, y, view, width, height)
  for (let i = polygons.length - 1; i >= 0; i -= 1) {
    const polygon = polygons[i]
    const outer = polygon.rings[0]
    if (outer && pointInRing(lng, lat, outer)) {
      return {
        id: polygon.id,
        kind: 'polygon',
        layer: polygon.layer,
        title: polygon.title,
        description: polygon.description,
        severity: polygon.severity,
        source: polygon.source,
        occurredAt: polygon.occurredAt,
        country: polygon.country,
        longitude: lng,
        latitude: lat,
      }
    }
  }
  return null
}
