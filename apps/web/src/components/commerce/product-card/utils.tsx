import type { ReactNode } from 'react'

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizeTerms(terms?: string[]): string[] {
  if (!terms || terms.length === 0) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of terms) {
    const t = String(raw || '').trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

export function splitTerms(query: string): string[] {
  return normalizeTerms(
    query
      .trim()
      .split(/\s+/g)
      .filter(Boolean)
  )
}

export function highlightTerms(text: string, terms: string[]): ReactNode {
  const normalized = normalizeTerms(terms)
  if (!text || normalized.length === 0) return text

  // Match longest terms first for more stable highlighting.
  const sorted = [...normalized].sort((a, b) => b.length - a.length)
  const lower = text.toLowerCase()

  // Build list of non-overlapping ranges.
  const ranges: Array<{ start: number; end: number }> = []
  for (const term of sorted) {
    const t = term.toLowerCase()
    if (!t) continue
    let idx = 0
    while (idx < lower.length) {
      const at = lower.indexOf(t, idx)
      if (at < 0) break
      const start = at
      const end = at + t.length
      const overlaps = ranges.some((r) => !(end <= r.start || start >= r.end))
      if (!overlaps) ranges.push({ start, end })
      idx = at + t.length
    }
  }

  if (ranges.length === 0) return text
  ranges.sort((a, b) => a.start - b.start)

  const nodes: ReactNode[] = []
  let cursor = 0
  for (const r of ranges) {
    if (r.start > cursor) nodes.push(text.slice(cursor, r.start))
    nodes.push(
      <mark key={`${r.start}-${r.end}`} className="rounded bg-primary/10 px-1 text-foreground">
        {text.slice(r.start, r.end)}
      </mark>
    )
    cursor = r.end
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return <>{nodes}</>
}

export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia?.('(pointer: coarse)')?.matches ?? false
  } catch {
    return false
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  } catch {
    return false
  }
}

