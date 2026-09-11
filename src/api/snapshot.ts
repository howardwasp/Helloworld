import type { IntelEvent, IntelPolygon, Severity } from '@/types/intel'

export interface SnapshotEvent {
  id: string
  title: string
  description: string
  severity: Severity
  occurredAt: string
  longitude: number
  latitude: number
  country?: string
  url?: string
  label?: string
  source?: string
}

export interface SnapshotPolygon {
  id: string
  title: string
  description: string
  severity: Severity
  occurredAt: string
  rings: number[][][]
  country?: string
  url?: string
  source?: string
}

export interface SnapshotBundle {
  generatedAt?: string
  events?: SnapshotEvent[]
  polygons?: SnapshotPolygon[]
}

export function snapshotToEvents(
  items: SnapshotEvent[] | undefined,
  layer: IntelEvent['layer'],
  fallbackSource: string,
): IntelEvent[] {
  return (items ?? []).map((item) => ({
    ...item,
    layer,
    source: item.source ?? fallbackSource,
  }))
}

export function snapshotToPolygons(
  items: SnapshotPolygon[] | undefined,
  layer: IntelPolygon['layer'],
  fallbackSource: string,
): IntelPolygon[] {
  return (items ?? []).map((item) => ({
    ...item,
    layer,
    source: item.source ?? fallbackSource,
  }))
}
