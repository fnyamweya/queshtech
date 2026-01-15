import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category } from '@/types'
import { mockCategories } from '@/data/mock-data'
import { endpoints } from '@/lib/endpoints'
import { createApiClient } from '@/lib/api-client'

type ApiCategoryLike = any

function toCategory(raw: ApiCategoryLike): Category | null {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id || raw._id || raw.categoryId || raw.slug || raw.key || '').trim()
  const name = String(raw.name || raw.title || raw.translations?.[0]?.name || '').trim()
  const slug = String(raw.slug || raw.handle || raw.code || raw.key || '').trim()

  if (!id || !name || !slug) return null

  const parentIdRaw = raw.parentId ?? raw.parent_id ?? raw.parent?.id ?? raw.parent?._id
  const parentId = typeof parentIdRaw === 'string' && parentIdRaw.length > 0 ? parentIdRaw : undefined

  const productCountRaw = raw.productCount ?? raw.productsCount ?? raw.products_count
  const productCount = typeof productCountRaw === 'number' ? productCountRaw : undefined

  const icon = typeof raw.icon === 'string' ? raw.icon : undefined
  const imageUrl =
    typeof raw.imageUrl === 'string'
      ? raw.imageUrl
      : typeof raw.image_url === 'string'
        ? raw.image_url
        : typeof raw.image === 'string'
          ? raw.image
          : undefined
  const avatarUrl =
    typeof raw.avatarUrl === 'string'
      ? raw.avatarUrl
      : typeof raw.avatar_url === 'string'
        ? raw.avatar_url
        : typeof raw.avatar === 'string'
          ? raw.avatar
          : undefined

  return {
    id,
    name,
    slug,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    image: imageUrl,
    imageUrl,
    avatarUrl,
    icon,
    parentId,
    productCount,
  }
}

function extractList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload
  const p: any = payload as any
  if (Array.isArray(p?.data)) return p.data
  if (Array.isArray(p?.categories)) return p.categories
  if (Array.isArray(p?.data?.categories)) return p.data.categories
  return []
}

function uniqueBySlug(categories: Category[]): Category[] {
  const seen = new Set<string>()
  const result: Category[] = []
  for (const c of categories) {
    if (seen.has(c.slug)) continue
    seen.add(c.slug)
    result.push(c)
  }
  return result
}

export function useCatalogCategories(options?: {
  token?: string | null
  fallbackToMock?: boolean
}) {
  const fallbackToMock = options?.fallbackToMock ?? true

  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])

  const [categories, setCategories] = useState<Category[]>(fallbackToMock ? mockCategories : [])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const next = uniqueBySlug(
        extractList(await api.get(endpoints.catalog.categories))
          .map(toCategory)
          .filter(Boolean) as Category[]
      )

      if (next.length > 0) {
        setCategories(next)
      } else if (fallbackToMock) {
        setCategories(mockCategories)
      } else {
        setCategories([])
      }
    } catch (e: any) {
      if (fallbackToMock) {
        setCategories(mockCategories)
      } else {
        setCategories([])
      }
      setError(e?.message || 'Failed to load categories')
    } finally {
      setIsLoading(false)
    }
  }, [fallbackToMock, options?.token])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const createCategory = useCallback(
    async (input: {
      name: string
      slug: string
      taxonomyId?: string
      key?: string
      parentId?: string | null
      description?: string
      isActive?: boolean
      sortOrder?: number
      icon?: string
      imageUrl?: string
      avatarUrl?: string
      seoTitle?: string
      seoDescription?: string
      seoKeywords?: string[]
      locale?: string
    }) => {
      const taxonomyId = (input.taxonomyId || '').trim()
      const key = (input.key || '').trim()

      // Backward-compatible payload (older API shape)
      const legacyPayload = {
        name: input.name,
        slug: input.slug,
        parentId: input.parentId || undefined,
        description: input.description,
        icon: input.icon || undefined,
        imageUrl: input.imageUrl || undefined,
        avatarUrl: input.avatarUrl || undefined,
      }

      // Swagger-aligned payload (CreateCategoryDto)
      const dtoPayload = {
        taxonomyId,
        parentId: input.parentId || undefined,
        key: key || input.slug,
        slug: input.slug,
        isActive: typeof input.isActive === 'boolean' ? input.isActive : undefined,
        sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : undefined,
        icon: input.icon || undefined,
        imageUrl: input.imageUrl || undefined,
        avatarUrl: input.avatarUrl || undefined,
        translations: [
          {
            locale: (input.locale || 'en').trim() || 'en',
            name: input.name,
            description: input.description || undefined,
            seoTitle: input.seoTitle || undefined,
            seoDescription: input.seoDescription || undefined,
            seoKeywords: input.seoKeywords && input.seoKeywords.length > 0 ? input.seoKeywords : undefined,
          },
        ],
      }

      const payload = await api.post(
        endpoints.catalog.categories,
        taxonomyId ? dtoPayload : legacyPayload
      )

      const created = toCategory(payload as any)
      if (created) {
        setCategories(prev => uniqueBySlug([created, ...prev]))
      }
      return created
    },
    [api]
  )

  const bySlug = useMemo(() => {
    const map = new Map<string, Category>()
    for (const c of categories) map.set(c.slug, c)
    return map
  }, [categories])

  return {
    categories,
    bySlug,
    isLoading,
    error,
    refresh: fetchCategories,
    createCategory,
  }
}

export function usePublicCategories(options?: { page?: number; limit?: number; isActive?: boolean }) {
  const api = useMemo(() => createApiClient(), [])
  const params = useMemo(
    () => ({
      page: options?.page,
      limit: options?.limit,
      isActive: options?.isActive,
    }),
    [options?.isActive, options?.limit, options?.page]
  )

  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const next = uniqueBySlug(
        extractList(await api.get(endpoints.catalog.publicCategories(params)))
          .map(toCategory)
          .filter(Boolean) as Category[]
      )
      setCategories(next)
    } catch (e: any) {
      setCategories([])
      setError(e?.message || 'Failed to load categories')
    } finally {
      setIsLoading(false)
    }
  }, [api, params])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const bySlug = useMemo(() => {
    const map = new Map<string, Category>()
    for (const c of categories) map.set(c.slug, c)
    return map
  }, [categories])

  return {
    categories,
    bySlug,
    isLoading,
    error,
    refresh: fetchCategories,
  }
}
