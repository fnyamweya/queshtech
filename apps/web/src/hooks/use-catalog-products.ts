import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import type {
  CatalogProduct,
  CatalogProductAvailability,
  CatalogProductImage,
  CatalogProductOptionDefinition,
  CatalogProductPrice,
  CatalogProductSku,
  CatalogProductStatus,
  CatalogProductTranslation,
} from '@/types/catalog'

type ApiProductLike = any

function extractList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload
  const p: any = payload as any
  if (Array.isArray(p?.items)) return p.items
  if (Array.isArray(p?.data)) return p.data
  if (Array.isArray(p?.data?.items)) return p.data.items
  if (Array.isArray(p?.results)) return p.results
  return []
}

function extractPagination(payload: unknown): { total?: number; page?: number; limit?: number } {
  const p: any = payload as any
  const total = typeof p?.total === 'number' ? p.total : typeof p?.data?.total === 'number' ? p.data.total : undefined
  const page = typeof p?.page === 'number' ? p.page : typeof p?.data?.page === 'number' ? p.data.page : undefined
  const limit = typeof p?.limit === 'number' ? p.limit : typeof p?.data?.limit === 'number' ? p.data.limit : undefined
  return { total, page, limit }
}

function toStatus(raw: any): CatalogProductStatus {
  const v = String(raw || 'draft').toLowerCase()
  if (v === 'active' || v === 'archived') return v
  return 'draft'
}

function toTranslation(raw: any): CatalogProductTranslation | null {
  if (!raw || typeof raw !== 'object') return null
  const locale = String(raw.locale || raw.lang || raw.language || 'en').trim() || 'en'
  const title = String(raw.title || raw.name || '').trim()
  if (!title) return null

  return {
    locale,
    title,
    description: typeof raw.description === 'string' ? raw.description : typeof raw.shortDescription === 'string' ? raw.shortDescription : undefined,
    metaJson: raw.metaJson && typeof raw.metaJson === 'object' ? raw.metaJson : raw.meta && typeof raw.meta === 'object' ? raw.meta : undefined,
    slug: typeof raw.slug === 'string' ? raw.slug : undefined,
  }
}

function toOptionDefinition(raw: any): CatalogProductOptionDefinition | null {
  if (!raw || typeof raw !== 'object') return null
  const key = String(raw.key || '').trim()
  const label = String(raw.label || raw.name || '').trim()
  if (!key || !label) return null
  const allowedValuesRaw = raw.allowedValues ?? raw.values
  const allowedValues = Array.isArray(allowedValuesRaw)
    ? allowedValuesRaw.map((v: any) => String(v).trim()).filter(Boolean)
    : undefined
  return {
    key,
    label,
    allowedValues: allowedValues?.length ? allowedValues : undefined,
    required: typeof raw.required === 'boolean' ? raw.required : undefined,
  }
}

function toPrice(raw: any): CatalogProductPrice | null {
  if (!raw || typeof raw !== 'object') return null
  const priceListId = String(raw.priceListId || raw.price_list_id || raw.priceList?.id || '').trim()
  const unitPrice = Number(raw.unitPrice ?? raw.price ?? raw.amount)
  if (!priceListId || !Number.isFinite(unitPrice)) return null
  return {
    priceListId,
    unitPrice,
    compareAtPrice: raw.compareAtPrice ?? raw.compare_at_price ?? null,
    minQuantity: raw.minQuantity ?? null,
    maxQuantity: raw.maxQuantity ?? null,
    validFrom: raw.validFrom ?? raw.valid_from ?? null,
    validTo: raw.validTo ?? raw.valid_to ?? null,
    metaJson: raw.metaJson && typeof raw.metaJson === 'object' ? raw.metaJson : raw.meta && typeof raw.meta === 'object' ? raw.meta : undefined,
  }
}

function toSku(raw: any): CatalogProductSku | null {
  if (!raw || typeof raw !== 'object') return null
  const sku = String(raw.sku || raw.code || '').trim()
  if (!sku) return null
  const id = String(raw.id || raw._id || raw.skuId || sku).trim()
  const pricesRaw = Array.isArray(raw.prices) ? raw.prices : []
  const prices = pricesRaw.map(toPrice).filter(Boolean) as CatalogProductPrice[]

  return {
    id,
    sku,
    title: typeof raw.title === 'string' ? raw.title : typeof raw.name === 'string' ? raw.name : undefined,
    externalRef: typeof raw.externalRef === 'string' ? raw.externalRef : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    isDefault: typeof raw.isDefault === 'boolean' ? raw.isDefault : undefined,
    position: typeof raw.position === 'number' ? raw.position : undefined,
    attributes: raw.attributes && typeof raw.attributes === 'object' ? raw.attributes : undefined,
    options: raw.options && typeof raw.options === 'object' ? raw.options : undefined,
    availability: toAvailability(raw.availability),
    inventory: raw.inventory && typeof raw.inventory === 'object' ? raw.inventory : undefined,
    images: Array.isArray(raw.images) ? raw.images.map((u: any) => String(u)).filter(Boolean) : undefined,
    requiresShipping: typeof raw.requiresShipping === 'boolean' ? raw.requiresShipping : undefined,
    weight: typeof raw.weight === 'number' ? raw.weight : undefined,
    length: typeof raw.length === 'number' ? raw.length : undefined,
    width: typeof raw.width === 'number' ? raw.width : undefined,
    height: typeof raw.height === 'number' ? raw.height : undefined,
    dimensionUnit: typeof raw.dimensionUnit === 'string' ? raw.dimensionUnit : undefined,
    weightUnit: typeof raw.weightUnit === 'string' ? raw.weightUnit : undefined,
    metaJson: raw.metaJson && typeof raw.metaJson === 'object' ? raw.metaJson : raw.meta && typeof raw.meta === 'object' ? raw.meta : undefined,
    prices: prices.length ? prices : undefined,
  }
}

