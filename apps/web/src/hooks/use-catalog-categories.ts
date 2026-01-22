import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category } from '@/types'
import { endpoints } from '@/lib/endpoints'
import { createApiClient } from '@/lib/api-client'

type ApiCategoryLike = any

type CacheEnvelope<T> = { ts: number; data: T }
const PUBLIC_CATEGORIES_CACHE_TTL_MS = 5 * 60_000

function readCache<T>(key: string, ttlMs: number): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (!parsed || typeof parsed !== 'object') return null
    if (Date.now() - Number(parsed.ts || 0) > ttlMs) return null
    return parsed.data ?? null
  } catch {
    return null
  }
}

function writeCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  try {
    const payload: CacheEnvelope<T> = { ts: Date.now(), data }
    window.localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

function toCategory(raw: ApiCategoryLike): Category | null {
  if (!raw || typeof raw !== 'object') return null

  const translations: any[] = Array.isArray(raw.translations) ? raw.translations : []
  const translation = translations.find((t) => t && typeof t === 'object' && typeof t.locale === 'string' && t.locale === 'en') || translations[0] || null

  const id = String(raw.id || raw._id || raw.categoryId || raw.slug || raw.key || '').trim()
  const name = String(raw.name || raw.title || translation?.name || translation?.title || raw.translations?.[0]?.name || '').trim()
  const slug = String(raw.slug || raw.handle || raw.code || raw.key || translation?.slug || '').trim()

  if (!id || !name || !slug) return null

  const metaJsonRaw = raw.metaJson ?? raw.meta_json
  const metaJson = metaJsonRaw && typeof metaJsonRaw === 'object' ? (metaJsonRaw as Record<string, unknown>) : undefined

  const taxonomyIdRaw = raw.taxonomyId ?? raw.taxonomy_id ?? raw.taxonomy?.id ?? raw.taxonomy?._id ?? raw.taxonomy?.taxonomyId
  const taxonomyId = typeof taxonomyIdRaw === 'string' && taxonomyIdRaw.trim().length > 0 ? taxonomyIdRaw.trim() : undefined

  const keyRaw = raw.key ?? raw.categoryKey ?? raw.code
  const key = typeof keyRaw === 'string' && keyRaw.trim().length > 0 ? keyRaw.trim() : undefined

  const parentIdRaw = raw.parentId ?? raw.parent_id ?? raw.parent?.id ?? raw.parent?._id
  const parentId = typeof parentIdRaw === 'string' && parentIdRaw.length > 0 ? parentIdRaw : undefined

  const productCountRaw = raw.productCount ?? raw.productsCount ?? raw.products_count
  const productCount = typeof productCountRaw === 'number' ? productCountRaw : undefined

  const sortOrderRaw = raw.sortOrder ?? raw.sort_order ?? raw.order ?? raw.position
  const sortOrder = typeof sortOrderRaw === 'number' ? sortOrderRaw : undefined

  const isActiveRaw = raw.isActive ?? raw.is_active ?? raw.active ?? raw.enabled
  const isActive = typeof isActiveRaw === 'boolean' ? isActiveRaw : undefined

  const isHomepageRaw = raw.isHomepage ?? raw.is_homepage
  const isHomepage = typeof isHomepageRaw === 'boolean' ? isHomepageRaw : undefined

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

  const description =
    typeof raw.description === 'string'
      ? raw.description
      : typeof translation?.description === 'string'
        ? translation.description
        : typeof metaJson?.description === 'string'
          ? (metaJson.description as string)
        : undefined

  const locale = typeof translation?.locale === 'string' ? translation.locale : undefined
  const seoTitle = typeof translation?.seoTitle === 'string' ? translation.seoTitle : undefined
  const seoDescription = typeof translation?.seoDescription === 'string' ? translation.seoDescription : undefined
  const seoKeywords = Array.isArray(translation?.seoKeywords) ? translation.seoKeywords.filter((k: any) => typeof k === 'string' && k.trim()) : undefined
  const urlPath = typeof translation?.urlPath === 'string' ? translation.urlPath : undefined

  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : typeof raw.created_at === 'string' ? raw.created_at : undefined
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : typeof raw.updated_at === 'string' ? raw.updated_at : undefined

  const shippingMatrix =
    Array.isArray(metaJson?.shippingMatrix) &&
    (metaJson!.shippingMatrix as any[]).every((x) => x && typeof x === 'object')
      ? ((metaJson!.shippingMatrix as any[]).map((x) => ({
          region: String((x as any).region || ''),
          sla: String((x as any).sla || ''),
          surcharge: String((x as any).surcharge || ''),
        })) as Category['shippingMatrix'])
      : undefined

  const metaBool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)
  const metaNum = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
  const metaStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

  return {
    id,
    taxonomyId,
    key,
    name,
    slug,
    description,
    seoTitle: metaStr(raw.seoTitle) ?? seoTitle ?? metaStr(metaJson?.seoTitle),
    seoDescription: metaStr(raw.seoDescription) ?? seoDescription ?? metaStr(metaJson?.seoDescription),
    seoKeywords,
    urlPath,
    image: imageUrl,
    imageUrl,
    avatarUrl,
    icon,
    parentId,
    productCount,
    isActive,
    isHomepage,
    sortOrder,
    locale,
    synonyms: metaStr(raw.synonyms) ?? metaStr(metaJson?.synonyms),
    keywords: metaStr(raw.keywords) ?? metaStr(metaJson?.keywords),
    status: metaStr(raw.status) ?? metaStr(metaJson?.status),
    level: metaStr(raw.level) ?? metaStr(metaJson?.level),
    audience: metaStr(raw.audience) ?? metaStr(metaJson?.audience),
    returnPolicy: metaStr(raw.returnPolicy) ?? metaStr(metaJson?.returnPolicy),
    taxCode: metaStr(raw.taxCode) ?? metaStr(metaJson?.taxCode),
    highlight: metaBool(raw.highlight) ?? metaBool(metaJson?.highlight),
    navPlacement: metaBool(raw.navPlacement) ?? metaBool(metaJson?.navPlacement),
    featured: metaBool(raw.featured) ?? metaBool(metaJson?.featured),
    banner: metaStr(raw.banner) ?? metaStr(metaJson?.banner),
    marginTarget: metaNum(raw.marginTarget) ?? metaNum(metaJson?.marginTarget),
    availability: metaStr(raw.availability) ?? metaStr(metaJson?.availability),
    compliance: metaStr(raw.compliance) ?? metaStr(metaJson?.compliance),
    shippingProfile: metaStr(raw.shippingProfile) ?? metaStr(metaJson?.shippingProfile),
    marketingHeadline: metaStr(raw.marketingHeadline) ?? metaStr(metaJson?.marketingHeadline),
    marketingSub: metaStr(raw.marketingSub) ?? metaStr(metaJson?.marketingSub),
    heroCta: metaStr(raw.heroCta) ?? metaStr(metaJson?.heroCta),
    heroCtaLink: metaStr(raw.heroCtaLink) ?? metaStr(metaJson?.heroCtaLink),
    contentPillar: metaStr(raw.contentPillar) ?? metaStr(metaJson?.contentPillar),
    story: metaStr(raw.story) ?? metaStr(metaJson?.story),
    themeColor: metaStr(raw.themeColor) ?? metaStr(metaJson?.themeColor),
    shippingMatrix,
    metaJson,
    createdAt,
    updatedAt,
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
  // Legacy option kept for compatibility; mocks were removed.
  const fallbackToMock = options?.fallbackToMock ?? false

  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])

  const [categories, setCategories] = useState<Category[]>([])
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
      } else {
        setCategories([])
      }
    } catch (e: any) {
      setCategories([])
      setError(e?.message || 'Failed to load categories')
    } finally {
      setIsLoading(false)
    }
  }, [api, fallbackToMock])

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
      isHomepage?: boolean
      sortOrder?: number
      order?: number
      status?: string
      isLeaf?: boolean
      icon?: string
      imageUrl?: string
      avatarUrl?: string
      seoTitle?: string
      seoDescription?: string
      seoKeywords?: string[]
      synonyms?: string
      keywords?: string
      level?: string
      audience?: string
      returnPolicy?: string
      taxCode?: string
      highlight?: boolean
      navPlacement?: boolean
      featured?: boolean
      banner?: string
      marginTarget?: number
      availability?: string
      compliance?: string
      shippingProfile?: string
      marketingHeadline?: string
      marketingSub?: string
      heroCta?: string
      heroCtaLink?: string
      contentPillar?: string
      story?: string
      themeColor?: string
      shippingMatrix?: Array<{ region: string; sla: string; surcharge: string }>
      metaJson?: Record<string, unknown>
      urlPath?: string
      locale?: string
    }) => {
      const taxonomyId = (input.taxonomyId || '').trim()
      const key = (input.key || '').trim()

      // Swagger-aligned payload (CreateCategoryDto)
      const dtoPayload = {
        taxonomyId,
        parentId: input.parentId || undefined,
        key: key || input.slug,
        name: input.name,
        slug: input.slug,
        isActive: typeof input.isActive === 'boolean' ? input.isActive : undefined,
        isHomepage: typeof input.isHomepage === 'boolean' ? input.isHomepage : undefined,
        sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : undefined,
        order: typeof input.order === 'number' ? input.order : undefined,
        status: typeof input.status === 'string' ? input.status : undefined,
        isLeaf: typeof input.isLeaf === 'boolean' ? input.isLeaf : undefined,
        icon: input.icon || undefined,
        imageUrl: input.imageUrl || undefined,
        avatarUrl: input.avatarUrl || undefined,
        description: input.description || undefined,
        seoTitle: input.seoTitle || undefined,
        seoDescription: input.seoDescription || undefined,
        synonyms: input.synonyms || undefined,
        keywords: input.keywords || undefined,
        level: input.level || undefined,
        audience: input.audience || undefined,
        returnPolicy: input.returnPolicy || undefined,
        taxCode: input.taxCode || undefined,
        highlight: typeof input.highlight === 'boolean' ? input.highlight : undefined,
        navPlacement: typeof input.navPlacement === 'boolean' ? input.navPlacement : undefined,
        featured: typeof input.featured === 'boolean' ? input.featured : undefined,
        banner: input.banner || undefined,
        marginTarget: typeof input.marginTarget === 'number' ? input.marginTarget : undefined,
        availability: input.availability || undefined,
        compliance: input.compliance || undefined,
        shippingProfile: input.shippingProfile || undefined,
        marketingHeadline: input.marketingHeadline || undefined,
        marketingSub: input.marketingSub || undefined,
        heroCta: input.heroCta || undefined,
        heroCtaLink: input.heroCtaLink || undefined,
        contentPillar: input.contentPillar || undefined,
        story: input.story || undefined,
        themeColor: input.themeColor || undefined,
        shippingMatrix: input.shippingMatrix,
        metaJson: input.metaJson,
        translations: [
          {
            locale: (input.locale || 'en').trim() || 'en',
            name: input.name,
            description: input.description || undefined,
            seoTitle: input.seoTitle || undefined,
            seoDescription: input.seoDescription || undefined,
            seoKeywords: input.seoKeywords && input.seoKeywords.length > 0 ? input.seoKeywords : undefined,
            urlPath: input.urlPath || undefined,
          },
        ],
      }

      const payload = await api.post(endpoints.catalog.categories, dtoPayload)

      const created = toCategory(payload as any)
      if (created) {
        setCategories(prev => uniqueBySlug([created, ...prev]))
      }
      return created
    },
    [api]
  )

  const updateCategory = useCallback(
    async (
      id: string,
      patch: Partial<{
        taxonomyId: string
        key: string
        name: string
        slug: string
        parentId: string | null
        description: string
        isActive: boolean
        isHomepage: boolean
        sortOrder: number
        order: number
        status: string
        isLeaf: boolean
        icon: string
        imageUrl: string
        avatarUrl: string
        seoTitle: string
        seoDescription: string
        seoKeywords: string[]
        synonyms: string
        keywords: string
        level: string
        audience: string
        returnPolicy: string
        taxCode: string
        highlight: boolean
        navPlacement: boolean
        featured: boolean
        banner: string
        marginTarget: number
        availability: string
        compliance: string
        shippingProfile: string
        marketingHeadline: string
        marketingSub: string
        heroCta: string
        heroCtaLink: string
        contentPillar: string
        story: string
        themeColor: string
        shippingMatrix: Array<{ region: string; sla: string; surcharge: string }>
        metaJson: Record<string, unknown>
        urlPath: string
        locale: string
      }>
    ) => {
      const taxonomyId = (patch.taxonomyId || '').trim()
      const key = (patch.key || '').trim()
      const locale = (patch.locale || 'en').trim() || 'en'

      const translations: Array<Record<string, any>> = []
      if (
        typeof patch.name === 'string' ||
        typeof patch.description === 'string' ||
        typeof patch.seoTitle === 'string' ||
        typeof patch.seoDescription === 'string' ||
        Array.isArray(patch.seoKeywords) ||
        typeof patch.urlPath === 'string'
      ) {
        translations.push({
          locale,
          ...(typeof patch.name === 'string' ? { name: patch.name } : {}),
          ...(typeof patch.description === 'string' ? { description: patch.description || undefined } : {}),
          ...(typeof patch.seoTitle === 'string' ? { seoTitle: patch.seoTitle || undefined } : {}),
          ...(typeof patch.seoDescription === 'string' ? { seoDescription: patch.seoDescription || undefined } : {}),
          ...(Array.isArray(patch.seoKeywords) ? { seoKeywords: patch.seoKeywords.length ? patch.seoKeywords : undefined } : {}),
          ...(typeof patch.urlPath === 'string' ? { urlPath: patch.urlPath || undefined } : {}),
        })
      }

      const dtoPatch = {
        ...(taxonomyId ? { taxonomyId } : {}),
        ...(patch.parentId !== undefined ? { parentId: patch.parentId || undefined } : {}),
        ...(key ? { key } : {}),
        ...(typeof patch.name === 'string' ? { name: patch.name } : {}),
        ...(typeof patch.slug === 'string' ? { slug: patch.slug } : {}),
        ...(typeof patch.isActive === 'boolean' ? { isActive: patch.isActive } : {}),
        ...(typeof (patch as any).isHomepage === 'boolean' ? { isHomepage: (patch as any).isHomepage } : {}),
        ...(typeof patch.sortOrder === 'number' ? { sortOrder: patch.sortOrder } : {}),
        ...(typeof patch.order === 'number' ? { order: patch.order } : {}),
        ...(typeof patch.status === 'string' ? { status: patch.status } : {}),
        ...(typeof patch.isLeaf === 'boolean' ? { isLeaf: patch.isLeaf } : {}),
        ...(typeof patch.icon === 'string' ? { icon: patch.icon || undefined } : {}),
        ...(typeof patch.imageUrl === 'string' ? { imageUrl: patch.imageUrl || undefined } : {}),
        ...(typeof patch.avatarUrl === 'string' ? { avatarUrl: patch.avatarUrl || undefined } : {}),
        ...(typeof patch.description === 'string' ? { description: patch.description || undefined } : {}),
        ...(typeof patch.seoTitle === 'string' ? { seoTitle: patch.seoTitle || undefined } : {}),
        ...(typeof patch.seoDescription === 'string' ? { seoDescription: patch.seoDescription || undefined } : {}),
        ...(typeof patch.synonyms === 'string' ? { synonyms: patch.synonyms || undefined } : {}),
        ...(typeof patch.keywords === 'string' ? { keywords: patch.keywords || undefined } : {}),
        ...(typeof patch.level === 'string' ? { level: patch.level || undefined } : {}),
        ...(typeof patch.audience === 'string' ? { audience: patch.audience || undefined } : {}),
        ...(typeof patch.returnPolicy === 'string' ? { returnPolicy: patch.returnPolicy || undefined } : {}),
        ...(typeof patch.taxCode === 'string' ? { taxCode: patch.taxCode || undefined } : {}),
        ...(typeof patch.highlight === 'boolean' ? { highlight: patch.highlight } : {}),
        ...(typeof patch.navPlacement === 'boolean' ? { navPlacement: patch.navPlacement } : {}),
        ...(typeof patch.featured === 'boolean' ? { featured: patch.featured } : {}),
        ...(typeof patch.banner === 'string' ? { banner: patch.banner || undefined } : {}),
        ...(typeof patch.marginTarget === 'number' ? { marginTarget: patch.marginTarget } : {}),
        ...(typeof patch.availability === 'string' ? { availability: patch.availability || undefined } : {}),
        ...(typeof patch.compliance === 'string' ? { compliance: patch.compliance || undefined } : {}),
        ...(typeof patch.shippingProfile === 'string' ? { shippingProfile: patch.shippingProfile || undefined } : {}),
        ...(typeof patch.marketingHeadline === 'string' ? { marketingHeadline: patch.marketingHeadline || undefined } : {}),
        ...(typeof patch.marketingSub === 'string' ? { marketingSub: patch.marketingSub || undefined } : {}),
        ...(typeof patch.heroCta === 'string' ? { heroCta: patch.heroCta || undefined } : {}),
        ...(typeof patch.heroCtaLink === 'string' ? { heroCtaLink: patch.heroCtaLink || undefined } : {}),
        ...(typeof patch.contentPillar === 'string' ? { contentPillar: patch.contentPillar || undefined } : {}),
        ...(typeof patch.story === 'string' ? { story: patch.story || undefined } : {}),
        ...(typeof patch.themeColor === 'string' ? { themeColor: patch.themeColor || undefined } : {}),
        ...(Array.isArray(patch.shippingMatrix) ? { shippingMatrix: patch.shippingMatrix } : {}),
        ...(patch.metaJson && typeof patch.metaJson === 'object' ? { metaJson: patch.metaJson } : {}),
        ...(translations.length ? { translations } : {}),
      }

      const payload = await api.patch(endpoints.catalog.categoryById(id), dtoPatch)
      const updated = toCategory(payload as any)
      if (!updated) return null
      setCategories((prev) => uniqueBySlug(prev.map((c) => (c.id === id || c.slug === id ? updated : c))))
      return updated
    },
    [api]
  )

  const deleteCategory = useCallback(
    async (id: string) => {
      await api.delete(endpoints.catalog.categoryById(id))
      setCategories((prev) => prev.filter((c) => c.id !== id && c.slug !== id))
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
    updateCategory,
    deleteCategory,
  }
}

