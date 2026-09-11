import type { StyleSpecification } from 'maplibre-gl'
import { createGraticule } from './graticule'

export const SIGNALMAP_STYLE: StyleSpecification = {
  version: 8,
  name: 'SignalMap Light',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    countries: {
      type: 'geojson',
      data: '/data/countries-110m.geojson',
    },
    graticule: {
      type: 'geojson',
      data: createGraticule(10),
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#d7e6f2' },
    },
    {
      id: 'graticule',
      type: 'line',
      source: 'graticule',
      paint: {
        'line-color': '#c3d4e3',
        'line-width': 0.7,
        'line-opacity': 0.9,
      },
    },
    {
      id: 'land',
      type: 'fill',
      source: 'countries',
      paint: {
        'fill-color': '#efe6d2',
        'fill-outline-color': '#ddd2bb',
      },
    },
    {
      id: 'borders',
      type: 'line',
      source: 'countries',
      paint: {
        'line-color': '#d5c9b0',
        'line-width': 0.6,
      },
    },
  ],
}
