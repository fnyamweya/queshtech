import type { Product, ProductBadge } from '@/types'

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1542293771-74b2f55e73d7?w=1200&q=80&auto=format&fit=crop'

function normalizeSortOrder(value: unknown): number | undefined {
  const n = toNumber(value)
  return typeof n === 'number' ? n : undefined
}

function sortAndDedupeImages(images: Product['images']): Product['images'] {
  const seen = new Set<string>()
  const uniq = images.filter((img) => {
    const key = String(img.url || '').trim()
    if (!key) return false
    const lower = key.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })

  const orderValue = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return [...uniq].sort((a, b) => {
    const ap = Boolean(a.isPrimary)
    const bp = Boolean(b.isPrimary)
    if (ap !== bp) return ap ? -1 : 1
    const ao = orderValue(a.sortOrder)
    const bo = orderValue(b.sortOrder)
    if (ao !== bo) return ao - bo
    return a.url.localeCompare(b.url)
  })
}

function pickLocalizedString(value: any): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || Array.isArray(value)) return undefined

  const preferred = [value.en, value['en-KE'], value['en_US']]
  for (const v of preferred) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }

  for (const v of Object.values(value)) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }

  return undefined
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function firstPriceEntry(...sources: any[]): any | undefined {
  for (const source of sources) {
    if (!source) continue
    if (Array.isArray(source) && source.length) return source[0]
    if (typeof source === 'object') {
      if ('unitPrice' in source || 'unit_price' in source || 'price' in source || 'amount' in source) return source
      if (Array.isArray((source as any).items) && (source as any).items.length) return (source as any).items[0]
      if (Array.isArray((source as any).data) && (source as any).data.length) return (source as any).data[0]
      if (Array.isArray((source as any).prices) && (source as any).prices.length) return (source as any).prices[0]
    }
  }
  return undefined
}

function stringifyAttribute(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    const list = value
      .map((v) => stringifyAttribute(v))
      .filter((v): v is string => Boolean(v && v.trim()))
    return list.length ? list.join(', ') : null
  }
  if (typeof value === 'object') {
    const v: any = value as any
    if ('value' in v) {
      const base = stringifyAttribute(v.value)
      const unit = typeof v.unit === 'string' ? v.unit.trim() : ''
      if (!base) return null
      return unit ? `${base} ${unit}` : base
    }
  }
  return null
}

function normalizeBadge(raw: any): ProductBadge | undefined {
  if (!raw) return undefined
  const value = typeof raw === 'string' ? raw.toLowerCase() : typeof raw.label === 'string' ? raw.label.toLowerCase() : undefined
  if (!value) return undefined
  if (value.includes('new')) return { type: 'new', label: 'New' }
  if (value.includes('sale') || value.includes('deal')) return { type: 'sale', label: 'Sale' }
  if (value.includes('best')) return { type: 'bestseller', label: 'Bestseller' }
  return { type: 'exclusive', label: typeof raw.label === 'string' ? raw.label : value }
}

function asText(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') {
    const t = value.trim()
    return t ? t : undefined
  }
  return pickLocalizedString(value)
}

