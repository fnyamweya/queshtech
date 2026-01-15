import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Brand } from '@/types'
import { endpoints } from '@/lib/endpoints'
import { createApiClient } from '@/lib/api-client'

type ApiBrandLike = any

type BrandInput = {
  code: string
  name: string
  description?: string
  isActive?: boolean
}

function toBrand(raw: ApiBrandLike): Brand | null {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id || raw._id || '').trim()
  // Backend commonly uses `slug` for the unique brand identifier.
  // We expose it as `code` in the UI for consistency across catalog modules.
  const code = String(raw.code || raw.slug || raw.key || '').trim()
  const name = String(raw.name || raw.title || '').trim()

  if (!id || !code || !name) return null

  return {
    id,
    code,
    name,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : undefined,
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

function uniqueByCode(items: Brand[]): Brand[] {
  const seen = new Set<string>()
  const out: Brand[] = []
  for (const b of items) {
    if (seen.has(b.code)) continue
    seen.add(b.code)
    out.push(b)
  }
  return out
}

export function useCatalogBrands(options?: { token?: string | null }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])

  const [brands, setBrands] = useState<Brand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const next = uniqueByCode(extractList(await api.get(endpoints.catalog.brands)).map(toBrand).filter(Boolean) as Brand[])
      setBrands(next)
    } catch (e: any) {
      setBrands([])
      setError(e?.message || 'Failed to load brands')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createBrand = useCallback(
    async (input: BrandInput) => {
      const payload = await api.post(endpoints.catalog.brands, {
        slug: input.code,
        name: input.name,
        description: input.description,
        isActive: input.isActive,
      })

      const created = toBrand(payload as any)
      if (created) setBrands((prev) => uniqueByCode([created, ...prev]))
      return created
    },
    [api]
  )

  const updateBrand = useCallback(
    async (id: string, patch: Partial<BrandInput>) => {
      const payload = await api.patch(endpoints.catalog.brandById(id), {
        ...(patch.code !== undefined ? { slug: patch.code } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      })
      const updated = toBrand(payload as any)
      if (!updated) return null
      setBrands((prev) => uniqueByCode(prev.map((b) => (b.id === id ? updated : b))))
      return updated
    },
    [api]
  )

  const deleteBrand = useCallback(
    async (id: string) => {
      await api.delete(endpoints.catalog.brandById(id))
      setBrands((prev) => prev.filter((b) => b.id !== id))
    },
    [api]
  )

  return {
    brands,
    isLoading,
    error,
    refresh,
    createBrand,
    updateBrand,
    deleteBrand,
  }
}
