import type { Product, ProductBadge } from '@/types'

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1542293771-74b2f55e73d7?w=1200&q=80&auto=format&fit=crop'

function normalizeBadge(raw: any): ProductBadge | undefined {
  if (!raw) return undefined
  const value = typeof raw === 'string' ? raw.toLowerCase() : typeof raw.label === 'string' ? raw.label.toLowerCase() : undefined
  if (!value) return undefined
  if (value.includes('new')) return { type: 'new', label: 'New' }
  if (value.includes('sale') || value.includes('deal')) return { type: 'sale', label: 'Sale' }
  if (value.includes('best')) return { type: 'bestseller', label: 'Bestseller' }
  return { type: 'exclusive', label: typeof raw.label === 'string' ? raw.label : value }
}

export function mapToProduct(raw: any): Product | null {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id || raw._id || raw.productId || raw.slug || raw.handle || '').trim()
  const slug = String(raw.slug || raw.handle || raw.code || raw.key || id).trim()
  const name = String(raw.title || raw.name || raw.label || slug).trim()
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
  const priceCandidate = defaultSku?.prices?.[0] || raw.prices?.[0]
  const priceRaw = priceCandidate?.unitPrice ?? raw.price ?? raw.unitPrice ?? raw.defaultPrice ?? raw.pricing?.price
  const price = typeof priceRaw === 'number' ? priceRaw : typeof priceRaw === 'string' ? Number(priceRaw) || 0 : 0
  const compareRaw = priceCandidate?.compareAtPrice ?? raw.compareAtPrice ?? raw.compare_at_price ?? raw.pricing?.compareAt
  const compareAtPrice = typeof compareRaw === 'number' ? compareRaw : typeof compareRaw === 'string' ? Number(compareRaw) || null : null
  const currency = raw.currency || raw.currencyCode || raw.pricing?.currency || 'KES'

  const imagesRaw = raw.images || raw.media || defaultSku?.images || []
  const images = Array.isArray(imagesRaw)
    ? imagesRaw
        .map((img: any) => {
          if (typeof img === 'string') return { id: img, url: img, alt: name }
          if (img && typeof img === 'object') {
            const url = img.url || img.src || img.imageUrl || img.original || img.path
            const alt = img.alt || img.label || img.caption || name
            if (url) return { id: url, url, alt }
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

  const ratingRaw = raw.rating ?? raw.averageRating
  const rating = typeof ratingRaw === 'number' ? ratingRaw : 0
  const reviewRaw = raw.reviewCount ?? raw.reviewsCount ?? raw.reviews_total
  const reviewCount = typeof reviewRaw === 'number' ? reviewRaw : 0

  const categoryRaw = raw.category || raw.collection || {}
  const categoryIdFallback = Array.isArray(raw.categoryIds) ? String(raw.categoryIds[0] || '').trim() : ''
  const categorySlug = String(categoryRaw.slug || categoryRaw.handle || categoryIdFallback || 'catalog').trim()
  const categoryName = String(categoryRaw.name || categoryRaw.title || 'Catalog').trim()

  const badgesInput = raw.badges || raw.tags
  const firstBadge = Array.isArray(badgesInput) ? normalizeBadge(badgesInput[0]) : normalizeBadge(badgesInput)

  const inStockRaw = raw.inStock ?? raw.available ?? raw.inventory?.available
  const stockCountRaw = raw.stockCount ?? raw.inventory?.quantity

  const variants: Product['variants'] = []
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

  return {
    id: id || slug,
    name,
    brand,
    slug,
    description: raw.description || raw.shortDescription || raw.translations?.[0]?.description || '',
    price,
    compareAtPrice: compareAtPrice ?? undefined,
    currency,
    images,
    category: {
      id: String(categoryRaw.id || categoryRaw._id || categoryIdFallback || categorySlug || 'catalog'),
      name: categoryName,
      slug: categorySlug || 'catalog',
    },
    rating,
    reviewCount,
    inStock: typeof inStockRaw === 'boolean' ? inStockRaw : true,
    stockCount: typeof stockCountRaw === 'number' ? stockCountRaw : undefined,
    variants,
    specifications: raw.specifications && typeof raw.specifications === 'object' ? raw.specifications : {},
    badges: firstBadge ? [firstBadge] : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags : undefined,
  }
}
