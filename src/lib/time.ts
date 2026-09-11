import type { TimeRange } from '@/types/intel'
import { TIME_RANGE_HOURS } from '@/data/catalog'

export function hoursAgo(hours: number, now = Date.now()): string {
  return new Date(now - hours * 3_600_000).toISOString()
}

export function minutesAgo(minutes: number, now = Date.now()): string {
  return new Date(now - minutes * 60_000).toISOString()
}

export function isWithinTimeRange(iso: string, range: TimeRange, now = Date.now()): boolean {
  if (range === 'all') return true
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return false
  return now - then <= TIME_RANGE_HOURS[range] * 3_600_000
}

export function formatUtcClock(date: Date): string {
  const weekday = date.toLocaleDateString('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  })
  const day = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
  return `${weekday.toUpperCase()}, ${day.toUpperCase()} ${time} UTC`
}

export function formatRelative(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'unknown'
  const delta = Math.max(0, now - then)
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function formatAbsolute(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC'
}
