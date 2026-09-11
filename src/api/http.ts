/** Browser-safe JSON fetch with timeout, in-memory cache, and stale fallback. */

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'FetchError'
  }
}

interface CacheEntry {
  data: unknown
  expires: number
}

const cache = new Map<string, CacheEntry>()

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_TTL_MS = 5 * 60_000

export function cacheKey(url: string, extra = ''): string {
  return extra ? `${url}::${extra}` : url
}

export async function fetchJson<T>(
  url: string,
  options: {
    timeoutMs?: number
    cacheTtlMs?: number
    headers?: Record<string, string>
    cacheAs?: string
  } = {},
): Promise<T> {
  const key = options.cacheAs ?? url
  const ttl = options.cacheTtlMs ?? DEFAULT_TTL_MS
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) {
    return hit.data as T
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: options.headers,
    })
    if (!response.ok) {
      throw new FetchError(`HTTP ${response.status} for ${url}`, response.status)
    }
    const data = (await response.json()) as T
    cache.set(key, { data, expires: Date.now() + ttl })
    return data
  } catch (error) {
    if (hit) return hit.data as T
    if (error instanceof FetchError) throw error
    const message = error instanceof Error ? error.message : 'Network error'
    throw new FetchError(message)
  } finally {
    window.clearTimeout(timer)
  }
}

export async function tryFetchJson<T>(
  url: string,
  options?: Parameters<typeof fetchJson>[1],
): Promise<T | null> {
  try {
    return await fetchJson<T>(url, options)
  } catch {
    return null
  }
}

export async function fetchBuffer(
  url: string,
  options: {
    timeoutMs?: number
    cacheTtlMs?: number
    headers?: Record<string, string>
    cacheAs?: string
  } = {},
): Promise<ArrayBuffer> {
  const key = options.cacheAs ?? `buf:${url}`
  const ttl = options.cacheTtlMs ?? DEFAULT_TTL_MS
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) {
    return hit.data as ArrayBuffer
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: options.headers,
    })
    if (!response.ok) {
      throw new FetchError(`HTTP ${response.status} for ${url}`, response.status)
    }
    const data = await response.arrayBuffer()
    cache.set(key, { data, expires: Date.now() + ttl })
    return data
  } catch (error) {
    if (hit) return hit.data as ArrayBuffer
    if (error instanceof FetchError) throw error
    const message = error instanceof Error ? error.message : 'Network error'
    throw new FetchError(message)
  } finally {
    window.clearTimeout(timer)
  }
}

export async function tryFetchBuffer(
  url: string,
  options?: Parameters<typeof fetchBuffer>[1],
): Promise<ArrayBuffer | null> {
  try {
    return await fetchBuffer(url, options)
  } catch {
    return null
  }
}

export async function tryFetchText(
  url: string,
  options: { timeoutMs?: number; cacheTtlMs?: number } = {},
): Promise<string | null> {
  const key = `text:${url}`
  const ttl = options.cacheTtlMs ?? DEFAULT_TTL_MS
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) {
    return hit.data as string
  }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    const data = await response.text()
    cache.set(key, { data, expires: Date.now() + ttl })
    return data
  } catch {
    return hit ? (hit.data as string) : null
  } finally {
    window.clearTimeout(timer)
  }
}
