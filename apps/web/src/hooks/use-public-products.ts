import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import { mapToProduct } from '@/lib/product-mapper'
import type { Product } from '@/types'

function extractList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload
  const p: any = payload as any
  if (Array.isArray(p?.items)) return p.items
  if (Array.isArray(p?.data)) return p.data
  if (Array.isArray(p?.data?.items)) return p.data.items
  if (Array.isArray(p?.data?.hits)) return p.data.hits
  if (Array.isArray(p?.results)) return p.results
  if (Array.isArray(p?.hits)) return p.hits
  return []
}

function extractPagination(payload: unknown): { total?: number; page?: number; limit?: number } {
  const p: any = payload as any
  const total = typeof p?.total === 'number' ? p.total : typeof p?.data?.total === 'number' ? p.data.total : undefined
  const page = typeof p?.page === 'number' ? p.page : typeof p?.data?.page === 'number' ? p.data.page : undefined
  const limit = typeof p?.limit === 'number' ? p.limit : typeof p?.data?.limit === 'number' ? p.data.limit : undefined
  return { total, page, limit }
}

function extractAlgoliaPagination(payload: unknown): { total?: number; page?: number; limit?: number } {
  const p: any = payload as any
  const source = p?.data && typeof p.data === 'object' ? p.data : p
  const total = typeof source?.nbHits === 'number' ? source.nbHits : undefined
  const page = typeof source?.page === 'number' ? source.page : undefined
  const limit = typeof source?.hitsPerPage === 'number' ? source.hitsPerPage : undefined
  return { total, page, limit }
}

export function usePublicProducts(options?: { page?: number; limit?: number; q?: string; sort?: string; view?: boolean }) {
  const api = useMemo(() => createApiClient(), [])

  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [page, setPage] = useState<number>(options?.page ?? 1)
  const [limit, setLimit] = useState<number>(options?.limit ?? 20)
  const [q, setQ] = useState<string>(options?.q ?? '')
  const [sort, setSort] = useState<string | undefined>(options?.sort)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const url = options?.view
        ? endpoints.catalog.publicProductsView({ page, limit, q: q.trim() || undefined, sort })
        : endpoints.catalog.publicProducts({ page, limit, q: q.trim() || undefined, sort })
      const payload = await api.get(url)
      const list = extractList(payload).map(mapToProduct).filter(Boolean) as Product[]
      const { total: t, page: p, limit: l } = extractPagination(payload)
      setItems(list)
      setTotal(typeof t === 'number' ? t : null)
      if (typeof p === 'number') setPage(p)
      if (typeof l === 'number') setLimit(l)
    } catch (e: any) {
      setItems([])
      setTotal(null)
      setError(e?.message || 'Failed to load products')
    } finally {
      setIsLoading(false)
    }
  }, [api, limit, options?.view, page, q, sort])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    items,
    total,
    page,
    limit,
    q,
    sort,
    setPage,
    setLimit,
    setQ,
    setSort,
    isLoading,
    error,
    refresh,
  }
}

export function usePublicProduct(options: { idOrSlug?: string | null; view?: boolean }) {
  const api = useMemo(() => createApiClient(), [])
  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!options.idOrSlug) {
      setProduct(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const url = options.view
        ? endpoints.catalog.publicProductViewById(options.idOrSlug)
        : endpoints.catalog.publicProductById(options.idOrSlug)
      const payload = await api.get(url)
      setProduct(mapToProduct(payload))
    } catch (e: any) {
      setProduct(null)
      setError(e?.message || 'Failed to load product')
    } finally {
      setIsLoading(false)
    }
  }, [api, options.idOrSlug, options.view])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { product, isLoading, error, refresh }
}

export function usePublicCategoryProducts(options: {
  categoryId?: string | null
  page?: number
  limit?: number
  q?: string
  sort?: string
  view?: boolean
}) {
  const api = useMemo(() => createApiClient(), [])
  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(options.page ?? 1)
  const [limit, setLimit] = useState<number>(options.limit ?? 20)
  const [q, setQ] = useState<string>(options.q ?? '')
  const [sort, setSort] = useState<string | undefined>(options.sort)
  const isUuid = useMemo(() => {
    if (!options.categoryId) return false
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options.categoryId)
  }, [options.categoryId])

  const refresh = useCallback(async () => {
    if (!options.categoryId || !isUuid) {
      setItems([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const url = options.view
        ? endpoints.catalog.publicCategoryProductViews(options.categoryId, {
            page,
            limit,
            q: q.trim() || undefined,
            sort,
          })
        : endpoints.catalog.publicCategoryProducts(options.categoryId, {
            page,
            limit,
            q: q.trim() || undefined,
            sort,
          })
      const payload = await api.get(url)
      const list = extractList(payload).map(mapToProduct).filter(Boolean) as Product[]
      const { total: t, page: p, limit: l } = extractPagination(payload)
      setItems(list)
      setTotal(typeof t === 'number' ? t : null)
      if (typeof p === 'number') setPage(p)
      if (typeof l === 'number') setLimit(l)
    } catch (e: any) {
      setItems([])
      setTotal(null)
      setError(e?.message || 'Failed to load category products')
    } finally {
      setIsLoading(false)
    }
  }, [api, isUuid, limit, options.categoryId, options.view, page, q, sort])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    items,
    page,
    limit,
    q,
    sort,
    setPage,
    setLimit,
    setQ,
    setSort,
    total,
    isLoading,
    error,
    refresh,
  }
}

export function usePublicSearchProducts(options?: {
  page?: number
  limit?: number
  q?: string
  filters?: string
}) {
  const api = useMemo(() => createApiClient(), [])

  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [page, setPage] = useState<number>(options?.page ?? 1)
  const [limit, setLimit] = useState<number>(options?.limit ?? 20)
  const [q, setQ] = useState<string>(options?.q ?? '')
  const [filters, setFilters] = useState<string | undefined>(options?.filters)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const url = endpoints.catalog.publicSearchProducts({
        page,
        limit,
        q: q.trim() || undefined,
        filters,
      })
      const payload = await api.get(url)
      const list = extractList(payload).map(mapToProduct).filter(Boolean) as Product[]
      const { total: t, page: p, limit: l } = extractAlgoliaPagination(payload)
      setItems(list)
      setTotal(typeof t === 'number' ? t : null)
      if (typeof p === 'number') setPage(p)
      if (typeof l === 'number') setLimit(l)
    } catch (e: any) {
      setItems([])
      setTotal(null)
      setError(e?.message || 'Failed to search products')
    } finally {
      setIsLoading(false)
    }
  }, [api, filters, limit, page, q])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    items,
    total,
    page,
    limit,
    q,
    filters,
    setPage,
    setLimit,
    setQ,
    setFilters,
    isLoading,
    error,
    refresh,
  }
}
