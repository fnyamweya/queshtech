import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import type { PriceList, ProductVariantPrice } from '@/types/catalog'

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

function toPriceList(raw: ApiLike): PriceList | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || raw._id || '').trim()
  const code = String(raw.code || raw.slug || raw.key || '').trim()
  const name = String(raw.name || raw.title || code).trim()
  const currencyCode = String(raw.currencyCode || raw.currency || '').trim().toUpperCase()
  const isActive = typeof raw.isActive === 'boolean' ? raw.isActive : Boolean(raw.active)
  if (!id || !code || !currencyCode) return null

  return {
    id,
    code,
    name,
    currencyCode,
    isActive,
    validFrom: typeof raw.validFrom === 'string' ? raw.validFrom : raw.validFrom ? String(raw.validFrom) : undefined,
    validTo: typeof raw.validTo === 'string' ? raw.validTo : raw.validTo ? String(raw.validTo) : undefined,
    metaJson: raw.metaJson && typeof raw.metaJson === 'object' ? raw.metaJson : raw.meta && typeof raw.meta === 'object' ? raw.meta : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  }
}

function toVariantPrice(raw: ApiLike): ProductVariantPrice | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || raw._id || '').trim()
  const variantId = String(raw.variantId || raw.variant?.id || '').trim()
  const priceListId = String(raw.priceListId || raw.priceList?.id || '').trim()
  const unitPrice = Number(raw.unitPrice ?? raw.price ?? raw.amount)
  if (!id || !variantId || !priceListId || !Number.isFinite(unitPrice)) return null

  const compareAt = raw.compareAtPrice ?? raw.compare_at_price
  return {
    id,
    variantId,
    priceListId,
    unitPrice,
    compareAtPrice: compareAt === null || compareAt === undefined ? undefined : Number(compareAt),
    minQuantity: raw.minQuantity === null || raw.minQuantity === undefined ? undefined : Number(raw.minQuantity),
    maxQuantity: raw.maxQuantity === null || raw.maxQuantity === undefined ? undefined : Number(raw.maxQuantity),
    validFrom: typeof raw.validFrom === 'string' ? raw.validFrom : raw.validFrom ? String(raw.validFrom) : undefined,
    validTo: typeof raw.validTo === 'string' ? raw.validTo : raw.validTo ? String(raw.validTo) : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  }
}

function parsePriority(metaJson: any): number {
  const v = metaJson?.priority
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : 0
  return Number.isFinite(n) ? n : 0
}

function isWithinWindow(now: Date, from?: string | null, to?: string | null): boolean {
  const start = from ? new Date(from) : null
  const end = to ? new Date(to) : null
  if (start && Number.isFinite(start.getTime()) && now < start) return false
  if (end && Number.isFinite(end.getTime()) && now > end) return false
  return true
}

export function resolveVariantPrice(args: {
  variantId: string
  quantity?: number
  currencyCode?: string
  priceListId?: string
  priceLists: PriceList[]
  prices: ProductVariantPrice[]
}): { priceList?: PriceList; price?: ProductVariantPrice } {
  const qty = Math.max(1, Math.floor(args.quantity ?? 1))
  const now = new Date()

  const candidates = args.priceLists
    .filter((pl) => pl.isActive)
    .filter((pl) => (args.currencyCode ? pl.currencyCode === args.currencyCode.toUpperCase() : true))
    .filter((pl) => isWithinWindow(now, pl.validFrom ?? null, pl.validTo ?? null))

  const sortLists = (a: PriceList, b: PriceList) => {
    const ap = parsePriority(a.metaJson)
    const bp = parsePriority(b.metaJson)
    if (ap !== bp) return bp - ap
    const av = a.validFrom ? new Date(a.validFrom).getTime() : 0
    const bv = b.validFrom ? new Date(b.validFrom).getTime() : 0
    return bv - av
  }

  const lists = args.priceListId
    ? candidates.filter((pl) => pl.id === args.priceListId)
    : [...candidates].sort(sortLists)

  const pricesForVariant = args.prices.filter((p) => p.variantId === args.variantId)

  const pickTier = (priceListId: string) => {
    const tiers = pricesForVariant
      .filter((p) => p.priceListId === priceListId)
      .filter((p) => isWithinWindow(now, p.validFrom ?? null, p.validTo ?? null))
      .filter((p) => {
        const min = p.minQuantity ?? 1
        const max = p.maxQuantity ?? null
        if (qty < min) return false
        if (max !== null && max !== undefined && qty > max) return false
        return true
      })

    if (tiers.length === 0) return undefined

    // highest minQuantity wins
    return [...tiers].sort((a, b) => (b.minQuantity ?? 1) - (a.minQuantity ?? 1))[0]
  }

  for (const pl of lists) {
    const tier = pickTier(pl.id)
    if (tier) return { priceList: pl, price: tier }
  }

  // If no explicit listId provided, try other active lists in same currency
  if (!args.priceListId && args.currencyCode) {
    const sameCurrency = [...candidates].sort(sortLists)
    for (const pl of sameCurrency) {
      const tier = pickTier(pl.id)
      if (tier) return { priceList: pl, price: tier }
    }
  }

  return {}
}

