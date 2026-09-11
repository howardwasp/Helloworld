import type { MapView } from '@/types/intel'

export function worldScale(zoom: number): number {
  return (256 * 2 ** zoom) / 360
}

export function project(
  lng: number,
  lat: number,
  view: MapView,
  width: number,
  height: number,
): [number, number] {
  const scale = worldScale(view.zoom)
  return [width / 2 + (lng - view.longitude) * scale, height / 2 - (lat - view.latitude) * scale]
}

export function unproject(
  x: number,
  y: number,
  view: MapView,
  width: number,
  height: number,
): [number, number] {
  const scale = worldScale(view.zoom)
  return [view.longitude + (x - width / 2) / scale, view.latitude - (y - height / 2) / scale]
}

export function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersects) inside = !inside
  }
  return inside
}
