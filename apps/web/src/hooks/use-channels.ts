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

export type ChannelOption = {
  id: string
  code: string
  name: string
  isActive?: boolean
}

function toChannel(raw: ApiLike): ChannelOption | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id ?? raw._id ?? '').trim()
  const code = String(raw.code ?? raw.slug ?? raw.key ?? id).trim()
  const name = String(raw.name ?? raw.title ?? code).trim()
  if (!code) return null
  return {
    id: id || code,
    code,
    name,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : typeof raw.active === 'boolean' ? raw.active : undefined,
  }
}

export function useChannels(options?: { token?: string | null }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])
  const [channels, setChannels] = useState<ChannelOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get<any>(endpoints.channels.base)
      const list = extractList(payload)
        .map(toChannel)
        .filter(Boolean) as ChannelOption[]
      list.sort((a, b) => a.name.localeCompare(b.name))
      setChannels(list)
    } catch (e: any) {
      setChannels([])
      setError(e?.message || 'Failed to load channels')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { channels, isLoading, error, refresh }
}
