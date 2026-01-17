const RECENT_SEARCHES_KEY = 'qt_recent_searches_v1'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadRecentSearches(): string[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v) => typeof v === 'string' && v.trim().length > 0).slice(0, 12)
  } catch {
    return []
  }
}

export function saveRecentSearches(values: string[]): void {
  if (!isBrowser()) return
  try {
    const unique: string[] = []
    const seen = new Set<string>()
    for (const v of values) {
      const next = (v || '').trim()
      if (!next) continue
      const key = next.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(next)
      if (unique.length >= 12) break
    }
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(unique))
  } catch {
    // ignore
  }
}

export function addRecentSearch(query: string, options?: { max?: number }): string[] {
  const max = typeof options?.max === 'number' ? options.max : 8
  const q = query.trim()
  if (!q) return loadRecentSearches()

  const current = loadRecentSearches()
  const next = [q, ...current.filter((v) => v.toLowerCase() !== q.toLowerCase())].slice(0, max)
  saveRecentSearches(next)
  return next
}

export function clearRecentSearches(): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch {
    // ignore
  }
}
