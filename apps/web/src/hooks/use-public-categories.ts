import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category } from '@/types'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'

type ApiCategoryLike = any

function toCategory(raw: ApiCategoryLike): Category | null {
  if (!raw || typeof raw !== 'object') return null

  const translations: any[] = Array.isArray(raw.translations) ? raw.translations : []
  const translation =
    translations.find((t) => t && typeof t === 'object' && typeof t.locale === 'string' && t.locale === 'en') || translations[0] || null

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

  const matrixRaw = Array.isArray((raw as any).shippingMatrix)
    ? (raw as any).shippingMatrix
    : Array.isArray((metaJson as any)?.shippingMatrix)
      ? ((metaJson as any).shippingMatrix as any[])
      : null

  const shippingMatrix =
    Array.isArray(matrixRaw) && matrixRaw.every((x) => x && typeof x === 'object')
      ? ((matrixRaw as any[]).map((x) => ({
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function usePublicCategoryById(options: { id?: string | null; locale?: string }) {
  const api = useMemo(() => createApiClient(), [])
  const [category, setCategory] = useState<Category | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const id = options.id ? String(options.id).trim() : ''
    if (!id || !isUuid(id)) {
      setCategory(null)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const base = endpoints.catalog.publicCategoryById(id)
      const locale = options.locale ? String(options.locale).trim() : ''
      const url = locale ? `${base}?${new URLSearchParams({ locale }).toString()}` : base
      const payload = await api.get<any>(url)
      setCategory(toCategory(payload))
    } catch (e: any) {
      setCategory(null)
      setError(e?.message || 'Failed to load category')
    } finally {
      setIsLoading(false)
    }
  }, [api, options.id, options.locale])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { category, isLoading, error, refresh }
}