export function usePriceLists(options?: { token?: string | null }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get<any>(endpoints.pricing.priceLists)
      setPriceLists(extractList(payload).map(toPriceList).filter(Boolean) as PriceList[])
    } catch (e: any) {
      setPriceLists([])
      setError(e?.message || 'Failed to load price lists')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createPriceList = useCallback(
    async (input: Omit<PriceList, 'id'>) => {
      const payload = await api.post<any>(endpoints.pricing.priceLists, input)
      const created = toPriceList(payload)
      if (created) setPriceLists((prev) => [created, ...prev])
      return created
    },
    [api]
  )

  const updatePriceList = useCallback(
    async (id: string, patch: Partial<PriceList>) => {
      const payload = await api.patch<any>(endpoints.pricing.priceListById(id), patch)
      const updated = toPriceList(payload)
      if (!updated) return null
      setPriceLists((prev) => prev.map((p) => (p.id === id ? updated : p)))
      return updated
    },
    [api]
  )

  const deletePriceList = useCallback(
    async (id: string) => {
      await api.delete(endpoints.pricing.priceListById(id))
      setPriceLists((prev) => prev.filter((p) => p.id !== id))
    },
    [api]
  )

  return { priceLists, isLoading, error, refresh, createPriceList, updatePriceList, deletePriceList }
}

export function useVariantPrices(options?: { token?: string | null; priceListId?: string | null; variantId?: string | null }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])
  const [prices, setPrices] = useState<ProductVariantPrice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get<any>(endpoints.pricing.variantPrices({
        priceListId: options?.priceListId || undefined,
        variantId: options?.variantId || undefined,
      }))
      setPrices(extractList(payload).map(toVariantPrice).filter(Boolean) as ProductVariantPrice[])
    } catch (e: any) {
      setPrices([])
      setError(e?.message || 'Failed to load variant prices')
    } finally {
      setIsLoading(false)
    }
  }, [api, options?.priceListId, options?.variantId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createVariantPrice = useCallback(
    async (input: Omit<ProductVariantPrice, 'id'>) => {
      const payload = await api.post<any>(endpoints.pricing.variantPrices(), input)
      const created = toVariantPrice(payload)
      if (created) setPrices((prev) => [created, ...prev])
      return created
    },
    [api]
  )

  const updateVariantPrice = useCallback(
    async (id: string, patch: Partial<ProductVariantPrice>) => {
      const payload = await api.patch<any>(endpoints.pricing.variantPriceById(id), patch)
      const updated = toVariantPrice(payload)
      if (!updated) return null
      setPrices((prev) => prev.map((p) => (p.id === id ? updated : p)))
      return updated
    },
    [api]
  )

  const deleteVariantPrice = useCallback(
    async (id: string) => {
      await api.delete(endpoints.pricing.variantPriceById(id))
      setPrices((prev) => prev.filter((p) => p.id !== id))
    },
    [api]
  )

  return { prices, isLoading, error, refresh, createVariantPrice, updateVariantPrice, deleteVariantPrice }
}
