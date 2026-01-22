import type { Product } from '@/types'
import type { ProductCardAdapter, ProductCardOptionGroup } from './types'

function primaryImage(images: Array<{ url: string; alt?: string; isPrimary?: boolean }>) {
  return images.find((i) => i.isPrimary) || images[0]
}

export function defaultProductAdapter(): ProductCardAdapter<Product> {
  return {
    getId: (p) => p.id,
    getHref: (p) => `/product/${p.slug}`,
    getTitle: (p) => p.name,
    getSubtitle: (p) => p.description || null,
    getDescription: (p) => p.description || null,
    getBrand: (p) => p.brand || null,
    getImages: (p) => (p.images || []).map((img) => ({ url: img.url, alt: img.alt, isPrimary: img.isPrimary })),
    getBadges: (p) => {
      const out = (p.badges || []).map((b) => ({
        key: `${b.type}:${b.label}`,
        label: b.label,
        variant: (b.type === 'sale' ? 'destructive' : b.type === 'new' ? 'success' : 'secondary') as const,
      }))

      if (typeof p.compareAtPrice === 'number' && typeof p.price === 'number' && p.compareAtPrice > p.price) {
        out.unshift({ key: 'sale', label: 'Sale', variant: 'destructive' as const })
      }

      return out
    },
    getPrice: (p) => (typeof p.price === 'number' ? p.price : null),
    getCompareAtPrice: (p) => (typeof p.compareAtPrice === 'number' ? p.compareAtPrice : null),
    getCurrency: (p) => p.currency,
    getRating: (p) => (typeof p.rating === 'number' ? p.rating : null),
    getReviewCount: (p) => (typeof p.reviewCount === 'number' ? p.reviewCount : null),
    getInStock: (p) => Boolean(p.inStock),
    getStockCount: (p) => (typeof p.stockCount === 'number' ? p.stockCount : null),
    getOptionGroups: (p) => {
      const variants = p.variants || []
      const groups = new Map<string, ProductCardOptionGroup>()

      for (const v of variants) {
        const key = String(v.type || 'option')
        const existing = groups.get(key)
        const group: ProductCardOptionGroup =
          existing ||
          ({
            id: key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            mode: key === 'color' ? 'swatches' : 'pills',
            values: [],
          } satisfies ProductCardOptionGroup)

        group.values.push({
          id: v.id,
          label: v.name,
          value: v.value,
          inStock: v.inStock,
          colorHex: v.colorHex,
        })

        groups.set(key, group)
      }

      // Prefer primary image and ensure stable ordering
      const img = primaryImage((p.images || []).map((i) => ({ url: i.url, alt: i.alt, isPrimary: i.isPrimary })))
      void img

      return Array.from(groups.values())
        .map((g) => ({
          ...g,
          values: [...g.values].sort((a, b) => a.label.localeCompare(b.label)),
        }))
        .sort((a, b) => {
          if (a.id === 'color') return -1
          if (b.id === 'color') return 1
          return a.label.localeCompare(b.label)
        })
    },
    getSpecs: (p) => {
      const s = p.specifications || {}
      const entries = Object.entries(s)
        .filter(([k, v]) => typeof k === 'string' && typeof v === 'string' && k.trim() && v.trim())
        .slice(0, 4)
        .map(([label, value]) => ({ label, value }))
      return entries
    },
  }
}
