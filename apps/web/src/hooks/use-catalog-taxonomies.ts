import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Taxonomy } from '@/types'
import { endpoints } from '@/lib/endpoints'
import { createApiClient } from '@/lib/api-client'

type ApiTaxonomyLike = any

type TaxonomyInput = {
  code: string
  name: string
  description?: string
  isDefault?: boolean
  isActive?: boolean
  icon?: string
  imageUrl?: string
  avatarUrl?: string
}

function toTaxonomy(raw: ApiTaxonomyLike): Taxonomy | null {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id || raw._id || '').trim()
  const code = String(raw.code || raw.key || '').trim()
  const name = String(raw.name || raw.title || '').trim()

  if (!id || !code || !name) return null

  return {
    id,
    code,
    name,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    isDefault: typeof raw.isDefault === 'boolean' ? raw.isDefault : undefined,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : undefined,
    icon: typeof raw.icon === 'string' ? raw.icon : undefined,
    imageUrl:
      typeof raw.imageUrl === 'string'
        ? raw.imageUrl
        : typeof raw.image_url === 'string'
          ? raw.image_url
          : typeof raw.image === 'string'
            ? raw.image
            : undefined,
    avatarUrl:
      typeof raw.avatarUrl === 'string'
        ? raw.avatarUrl
        : typeof raw.avatar_url === 'string'
          ? raw.avatar_url
          : typeof raw.avatar === 'string'
            ? raw.avatar
            : undefined,
  }
}

function extractList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload
  const p: any = payload as any
  if (Array.isArray(p?.data)) return p.data
  if (Array.isArray(p?.items)) return p.items
  if (Array.isArray(p?.results)) return p.results
  if (Array.isArray(p?.data?.items)) return p.data.items
  return []
}

function uniqueByCode(items: Taxonomy[]): Taxonomy[] {
  const seen = new Set<string>()
  const out: Taxonomy[] = []
  for (const t of items) {
    if (seen.has(t.code)) continue
    seen.add(t.code)
    out.push(t)
  }
  return out
}

export function useCatalogTaxonomies(options?: { token?: string | null }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])

  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const next = uniqueByCode(
        extractList(await api.get(endpoints.catalog.taxonomies))
          .map(toTaxonomy)
          .filter(Boolean) as Taxonomy[]
      )
      setTaxonomies(next)
    } catch (e: any) {
      setTaxonomies([])
      setError(e?.message || 'Failed to load taxonomies')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createTaxonomy = useCallback(
    async (input: TaxonomyInput) => {
      const payload = await api.post(endpoints.catalog.taxonomies, {
        code: input.code,
        name: input.name,
        description: input.description,
        isDefault: input.isDefault,
        isActive: input.isActive,
        icon: input.icon,
        imageUrl: input.imageUrl,
        avatarUrl: input.avatarUrl,
      })

      const created = toTaxonomy(payload as any)
      if (created) setTaxonomies((prev) => uniqueByCode([created, ...prev]))
      return created
    },
    [api]
  )

  const updateTaxonomy = useCallback(
    async (id: string, patch: Partial<TaxonomyInput>) => {
      const payload = await api.patch(endpoints.catalog.taxonomyById(id), patch)
      const updated = toTaxonomy(payload as any)
      if (!updated) return null
      setTaxonomies((prev) => uniqueByCode(prev.map((t) => (t.id === id ? updated : t))))
      return updated
    },
    [api]
  )

  const deleteTaxonomy = useCallback(
    async (id: string) => {
      await api.delete(endpoints.catalog.taxonomyById(id))
      setTaxonomies((prev) => prev.filter((t) => t.id !== id))
    },
    [api]
  )

  return {
    taxonomies,
    isLoading,
    error,
    refresh,
    createTaxonomy,
    updateTaxonomy,
    deleteTaxonomy,
  }
}
