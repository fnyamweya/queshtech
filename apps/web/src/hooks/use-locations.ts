import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'

type ApiLike = any

function extractList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload
  const p: any = payload as any
  if (Array.isArray(p?.data)) return p.data
  if (Array.isArray(p?.items)) return p.items
  if (Array.isArray(p?.results)) return p.results
  if (Array.isArray(p?.data?.items)) return p.data.items
  return []
}

export type LocationOption = {
  id: string
  code: string
  name: string
  parentId?: string | null
  countryCode?: string | null
}

function toLocation(raw: ApiLike, fallbackParentId?: string | null): LocationOption | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id ?? raw._id ?? '').trim()
  const code = String(raw.code ?? raw.locationId ?? raw.key ?? id).trim()
  const name = String(raw.name ?? raw.label ?? raw.displayName ?? code).trim()
  if (!code) return null

  const parentId = String(raw.parentId ?? raw.parent?.id ?? raw.parent?._id ?? fallbackParentId ?? '').trim() || null
  const countryCode =
    String(
      raw.countryCode ??
        raw.country?.code ??
        raw.country?.iso2 ??
        raw.address?.countryCode ??
        raw.address?.country ??
        ''
    ).trim() || null

  return {
    id: id || code,
    code,
    name: name || code,
    parentId,
    countryCode,
  }
}

function getChildren(raw: ApiLike): any[] {
  if (!raw || typeof raw !== 'object') return []
  if (Array.isArray(raw.children)) return raw.children
  if (Array.isArray(raw.childLocations)) return raw.childLocations
  if (Array.isArray(raw.subLocations)) return raw.subLocations
  if (Array.isArray(raw.nodes)) return raw.nodes
  if (Array.isArray(raw.items)) return raw.items
  return []
}

function flattenLocations(rawList: any[], parentId?: string | null): LocationOption[] {
  const out: LocationOption[] = []
  for (const raw of rawList) {
    const loc = toLocation(raw, parentId ?? null)
    if (loc) out.push(loc)
    const children = getChildren(raw)
    if (children.length) {
      out.push(...flattenLocations(children, loc?.id ?? parentId ?? null))
    }
  }
  return out
}

export function useLocations(options?: { token?: string | null }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get<any>(endpoints.locations.list())
      const rootList = extractList(payload)
      const flattened = flattenLocations(rootList)

      const byCode = new Map<string, LocationOption>()
      for (const l of flattened) {
        if (!l?.code) continue
        if (!byCode.has(l.code)) byCode.set(l.code, l)
      }

      const list = Array.from(byCode.values())
      list.sort((a, b) => a.name.localeCompare(b.name))
      setLocations(list)
    } catch (e: any) {
      setLocations([])
      setError(e?.message || 'Failed to load locations')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { locations, isLoading, error, refresh }
}
