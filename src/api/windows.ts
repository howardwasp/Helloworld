import { TIME_RANGE_HOURS } from '@/data/catalog'
import type { TimeRange } from '@/types/intel'

export interface QueryWindow {
  startIso: string
  endIso: string
  hours: number
  minMagnitude: number
  limit: number
}

/** Map the dashboard time chips onto USGS query windows. */
export function queryWindow(range: TimeRange, now = Date.now()): QueryWindow {
  const hours = range === 'all' ? 24 * 30 : TIME_RANGE_HOURS[range]
  const minMagnitude =
    range === '1h' || range === '6h' ? 2.5 : range === '24h' ? 3.5 : range === '48h' ? 4.0 : 4.5
  const limit = range === '1h' || range === '6h' || range === '24h' ? 250 : 400
  return {
    startIso: new Date(now - hours * 3_600_000).toISOString(),
    endIso: new Date(now).toISOString(),
    hours,
    minMagnitude,
    limit,
  }
}

export function startMs(range: TimeRange, now = Date.now()): number {
  if (range === 'all') return 0
  return now - TIME_RANGE_HOURS[range] * 3_600_000
}
