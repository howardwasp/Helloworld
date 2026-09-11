import type { Severity } from '@/types/intel'

/** US state / territory centroids for NWS alerts that omit polygons. */
export const US_STATE_CENTROIDS: Record<string, { longitude: number; latitude: number; name: string }> =
  {
    AL: { longitude: -86.9, latitude: 32.8, name: 'Alabama' },
    AK: { longitude: -152.4, latitude: 64.2, name: 'Alaska' },
    AZ: { longitude: -111.6, latitude: 34.3, name: 'Arizona' },
    AR: { longitude: -92.4, latitude: 34.9, name: 'Arkansas' },
    CA: { longitude: -119.4, latitude: 37.2, name: 'California' },
    CO: { longitude: -105.5, latitude: 39.0, name: 'Colorado' },
    CT: { longitude: -72.7, latitude: 41.6, name: 'Connecticut' },
    DE: { longitude: -75.5, latitude: 39.0, name: 'Delaware' },
    DC: { longitude: -77.0, latitude: 38.9, name: 'District of Columbia' },
    FL: { longitude: -81.8, latitude: 28.1, name: 'Florida' },
    GA: { longitude: -83.4, latitude: 32.7, name: 'Georgia' },
    HI: { longitude: -157.5, latitude: 20.8, name: 'Hawaii' },
    ID: { longitude: -114.7, latitude: 44.4, name: 'Idaho' },
    IL: { longitude: -89.2, latitude: 40.0, name: 'Illinois' },
    IN: { longitude: -86.3, latitude: 39.9, name: 'Indiana' },
    IA: { longitude: -93.5, latitude: 42.1, name: 'Iowa' },
    KS: { longitude: -98.3, latitude: 38.5, name: 'Kansas' },
    KY: { longitude: -84.9, latitude: 37.8, name: 'Kentucky' },
    LA: { longitude: -91.8, latitude: 31.1, name: 'Louisiana' },
    ME: { longitude: -69.2, latitude: 45.3, name: 'Maine' },
    MD: { longitude: -76.7, latitude: 39.1, name: 'Maryland' },
    MA: { longitude: -71.8, latitude: 42.3, name: 'Massachusetts' },
    MI: { longitude: -85.4, latitude: 44.3, name: 'Michigan' },
    MN: { longitude: -94.3, latitude: 46.0, name: 'Minnesota' },
    MS: { longitude: -89.7, latitude: 32.7, name: 'Mississippi' },
    MO: { longitude: -92.5, latitude: 38.4, name: 'Missouri' },
    MT: { longitude: -110.4, latitude: 47.1, name: 'Montana' },
    NE: { longitude: -99.8, latitude: 41.5, name: 'Nebraska' },
    NV: { longitude: -116.6, latitude: 39.3, name: 'Nevada' },
    NH: { longitude: -71.6, latitude: 43.7, name: 'New Hampshire' },
    NJ: { longitude: -74.6, latitude: 40.2, name: 'New Jersey' },
    NM: { longitude: -106.1, latitude: 34.4, name: 'New Mexico' },
    NY: { longitude: -75.5, latitude: 43.0, name: 'New York' },
    NC: { longitude: -79.4, latitude: 35.6, name: 'North Carolina' },
    ND: { longitude: -100.5, latitude: 47.5, name: 'North Dakota' },
    OH: { longitude: -82.8, latitude: 40.3, name: 'Ohio' },
    OK: { longitude: -97.5, latitude: 35.6, name: 'Oklahoma' },
    OR: { longitude: -120.6, latitude: 44.0, name: 'Oregon' },
    PA: { longitude: -77.6, latitude: 40.9, name: 'Pennsylvania' },
    RI: { longitude: -71.5, latitude: 41.7, name: 'Rhode Island' },
    SC: { longitude: -80.9, latitude: 33.9, name: 'South Carolina' },
    SD: { longitude: -100.2, latitude: 44.4, name: 'South Dakota' },
    TN: { longitude: -86.3, latitude: 35.8, name: 'Tennessee' },
    TX: { longitude: -99.3, latitude: 31.5, name: 'Texas' },
    UT: { longitude: -111.7, latitude: 39.3, name: 'Utah' },
    VT: { longitude: -72.7, latitude: 44.1, name: 'Vermont' },
    VA: { longitude: -78.2, latitude: 37.5, name: 'Virginia' },
    WA: { longitude: -120.8, latitude: 47.4, name: 'Washington' },
    WV: { longitude: -80.6, latitude: 38.6, name: 'West Virginia' },
    WI: { longitude: -89.8, latitude: 44.6, name: 'Wisconsin' },
    WY: { longitude: -107.6, latitude: 43.0, name: 'Wyoming' },
    PR: { longitude: -66.4, latitude: 18.2, name: 'Puerto Rico' },
    VI: { longitude: -64.8, latitude: 18.3, name: 'U.S. Virgin Islands' },
    GU: { longitude: 144.8, latitude: 13.4, name: 'Guam' },
    AS: { longitude: -170.7, latitude: -14.3, name: 'American Samoa' },
    MP: { longitude: 145.7, latitude: 15.2, name: 'Northern Mariana Islands' },
  }

export function firstStateFromArea(areaDesc: string | undefined): {
  code: string
  longitude: number
  latitude: number
  name: string
} | null {
  if (!areaDesc) return null
  const matches = areaDesc.matchAll(/,\s*([A-Z]{2})\b/g)
  for (const match of matches) {
    const code = match[1]
    const hit = US_STATE_CENTROIDS[code]
    if (hit) return { code, ...hit }
  }
  return null
}

export function centroidOfRings(rings: number[][][]): { longitude: number; latitude: number } | null {
  const ring = rings[0]
  if (!ring || ring.length < 3) return null
  const pts = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring
  if (pts.length === 0) return null
  let lon = 0
  let lat = 0
  for (const [x, y] of pts) {
    lon += x
    lat += y
  }
  return { longitude: lon / pts.length, latitude: lat / pts.length }
}

export function ringsFromGeometry(geometry: {
  type: string
  coordinates: unknown
} | null): number[][][] | null {
  if (!geometry) return null
  if (geometry.type === 'Polygon') {
    return geometry.coordinates as number[][][]
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as number[][][][]
    if (!polys.length) return null
    return polys.reduce((best, poly) => ((poly[0]?.length ?? 0) > (best[0]?.length ?? 0) ? poly : best))
  }
  return null
}

export function magnitudeSeverity(mag: number): Severity {
  if (mag >= 7) return 'critical'
  if (mag >= 6) return 'high'
  if (mag >= 5) return 'elevated'
  if (mag >= 4) return 'watch'
  return 'info'
}

export function nwsSeverity(value: string | undefined): Severity {
  const key = (value ?? '').toLowerCase()
  if (key === 'extreme') return 'critical'
  if (key === 'severe') return 'high'
  if (key === 'moderate') return 'elevated'
  if (key === 'minor') return 'watch'
  return 'info'
}

export function countryFromUsgsPlace(place: string | undefined): string | undefined {
  if (!place) return undefined
  const parts = place.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.at(-1)
}

export function regionFromLonLat(longitude: number, latitude: number): string {
  if (longitude <= -25 && longitude >= -170 && latitude >= -60 && latitude <= 75) return 'Americas'
  if (longitude >= -25 && longitude <= 45 && latitude >= 35) return 'Europe'
  if (longitude >= 25 && latitude >= -15) return 'Asia'
  return 'Global'
}

export function clipText(value: string, max = 360): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trim()}…`
}
