import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'

export type PublicProductRatingSummary = {
  productId: string
  ratingCount: number
  avgRating: number
  star1Count: number
  star2Count: number
  star3Count: number
  star4Count: number
  star5Count: number
  updatedAt: string | null
}

export type PublicProductReview = {
  id: string
  productId: string
  rating: number
  title: string | null
  body: string | null
  mediaUrlsJson: string[]
  isVerifiedPurchase: boolean
  createdAt: string
}

function clampNumber(value: unknown, fallback: number) {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) ? n : fallback
}

function toReview(raw: any): PublicProductReview | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id ?? '').trim()
  const productId = String(raw.productId ?? '').trim()
  const rating = clampNumber(raw.rating, 0)
  if (!id || !productId || !rating) return null
  return {
    id,
    productId,
    rating,
    title: typeof raw.title === 'string' ? raw.title : raw.title == null ? null : String(raw.title),
    body: typeof raw.body === 'string' ? raw.body : raw.body == null ? null : String(raw.body),
    mediaUrlsJson: Array.isArray(raw.mediaUrlsJson) ? raw.mediaUrlsJson.map(String) : [],
    isVerifiedPurchase: Boolean(raw.isVerifiedPurchase),
    createdAt: String(raw.createdAt ?? raw.date ?? ''),
  }
}

export function usePublicProductRatingSummary(productId?: string | null) {
  const api = useMemo(() => createApiClient(), [])
  const [summary, setSummary] = useState<PublicProductRatingSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!productId) {
      setSummary(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get<any>(endpoints.catalog.publicProductRatingSummary(productId))
      setSummary({
        productId: String(payload?.productId ?? productId),
        ratingCount: clampNumber(payload?.ratingCount, 0),
        avgRating: clampNumber(payload?.avgRating, 0),
        star1Count: clampNumber(payload?.star1Count, 0),
        star2Count: clampNumber(payload?.star2Count, 0),
        star3Count: clampNumber(payload?.star3Count, 0),
        star4Count: clampNumber(payload?.star4Count, 0),
        star5Count: clampNumber(payload?.star5Count, 0),
        updatedAt: payload?.updatedAt ? String(payload.updatedAt) : null,
      })
    } catch (e: any) {
      setSummary(null)
      setError(e?.message || 'Failed to load rating summary')
    } finally {
      setIsLoading(false)
    }
  }, [api, productId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { summary, isLoading, error, refresh }
}

export function usePublicProductReviews(options: {
  productId?: string | null
  page?: number
  limit?: number
  sort?: 'newest' | 'oldest' | 'highest' | 'lowest'
}) {
  const api = useMemo(() => createApiClient(), [])
  const [items, setItems] = useState<PublicProductReview[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(options.page ?? 1)
  const [limit, setLimit] = useState<number>(options.limit ?? 10)
  const [sort, setSort] = useState<NonNullable<typeof options.sort>>(options.sort ?? 'newest')

  const refresh = useCallback(async () => {
    if (!options.productId) {
      setItems([])
      setTotal(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const url = endpoints.catalog.publicProductReviews(options.productId, { page, limit, sort })
      const envelope = await api.requestRaw<any>(url, { method: 'GET' })
      const list = Array.isArray(envelope?.data) ? envelope.data : Array.isArray(envelope) ? envelope : []
      const mapped = list.map(toReview).filter(Boolean) as PublicProductReview[]
      setItems(mapped)
      const metaTotal = envelope?.meta?.total
      setTotal(typeof metaTotal === 'number' ? metaTotal : null)
    } catch (e: any) {
      setItems([])
      setTotal(null)
      setError(e?.message || 'Failed to load reviews')
    } finally {
      setIsLoading(false)
    }
  }, [api, limit, options.productId, page, sort])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    items,
    total,
    isLoading,
    error,
    page,
    limit,
    sort,
    setPage,
    setLimit,
    setSort,
    refresh,
  }
}