function toAvailability(raw: any): CatalogProductAvailability | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  return {
    channels: Array.isArray(raw.channels) ? raw.channels.map((c: any) => String(c)).filter(Boolean) : undefined,
    countries: Array.isArray(raw.countries) ? raw.countries.map((c: any) => String(c)).filter(Boolean) : undefined,
    locations: Array.isArray(raw.locations) ? raw.locations.map((c: any) => String(c)).filter(Boolean) : undefined,
    stock: raw.stock && typeof raw.stock === 'object' ? raw.stock : undefined,
    schedule: raw.schedule && typeof raw.schedule === 'object' ? raw.schedule : undefined,
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : raw.metaJson && typeof raw.metaJson === 'object' ? raw.metaJson : undefined,
  }
}

function toProductImage(raw: any): CatalogProductImage | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    const url = raw.trim()
    if (!url) return null
    return { id: url, url }
  }
  if (typeof raw !== 'object') return null

  const url = String(raw.url || raw.src || raw.imageUrl || '').trim()
  if (!url) return null

  const id = String(raw.id || raw._id || url).trim()
  const skuId = typeof raw.skuId === 'string' ? raw.skuId : typeof raw.sku_id === 'string' ? raw.sku_id : undefined
  const alt = typeof raw.alt === 'string' ? raw.alt : undefined
  const isPrimary = Boolean(raw.isPrimary ?? raw.is_primary)
  const sortOrderRaw = raw.sortOrder ?? raw.sort_order
  const sortOrder = typeof sortOrderRaw === 'number' ? sortOrderRaw : typeof sortOrderRaw === 'string' ? Number(sortOrderRaw) : undefined

  return {
    id,
    url,
    alt,
    skuId,
    isPrimary,
    sortOrder: typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? sortOrder : undefined,
  }
}

function toProduct(raw: ApiProductLike): CatalogProduct | null {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id || raw._id || raw.productId || raw.slug || raw.sku || '').trim()
  const title = String(raw.title || raw.name || raw.label || '').trim()
  if (!id || !title) return null

  const translationsRaw = Array.isArray(raw.translations) ? raw.translations : Array.isArray(raw.i18n) ? raw.i18n : []
  const translations = translationsRaw.map(toTranslation).filter(Boolean) as CatalogProductTranslation[]

  const skusRaw = Array.isArray(raw.skus) ? raw.skus : Array.isArray(raw.variants) ? raw.variants : []
  const skus = skusRaw.map(toSku).filter(Boolean) as CatalogProductSku[]

  const categoryIdsRaw = raw.categoryIds ?? raw.categories
  const categoryIds = Array.isArray(categoryIdsRaw) ? categoryIdsRaw.map((x: any) => String(x)).filter(Boolean) : undefined

  const brandIdRaw = raw.brandId ?? raw.brand?.id ?? raw.brand?.brandId
  const brandId = brandIdRaw === null || brandIdRaw === undefined ? undefined : String(brandIdRaw)

  const optionDefsRaw = Array.isArray(raw.optionDefinitions) ? raw.optionDefinitions : Array.isArray(raw.options) ? raw.options : []
  const optionDefinitions = optionDefsRaw.map(toOptionDefinition).filter(Boolean) as CatalogProductOptionDefinition[]

  const pricesRaw = Array.isArray(raw.prices) ? raw.prices : []
  const prices = pricesRaw.map(toPrice).filter(Boolean) as CatalogProductPrice[]

  const imagesRaw = Array.isArray(raw.images) ? raw.images : []
  const images = (imagesRaw.map(toProductImage).filter(Boolean) as CatalogProductImage[]).sort((a, b) => {
    const ap = Boolean(a.isPrimary)
    const bp = Boolean(b.isPrimary)
    if (ap !== bp) return ap ? -1 : 1
    const ao = typeof a.sortOrder === 'number' ? a.sortOrder : 0
    const bo = typeof b.sortOrder === 'number' ? b.sortOrder : 0
    if (ao !== bo) return ao - bo
    return String(a.url).localeCompare(String(b.url))
  })

  return {
    id,
    title,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    shortDescription: typeof raw.shortDescription === 'string' ? raw.shortDescription : undefined,
    seoTitle: typeof raw.seoTitle === 'string' ? raw.seoTitle : undefined,
    seoDescription: typeof raw.seoDescription === 'string' ? raw.seoDescription : undefined,
    status: toStatus(raw.status),
    slug: typeof raw.slug === 'string' ? raw.slug : typeof raw.handle === 'string' ? raw.handle : undefined,
    externalRef: typeof raw.externalRef === 'string' ? raw.externalRef : undefined,
    brandId: brandId === 'null' ? null : brandId,
    categoryIds,
    optionDefinitions: optionDefinitions.length ? optionDefinitions : undefined,
    availability: toAvailability(raw.availability) ?? undefined,
    images: images.length ? images : undefined,
    translations: translations.length ? translations : undefined,
    skus: skus.length ? skus : undefined,
    prices: prices.length ? prices : undefined,
    metaJson: raw.metaJson && typeof raw.metaJson === 'object' ? raw.metaJson : raw.meta && typeof raw.meta === 'object' ? raw.meta : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  }
}

