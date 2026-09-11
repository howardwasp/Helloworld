import { LAYER_COLORS, SEVERITY_COLORS } from '@/data/catalog'
import type { ActiveLayerId, IntelEvent, IntelPolygon, SelectableFeature, Severity } from '@/types/intel'
import type { FeatureCollection, GeoJsonProperties, Point, Polygon } from 'geojson'

export function eventsToGeoJSON(events: IntelEvent[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: events.map((event) => ({
      type: 'Feature',
      id: event.id,
      properties: {
        id: event.id,
        kind: 'event',
        layer: event.layer,
        title: event.title,
        description: event.description,
        severity: event.severity,
        source: event.source,
        occurredAt: event.occurredAt,
        country: event.country ?? '',
        label: event.label ?? '',
        magnitude: event.magnitude ?? 0,
        url: event.url ?? '',
        color: SEVERITY_COLORS[event.severity],
        stroke: LAYER_COLORS[event.layer] ?? SEVERITY_COLORS[event.severity],
      },
      geometry: {
        type: 'Point',
        coordinates: [event.longitude, event.latitude],
      },
    })),
  }
}

export function polygonsToGeoJSON(polygons: IntelPolygon[]): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: polygons.map((polygon) => ({
      type: 'Feature',
      id: polygon.id,
      properties: {
        id: polygon.id,
        kind: 'polygon',
        layer: polygon.layer,
        title: polygon.title,
        description: polygon.description,
        severity: polygon.severity,
        source: polygon.source,
        occurredAt: polygon.occurredAt,
        country: polygon.country ?? '',
        url: polygon.url ?? '',
        color: SEVERITY_COLORS[polygon.severity],
      },
      geometry: {
        type: 'Polygon',
        coordinates: polygon.rings,
      },
    })),
  }
}

export function featureFromProps(
  props: GeoJsonProperties,
  coords?: [number, number],
): SelectableFeature | null {
  if (!props?.id || !props.title) return null
  return {
    id: String(props.id),
    kind: props.kind === 'polygon' ? 'polygon' : 'event',
    layer: props.layer as ActiveLayerId,
    title: String(props.title),
    description: String(props.description ?? ''),
    severity: props.severity as Severity,
    source: String(props.source ?? ''),
    occurredAt: String(props.occurredAt ?? ''),
    country: props.country ? String(props.country) : undefined,
    longitude: coords?.[0],
    latitude: coords?.[1],
    label: props.label ? String(props.label) : undefined,
    url: props.url ? String(props.url) : undefined,
  }
}

export function selectableFromEvent(event: IntelEvent): SelectableFeature {
  return {
    id: event.id,
    kind: 'event',
    layer: event.layer,
    title: event.title,
    description: event.description,
    severity: event.severity,
    source: event.source,
    occurredAt: event.occurredAt,
    country: event.country,
    longitude: event.longitude,
    latitude: event.latitude,
    label: event.label,
    url: event.url,
  }
}

