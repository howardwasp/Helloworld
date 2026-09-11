import type { Feature, FeatureCollection, LineString } from 'geojson'

export function createGraticule(step = 10): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = []

  for (let lng = -180; lng <= 180; lng += step) {
    features.push({
      type: 'Feature',
      properties: { kind: 'meridian', value: lng },
      geometry: {
        type: 'LineString',
        coordinates: [
          [lng, -85],
          [lng, 85],
        ],
      },
    })
  }

  for (let lat = -80; lat <= 80; lat += step) {
    const coordinates: [number, number][] = []
    for (let lng = -180; lng <= 180; lng += 5) {
      coordinates.push([lng, lat])
    }
    features.push({
      type: 'Feature',
      properties: { kind: 'parallel', value: lat },
      geometry: { type: 'LineString', coordinates },
    })
  }

  return { type: 'FeatureCollection', features }
}
