import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import type { Product } from '@/types'
import type { CatalogCollection, CatalogCollectionProduct, CatalogCollectionType } from '@/types/catalog'
import { mapToProduct } from '@/lib/product-mapper'

function extractList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload
  const p: any = payload as any
  if (Array.isArray(p?.data)) return p.data
  if (Array.isArray(p?.items)) return p.items
  if (Array.isArray(p?.results)) return p.results
  if (Array.isArray(p?.data?.items)) return p.data.items
  return []
}

function toCatalogCollection(raw: any): CatalogCollection | null {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id || raw._id || raw.collectionId || raw.slug || raw.key || '').trim()
  const slug = String(raw.slug || raw.handle || raw.key || raw.id || '').trim()
  const name = String(raw.name || raw.title || raw.label || '').trim()

  if (!id) return null

  const sortOrderRaw = raw.sortOrder ?? raw.sort_order ?? raw.position ?? raw.priority ?? raw.order
  const sortOrder = typeof sortOrderRaw === 'number' ? sortOrderRaw : undefined

  const productsRaw = Array.isArray(raw.products)
    ? raw.products
    : Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.data?.products)
        ? raw.data.products
        : []

  const categoryIds = Array.isArray(raw.categoryIds ?? raw.categories)
    ? (raw.categoryIds ?? raw.categories).map((c: any) => String(c)).filter(Boolean)
    : undefined

  const productIds = Array.isArray(raw.productIds ?? raw.products)
    ? (raw.productIds ?? raw.products)
        .map((p: any) => (typeof p === 'string' || typeof p === 'number' ? String(p) : p?.id))
        .filter(Boolean)
    : undefined

  return {
    id,
    key: typeof raw.key === 'string' ? raw.key : undefined,
    slug: slug || undefined,
    handle: typeof raw.handle === 'string' ? raw.handle : slug || undefined,
    name: name || undefined,
    title: typeof raw.title === 'string' ? raw.title : name || undefined,
    type: (typeof raw.type === 'string' ? raw.type : raw.kind || raw.collectionType || undefined) as CatalogCollectionType,
    description: typeof raw.description === 'string' ? raw.description : raw.summary || undefined,
    icon: typeof raw.icon === 'string' ? raw.icon : undefined,
    avatarUrl:
      typeof raw.avatarUrl === 'string'
        ? raw.avatarUrl
        : typeof raw.avatar_url === 'string'
          ? raw.avatar_url
          : typeof raw.avatar === 'string'
            ? raw.avatar
            : undefined,
    imageUrl:
      typeof raw.imageUrl === 'string'
        ? raw.imageUrl
        : typeof raw.image_url === 'string'
          ? raw.image_url
          : typeof raw.image === 'string'
            ? raw.image
            : undefined,
    heroImageUrl: typeof raw.heroImageUrl === 'string' ? raw.heroImageUrl : typeof raw.image === 'string' ? raw.image : undefined,
    bannerImageUrl: typeof raw.bannerImageUrl === 'string' ? raw.bannerImageUrl : typeof raw.coverImage === 'string' ? raw.coverImage : undefined,
    badge: typeof raw.badge === 'string' ? raw.badge : undefined,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : undefined,
    sortOrder,
    metaJson: raw.metaJson && typeof raw.metaJson === 'object' ? raw.metaJson : raw.meta && typeof raw.meta === 'object' ? raw.meta : undefined,
    categoryIds,
    productIds,
    products: productsRaw as CatalogCollectionProduct[],
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  }
}


export function usePublicCollections(options?: { type?: CatalogCollectionType; fallbackToMock?: boolean; page?: number; limit?: number }) {
  const api = useMemo(() => createApiClient(), [])

  const [collections, setCollections] = useState<(CatalogCollection & { products?: Product[] })[]>([])
  const [landingCollections, setLandingCollections] = useState<(CatalogCollection & { products: Product[] })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const payload = await api.get(endpoints.catalog.publicCollections({
        type: options?.type,
        page: options?.page,
        limit: options?.limit,
        isActive: true,
      }))

      const mappedCollections = extractList(payload)
        .map(toCatalogCollection)
        .filter(Boolean) as CatalogCollection[]

      const hydrated = mappedCollections.map((c) => {
        const productsRaw = c.products || []
        const products = Array.isArray(productsRaw)
          ? (productsRaw.map(mapToProduct).filter(Boolean) as Product[])
          : []
        return { ...c, products }
      })

      const landing = hydrated
        .filter((c) => (c.type || '').toLowerCase() === 'landing')
        .map((c) => ({
          ...c,
          products: (c.products || []).slice(0, options?.limit || 12),
        }))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

      setCollections(hydrated)
      setLandingCollections(landing)
    } catch (e: any) {
      setCollections([])
      setLandingCollections([])
      setError(e?.message || 'Failed to load collections')
    } finally {
      setIsLoading(false)
    }
  }, [api, options?.limit, options?.page, options?.type])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    collections,
    landingCollections,
    isLoading,
    error,
    refresh,
  }
}

export type AdminCollectionInput = {
  name: string
  slug: string
  type?: CatalogCollectionType
  description?: string
  icon?: string
  avatarUrl?: string
  imageUrl?: string
  heroImageUrl?: string
  bannerImageUrl?: string
  badge?: string
  isActive?: boolean
  sortOrder?: number
  productIds?: string[]
  categoryIds?: string[]
  metaJson?: Record<string, any>
}

export function useAdminCollections(options?: { token?: string | null; type?: CatalogCollectionType }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])

  const [collections, setCollections] = useState<CatalogCollection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get(endpoints.catalog.collections({ type: options?.type }))
      const mapped = extractList(payload)
        .map(toCatalogCollection)
        .filter(Boolean) as CatalogCollection[]
      setCollections(mapped)
    } catch (e: any) {
      setCollections([])
      setError(e?.message || 'Failed to load collections')
    } finally {
      setIsLoading(false)
    }
  }, [api, options?.type])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createCollection = useCallback(
    async (input: AdminCollectionInput) => {
      const payload = await api.post(endpoints.catalog.collections(), {
        name: input.name,
        title: input.name,
        slug: input.slug,
        handle: input.slug,
        key: input.slug,
        type: input.type || 'landing',
        description: input.description,
        icon: input.icon,
        avatarUrl: input.avatarUrl,
        imageUrl: input.imageUrl,
        heroImageUrl: input.heroImageUrl,
        bannerImageUrl: input.bannerImageUrl,
        badge: input.badge,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder,
        productIds: input.productIds && input.productIds.length > 0 ? input.productIds : undefined,
        categoryIds: input.categoryIds && input.categoryIds.length > 0 ? input.categoryIds : undefined,
        meta: input.metaJson,
        metaJson: input.metaJson,
      })

      const created = toCatalogCollection(payload)
      if (created) setCollections((prev) => [created, ...prev])
      return created
    },
    [api]
  )

  return {
    collections,
    isLoading,
    error,
    refresh,
    createCollection,
  }
}