export function usePublicCategories(options?: { page?: number; limit?: number; isActive?: boolean; isHomepage?: boolean }) {
  const api = useMemo(() => createApiClient(), [])
  const params = useMemo(
    () => ({
      page: options?.page,
      limit: options?.limit,
      isActive: options?.isActive,
      isHomepage: options?.isHomepage,
    }),
    [options?.isActive, options?.limit, options?.page, options?.isHomepage]
  )

  const cacheKey = useMemo(
    () => `public:categories:${params.page ?? 'all'}:${params.limit ?? 'all'}:${params.isActive ?? 'any'}:${params.isHomepage ?? 'any'}`,
    [params]
  )

  const cachedCategories = useMemo(
    () => readCache<Category[]>(cacheKey, PUBLIC_CATEGORIES_CACHE_TTL_MS),
    [cacheKey]
  )

  const [categories, setCategories] = useState<Category[]>(cachedCategories || [])
  const [isLoading, setIsLoading] = useState(!cachedCategories)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    const hasCache = categories.length > 0
    setError(null)
    if (hasCache) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const next = uniqueBySlug(
        extractList(await api.get(endpoints.catalog.publicCategories(params)))
          .map(toCategory)
          .filter(Boolean) as Category[]
      )
      setCategories(next)
      writeCache(cacheKey, next)
    } catch (e: any) {
      if (!hasCache) setCategories([])
      setError(e?.message || 'Failed to load categories')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [api, cacheKey, categories.length, params])

  useEffect(() => {
    if (cachedCategories && cachedCategories.length) {
      setCategories(cachedCategories)
      setIsLoading(false)
    }

    const schedule =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? (cb: () => void) => (window as any).requestIdleCallback(cb)
        : (cb: () => void) => window.setTimeout(cb, 0)

    schedule(fetchCategories)
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
    isRefreshing,
    error,
    refresh: fetchCategories,
  }
}
