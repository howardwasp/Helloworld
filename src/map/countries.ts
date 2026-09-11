import { publicUrl } from '@/lib/publicUrl'
import type { FeatureCollection, Geometry } from 'geojson'

let cache: Promise<FeatureCollection> | null = null

export function loadCountries(): Promise<FeatureCollection> {
  if (!cache) {
    cache = fetch(publicUrl('data/countries-110m.geojson')).then((response) => {
      if (!response.ok) throw new Error('Failed to load country outlines')
      return response.json() as Promise<FeatureCollection>
    })
  }
  return cache
}

export function eachPolygonRing(geometry: Geometry, visit: (ring: number[][]) => void): void {
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(visit)
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => polygon.forEach(visit))
  }
}