export function mapToProduct(raw: any): Product | null {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id || raw._id || raw.productId || raw.slug || raw.handle || '').trim()
  const slug = String(raw.slug || raw.handle || raw.code || raw.key || id).trim()
  const localizedName = pickLocalizedString(raw.name)
  const name = String(raw.title || localizedName || raw.name || raw.label || slug).trim()
  if (!id || !slug || !name) return null

  const brandRaw = raw.brand
  const brand = typeof brandRaw === 'string'
    ? brandRaw
    : typeof brandRaw?.name === 'string'
      ? brandRaw.name
      : typeof brandRaw?.title === 'string'
        ? brandRaw.title
        : 'Brand'

  const defaultSku = Array.isArray(raw.skus) ? raw.skus.find((s: any) => s?.isDefault) || raw.skus[0] : undefined
  const priceCandidate = firstPriceEntry(
    defaultSku?.prices,
    raw.prices,
    raw.pricing?.prices,
    raw.attributes?.prices,
    raw.defaultPrice,
    raw.price
  )
  const priceRaw =
    (typeof priceCandidate === 'number' || typeof priceCandidate === 'string' ? priceCandidate : undefined) ??
    priceCandidate?.unitPrice ??
    priceCandidate?.unit_price ??
    priceCandidate?.price ??
    priceCandidate?.amount ??
    raw.price ??
    raw.unitPrice ??
    raw.defaultPrice ??
    raw.pricing?.price
  const attributePrice =
    toNumber(raw.attributes?.price) ??
    toNumber(raw.attributes?.unitPrice) ??
    toNumber(raw.attributes?.pricing?.price) ??
    toNumber(raw.attributes?.pricing?.basePrice) ??
    toNumber(raw.pricing?.basePrice)
  const price = toNumber(priceRaw) ?? attributePrice ?? 0
  const compareRaw =
    priceCandidate?.compareAtPrice ??
    priceCandidate?.compare_at_price ??
    priceCandidate?.compareAt ??
    raw.compareAtPrice ??
    raw.compare_at_price ??
    raw.pricing?.compareAt
  const compareAtPrice = toNumber(compareRaw) ?? toNumber(raw.attributes?.compareAtPrice) ?? toNumber(raw.attributes?.pricing?.compareAt) ?? null
  const currency =
    priceCandidate?.currencyCode ||
    priceCandidate?.currency ||
    raw.currencyCode ||
    raw.currency ||
    raw.pricing?.currency ||
    raw.attributes?.currencyCode ||
    raw.attributes?.currency ||
    raw.attributes?.pricing?.currency ||
    ''

  const imagesRaw = raw.images || raw.media || []
  const images = Array.isArray(imagesRaw)
    ? imagesRaw
        .map((img: any) => {
          if (typeof img === 'string') return { id: img, url: img, alt: name }
          if (img && typeof img === 'object') {
            const url = img.url || img.src || img.imageUrl || img.original || img.path
            const alt = img.alt || img.label || img.caption || name
            if (url) {
              return {
                id: img.id || url,
                url,
                alt,
                isPrimary: Boolean(img.isPrimary ?? img.is_primary),
                sortOrder: normalizeSortOrder(img.sortOrder ?? img.sort_order),
                skuId: typeof img.skuId === 'string' ? img.skuId : undefined,
              }
            }
          }
          return null
        })
        .filter((img): img is { id: string; url: string; alt: string } => Boolean(img))
    : []

  if (images.length === 0 && typeof raw.image === 'string') {
    images.push({ id: raw.image, url: raw.image, alt: name })
  }

  if (images.length === 0) {
    images.push({ id: FALLBACK_IMAGE, url: FALLBACK_IMAGE, alt: name })
  }

  const normalizedImages = sortAndDedupeImages(images)

  const ratingRaw = raw.rating ?? raw.averageRating ?? raw.attributes?.avgRating ?? raw.attributes?.rating
  const rating = typeof ratingRaw === 'number' ? ratingRaw : 0
  const reviewRaw =
    raw.reviewCount ?? raw.reviewsCount ?? raw.reviews_total ?? raw.attributes?.ratingCount ?? raw.attributes?.reviewCount
  const reviewCount = typeof reviewRaw === 'number' ? reviewRaw : 0

  const categoriesRaw = Array.isArray(raw.categories) ? raw.categories : []
  const primaryCategory = categoriesRaw.find((c: any) => c && typeof c === 'object') || raw.category || raw.collection || {}
  const categoryIdFallback = Array.isArray(raw.categoryIds) ? String(raw.categoryIds[0] || '').trim() : ''
  const categorySlug = String(primaryCategory.slug || primaryCategory.handle || categoryIdFallback || 'catalog').trim()
  const categoryName = String(primaryCategory.name || primaryCategory.title || 'Catalog').trim()

  const badgesInput = raw.badges || raw.tags
  const firstBadge = Array.isArray(badgesInput) ? normalizeBadge(badgesInput[0]) : normalizeBadge(badgesInput)

  const inStockRaw =
    raw.inStock ??
    raw.available ??
    raw.inventory?.available ??
    raw.attributes?.inStock ??
    raw.attributes?.available ??
    raw.attributes?.availability?.inStock
  const stockCountRaw =
    raw.stockCount ??
    raw.inventory?.quantity ??
    raw.attributes?.stockCount ??
    raw.attributes?.availability?.stockCount ??
    raw.attributes?.availability?.stock?.quantity

  const variants: Product['variants'] = []
  const skus = Array.isArray(raw.skus)
    ? raw.skus
        .map((s: any) => {
          const id = String(s?.id || s?.skuId || s?.code || s?.sku || '').trim()
          if (!id) return null
          const code = String(s?.code || s?.sku || id).trim()
          return {
            id,
            code: code || undefined,
            title: typeof s?.title === 'string' ? s.title : undefined,
            options: s?.options && typeof s.options === 'object' ? (s.options as Record<string, string>) : undefined,
            isDefault: Boolean(s?.isDefault),
          }
        })
        .filter(Boolean)
    : undefined
  const optionDefinitions = Array.isArray(raw.optionDefinitions) ? raw.optionDefinitions : []
  if (optionDefinitions.length) {
    for (const opt of optionDefinitions) {
      const key = String(opt.key || '').trim()
      if (!key) continue
      const values = Array.isArray(opt.allowedValues)
        ? opt.allowedValues
        : Array.isArray(raw.skus)
          ? Array.from(new Set(raw.skus.map((s: any) => s?.options?.[key]).filter(Boolean)))
          : []
      for (const value of values) {
        variants.push({
          id: `${key}:${value}`,
          name: String(value),
          type: key,
          value: String(value),
          inStock: true,
        })
      }
    }
  } else if (Array.isArray(raw.variants)) {
    const variantsRaw = raw.variants
    variantsRaw
      .map((v: any) => {
        const vid = String(v.id || v._id || v.variantId || v.sku || '').trim()
        const value = String(v.value || v.option || v.name || v.title || '').trim()
        const type = String(v.type || v.kind || '').toLowerCase()
        if (!vid || !value || !type) return null
        return {
          id: vid,
          name: v.name || v.title || value,
          type,
          value,
          inStock: typeof v.inStock === 'boolean' ? v.inStock : true,
          colorHex: typeof v.colorHex === 'string' ? v.colorHex : undefined,
          priceModifier: typeof v.priceModifier === 'number' ? v.priceModifier : undefined,
        }
      })
      .filter(Boolean)
      .forEach((v: any) => variants.push(v))
  }

  const description =
    asText(raw.description) ??
    asText(raw.longDescription) ??
    asText(raw.translations?.[0]?.description) ??
    asText(raw.attributes?.description) ??
    asText(raw.shortDescription) ??
    ''

  const shortDescription =
    asText(raw.shortDescription) ??
    asText(raw.translations?.[0]?.shortDescription) ??
    asText(raw.attributes?.shortDescription) ??
    undefined

  return {
    id: id || slug,
    name,
    brand,
    slug,
    description,
    shortDescription,
    price,
    compareAtPrice: compareAtPrice ?? undefined,
    currency,
    images: normalizedImages,
    category: {
      id: String(primaryCategory.id || primaryCategory._id || categoryIdFallback || categorySlug || 'catalog'),
      name: categoryName,
      slug: categorySlug || 'catalog',
    },
    rating,
    reviewCount,
    inStock: typeof inStockRaw === 'boolean' ? inStockRaw : true,
    stockCount: typeof stockCountRaw === 'number' ? stockCountRaw : undefined,
    variants,
    skus,
    specifications:
      raw.specifications && typeof raw.specifications === 'object'
        ? raw.specifications
        : raw.attributes && typeof raw.attributes === 'object'
          ? (Object.fromEntries(
              Object.entries(raw.attributes as Record<string, unknown>)
                .map(([k, v]) => [k, stringifyAttribute(v)])
                .filter(([, v]) => typeof v === 'string' && v.trim())
            ) as Record<string, string>)
          : {},
    badges: firstBadge ? [firstBadge] : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags : undefined,
  }
}