export type ProductListFilters = {
  page: number
  limit: number
  status?: CatalogProductStatus
  q?: string
}

export function useCatalogProducts(options?: { token?: string | null; filters?: Partial<ProductListFilters> }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])

  const [items, setItems] = useState<CatalogProduct[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [page, setPage] = useState<number>(options?.filters?.page ?? 1)
  const [limit, setLimit] = useState<number>(options?.filters?.limit ?? 20)
  const [status, setStatus] = useState<CatalogProductStatus | undefined>(options?.filters?.status)
  const [q, setQ] = useState<string>(options?.filters?.q ?? '')

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.requestRaw<any>(endpoints.catalog.products({ page, limit, status, q: q.trim() || undefined }), { method: 'GET' })
      const list = extractList(payload).map(toProduct).filter(Boolean) as CatalogProduct[]
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
  }, [api, limit, page, q, status])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createProduct = useCallback(
    async (input: {
      title: string
      status: CatalogProductStatus
      description?: string
      seoTitle?: string
      seoDescription?: string
      externalRef?: string
      brandId?: string | null
      categoryIds?: string[]
      optionDefinitions?: CatalogProductOptionDefinition[]
      skus?: CatalogProductSku[]
      metaJson?: any
    }) => {
      const payload = await api.post<any>(endpoints.catalog.products(), {
        title: input.title,
        status: input.status,
        description: input.description ?? undefined,
        seoTitle: input.seoTitle ?? undefined,
        seoDescription: input.seoDescription ?? undefined,
        brandId: input.brandId ?? undefined,
        categoryIds: input.categoryIds ?? undefined,
        optionDefinitions: input.optionDefinitions ?? undefined,
        skus: input.skus ?? undefined,
        externalRef: input.externalRef ?? undefined,
        metaJson: input.metaJson ?? undefined,
      })

      const created = toProduct(payload)
      if (created) {
        setItems((prev) => [created, ...prev])
        setTotal((prev) => (typeof prev === 'number' ? prev + 1 : prev))
      }
      return created
    },
    [api]
  )

  const updateProduct = useCallback(
    async (id: string, patch: Partial<Omit<CatalogProduct, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const payload = await api.patch<any>(endpoints.catalog.productById(id), patch)
      const updated = toProduct(payload)
      if (!updated) return null
      setItems((prev) => prev.map((p) => (p.id === id ? updated : p)))
      return updated
    },
    [api]
  )

  const deleteProduct = useCallback(
    async (id: string) => {
      await api.delete(endpoints.catalog.productById(id))
      setItems((prev) => prev.filter((p) => p.id !== id))
      setTotal((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1) : prev))
    },
    [api]
  )

  return {
    items,
    total,
    page,
    limit,
    status,
    q,
    setPage,
    setLimit,
    setStatus,
    setQ,
    isLoading,
    error,
    refresh,
    createProduct,
    updateProduct,
    deleteProduct,
  }
}

export function useCatalogProductById(options: { token?: string | null; id?: string | null }) {
  const api = useMemo(() => createApiClient({ token: options.token || null }), [options.token])
  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!options.id) {
      setProduct(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get<any>(endpoints.catalog.productById(options.id))
      setProduct(toProduct(payload))
    } catch (e: any) {
      setProduct(null)
      setError(e?.message || 'Failed to load product')
    } finally {
      setIsLoading(false)
    }
  }, [api, options.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const update = useCallback(
    async (patch: Partial<Omit<CatalogProduct, 'id' | 'createdAt' | 'updatedAt'>>) => {
      if (!options.id) return null
      const payload = await api.patch<any>(endpoints.catalog.productById(options.id), patch)
      const updated = toProduct(payload)
      if (updated) setProduct(updated)
      return updated
    },
    [api, options.id]
  )

  return { product, isLoading, error, refresh, update }
}
