import type { Product } from '@/types'

const KEY = 'qt_recently_viewed_products_v1'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export type StoredProduct = Pick<
  Product,
  | 'id'
  | 'slug'
  | 'name'
  | 'brand'
  | 'price'
  | 'compareAtPrice'
  | 'currency'
  | 'images'
  | 'category'
  | 'rating'
  | 'reviewCount'
  | 'inStock'
  | 'stockCount'
  | 'badges'
  | 'tags'
>

function normalizeStored(item: any): StoredProduct | null {
  if (!item || typeof item !== 'object') return null
  if (typeof item.id !== 'string' || !item.id.trim()) return null
  if (typeof item.slug !== 'string' || !item.slug.trim()) return null
  if (typeof item.name !== 'string' || !item.name.trim()) return null
  if (typeof item.price !== 'number') return null

  return item as StoredProduct
}

export function loadRecentlyViewed(): StoredProduct[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeStored).filter(Boolean).slice(0, 24) as StoredProduct[]
  } catch {
    return []
  }
}

export function saveRecentlyViewed(items: StoredProduct[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, 24)))
  } catch {
    // ignore
  }
}

export function addRecentlyViewed(product: Product, options?: { max?: number }): StoredProduct[] {
  const max = typeof options?.max === 'number' ? Math.max(1, Math.min(24, options.max)) : 12
  if (!product?.id) return loadRecentlyViewed()

  const current = loadRecentlyViewed()
  const next: StoredProduct[] = [
    {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      currency: product.currency,
      images: product.images,
      category: product.category,
      rating: product.rating,
      reviewCount: product.reviewCount,
      inStock: product.inStock,
      stockCount: product.stockCount,
      badges: product.badges,
      tags: product.tags,
    },
    ...current.filter((p) => p.id !== product.id),
  ].slice(0, max)

  saveRecentlyViewed(next)
  return next
}
