import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useRoute } from 'wouter'
import type { Product } from '@/types'
import type { Banner } from '@/types/catalog'
import { usePublicCategoryProducts, usePublicProduct } from '@/hooks/use-public-products'
import { usePublicCategoryById } from '@/hooks/use-public-categories'
import { usePublicProductRatingSummary, usePublicProductReviews } from '@/hooks/use-public-product-reviews'
import { usePublicBanners } from '@/hooks/use-banners'
import { useWishlist } from '@/hooks/use-wishlist'
import { useDelayedFlag } from '@/hooks/use-delayed-flag'
import { cn } from '@/lib/utils'
import { addRecentlyViewed, loadRecentlyViewed, type StoredProduct } from '@/lib/recently-viewed'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { MarkdownContent } from '@/components/common/markdown-content'
import { Price } from '@/components/commerce/price'
import { Rating } from '@/components/commerce/rating'
import { OptionSelector } from '@/components/commerce/option-selector'
import { ImageZoomDialog } from '@/components/commerce/image-zoom-dialog'
import { ProductCard } from '@/components/commerce/product-card'
import type { ProductCardAdapter } from '@/components/commerce/product-card/types'
import { QuantityInput } from '@/components/commerce/quantity-input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
// NOTE: Radix TooltipTrigger ref composition can cause a ref attach/detach loop in some builds.
// We avoid it on this route to prevent "Maximum update depth exceeded".
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SimpleModal, SimpleModalHeader, SimpleModalFooter, SimpleModalTitle } from '@/components/ui/simple-modal'
import {
  ArrowLeft,
  ArrowsCounterClockwise,
  ChatCircleDots,
  Heart,
  MapPin,
  Package,
  SealCheck,
  ShareNetwork,
  ShieldCheck,
  Truck,
  WarningCircle,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

interface ProductDetailPageProps {
  onAddToCart: (product: Product, variants?: Record<string, string>, quantity?: number, skuId?: string) => void
}

function groupVariants(variants: Product['variants']) {
  return variants.reduce(
    (acc, variant) => {
      const key = variant.type
      if (!acc[key]) acc[key] = []
      acc[key].push(variant)
      return acc
    },
    {} as Record<string, Product['variants']>
  )
}

function discountPercent(product: Product) {
  if (!product.compareAtPrice) return null
  if (product.compareAtPrice <= product.price) return null
  return Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
}

const normalizeSkuPrices = (rawPrices: any): Array<{
  priceListId?: string
  unitPrice?: number
  compareAtPrice?: number | null
  minQuantity?: number | null
  maxQuantity?: number | null
}> => {
  if (!Array.isArray(rawPrices)) return []
  return rawPrices
    .map((p) => {
      const unitPrice = Number(p?.unitPrice ?? p?.price ?? p?.amount)
      if (!Number.isFinite(unitPrice)) return null
      return {
        priceListId: typeof p?.priceListId === 'string' ? p.priceListId : undefined,
        unitPrice,
        compareAtPrice: p?.compareAtPrice ?? p?.compare_at_price ?? null,
        minQuantity: typeof p?.minQuantity === 'number' ? p.minQuantity : null,
        maxQuantity: typeof p?.maxQuantity === 'number' ? p.maxQuantity : null,
      }
    })
    .filter(Boolean) as Array<{
    priceListId?: string
    unitPrice?: number
    compareAtPrice?: number | null
    minQuantity?: number | null
    maxQuantity?: number | null
  }>
}

const selectSkuPrice = (
  prices: Array<{ unitPrice?: number; compareAtPrice?: number | null; minQuantity?: number | null; maxQuantity?: number | null }>,
  quantity: number
) => {
  if (!prices.length) return null
  const qty = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1
  const match = prices.find((p) => {
    const min = typeof p.minQuantity === 'number' ? p.minQuantity : 1
    const max = typeof p.maxQuantity === 'number' ? p.maxQuantity : undefined
    if (qty < min) return false
    if (typeof max === 'number' && qty > max) return false
    return true
  })
  return match || prices[0]
}

function stripMarkdown(value: string) {
  return String(value || '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/>\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function shortDescriptionFromMarkdown(markdown: string, maxLen = 180) {
  const firstPara = String(markdown || '').split(/\n{2,}/)[0] || ''
  const text = stripMarkdown(firstPara)
  if (!text) return null
  if (text.length <= maxLen) return text
  return text.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…'
}

function pickLocalizedValue(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || Array.isArray(value)) return undefined
  const v: any = value as any
  const candidates = [v.en, v['en-KE'], v['en_US']]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  for (const candidate of Object.values(v)) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return undefined
}

function normalizeOptionKey(key: string) {
  return String(key || '').trim()
}

function isColorKey(key: string) {
  const k = String(key || '').toLowerCase()
  return k.includes('color') || k.includes('colour') || k.includes('shade') || k.includes('tone') || k.includes('finish')
}

function normalizeHex(input: string) {
  const value = String(input || '').trim()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value.toLowerCase()
  return null
}

function resolveColorHex(value: string) {
  const normalized = normalizeHex(value)
  if (normalized) return normalized
  const name = String(value || '').trim().toLowerCase()
  const map: Record<string, string> = {
    black: '#111827',
    white: '#f9fafb',
    gray: '#9ca3af',
    grey: '#9ca3af',
    silver: '#d1d5db',
    red: '#ef4444',
    maroon: '#7f1d1d',
    orange: '#f97316',
    amber: '#f59e0b',
    yellow: '#eab308',
    lime: '#84cc16',
    green: '#22c55e',
    emerald: '#10b981',
    teal: '#14b8a6',
    cyan: '#06b6d4',
    blue: '#3b82f6',
    navy: '#1e3a8a',
    indigo: '#6366f1',
    purple: '#a855f7',
    violet: '#8b5cf6',
    pink: '#ec4899',
    rose: '#f43f5e',
    brown: '#92400e',
    beige: '#f5f5dc',
    cream: '#fef3c7',
    gold: '#d4af37',
  }
  return map[name] || undefined
}

function humanizeKey(key: string) {
  const raw = String(key || '').trim()
  if (!raw) return ''
  const cleaned = raw
    .replace(/[_-]+/g, ' ')
    .replace(/\./g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : raw
}

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  try {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
  } catch {
    return value
  }
}

function addBusinessDays(from: Date, days: number) {
  const d = new Date(from)
  let remaining = Math.max(0, Math.floor(days))
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) remaining -= 1
  }
  return d
}

function estimateArrivalRange(sla: string | undefined, now = new Date()) {
  const text = String(sla || '').toLowerCase()
  if (!text) return null
  if (text.includes('same/next')) {
    const start = addBusinessDays(now, 0)
    const end = addBusinessDays(now, 1)
    return `${formatDate(start.toISOString())} – ${formatDate(end.toISOString())}`
  }

  const match = text.match(/(\d+)\s*(?:–|-|to)\s*(\d+)/)
  if (match) {
    const minDays = Number(match[1])
    const maxDays = Number(match[2])
    if (Number.isFinite(minDays) && Number.isFinite(maxDays)) {
      const add = text.includes('business') ? addBusinessDays : (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
      const start = add(now, minDays)
      const end = add(now, maxDays)
      if (minDays === maxDays) return formatDate(start.toISOString())
      return `${formatDate(start.toISOString())} – ${formatDate(end.toISOString())}`
    }
  }

  return null
}

function viewLocationForZone(zone: string): string | undefined {
  const z = String(zone || '').trim().toLowerCase()
  if (!z) return undefined
  if (z.includes('nairobi') || z.includes('kiambu')) return 'ke-nbi'
  if (z.includes('east africa') || z.includes('east-africa')) return 'ea'
  if (z.includes('uganda') || z.includes('tanzania') || z.includes('rwanda') || z.includes('burundi')) return 'ea'
  if (z.includes('kenya')) return 'ke'
  return undefined
}

type SpecGroup = 'Highlights' | 'Display' | 'Performance' | 'Camera' | 'Battery' | 'Connectivity' | 'Design' | 'Other'

function specGroupFor(key: string): SpecGroup {
  const k = key.toLowerCase()
  if (k.includes('display') || k.includes('screen') || k.includes('resolution') || k.includes('refresh')) return 'Display'
  if (k.includes('processor') || k.includes('cpu') || k.includes('gpu') || k.includes('ram') || k.includes('chip')) return 'Performance'
  if (k.includes('camera') || k.includes('lens') || k.includes('mp')) return 'Camera'
  if (k.includes('battery') || k.includes('mah') || k.includes('charging')) return 'Battery'
  if (k.includes('wifi') || k.includes('bluetooth') || k.includes('5g') || k.includes('4g') || k.includes('network') || k.includes('nfc'))
    return 'Connectivity'
  if (k.includes('weight') || k.includes('dimension') || k.includes('height') || k.includes('width') || k.includes('length') || k.includes('material'))
    return 'Design'
  return 'Other'
}

function buildSpecGroups(specs: Record<string, string>) {
  const entries = Object.entries(specs || {}).filter(([k, v]) => k && v)
  const groups: Record<SpecGroup, Array<{ key: string; value: string }>> = {
    Highlights: [],
    Display: [],
    Performance: [],
    Camera: [],
    Battery: [],
    Connectivity: [],
    Design: [],
    Other: [],
  }

  for (const [key, value] of entries) {
    const group = specGroupFor(key)
    groups[group].push({ key, value })
  }

  for (const g of Object.keys(groups) as SpecGroup[]) {
    groups[g] = groups[g].sort((a, b) => a.key.localeCompare(b.key))
  }

  const preferred: SpecGroup[] = ['Display', 'Performance', 'Battery', 'Camera', 'Connectivity', 'Design']
  const highlights: Array<{ key: string; value: string }> = []
  for (const g of preferred) {
    for (const item of groups[g]) {
      if (highlights.length >= 4) break
      highlights.push(item)
    }
    if (highlights.length >= 4) break
  }
  groups.Highlights = highlights

  return groups
}

function ProductMedia({
  product,
  images,
  selectedIndex,
  onSelectIndex,
  onZoom,
}: {
  product: Product
  images: Product['images']
  selectedIndex: number
  onSelectIndex: (index: number) => void
  onZoom: () => void
}) {
  const safeImages = images.length ? images : [{ id: 'empty', url: '', alt: product.name }]
  const safeIndex = Math.min(Math.max(0, selectedIndex), safeImages.length - 1)
  const selected = safeImages[safeIndex]
  const maxThumbs = 3
  const baseThumbs = safeImages.slice(0, maxThumbs)
  const thumbImages =
    safeIndex < maxThumbs ? baseThumbs : [...baseThumbs.slice(0, Math.max(0, maxThumbs - 1)), selected]

  return (
    <div className="rounded-[28px] border bg-muted/10 p-3 sm:p-4">
      <div className="relative overflow-hidden rounded-[22px] bg-muted/20">
        <button
          type="button"
          className="block w-full"
          onClick={onZoom}
          aria-label="Open image zoom"
        >
          <div className="aspect-[4/5] w-full sm:aspect-square">
            {selected.url ? (
              <img
                src={selected.url}
                alt={selected.alt || product.name}
                className="h-full w-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="h-full w-full bg-muted" />
            )}
          </div>
        </button>

        {safeImages.length > 1 ? (
          <div className="pointer-events-none absolute left-4 top-4">
            <Badge variant="secondary" className="bg-background/85 backdrop-blur">
              {safeIndex + 1}/{safeImages.length}
            </Badge>
          </div>
        ) : null}
      </div>

      {safeImages.length > 1 ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {thumbImages.map((img) => {
            const idx = safeImages.findIndex((i) => i.id === img.id)
            const isSelected = idx === safeIndex
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => onSelectIndex(idx === -1 ? 0 : idx)}
                className={cn(
                  'relative shrink-0 overflow-hidden rounded-2xl border bg-muted/15 transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  isSelected ? 'border-foreground' : 'hover:border-border'
                )}
                aria-label="Select image"
              >
                <div className="aspect-square w-[88px] sm:w-[104px]">
                  {img.url ? <img src={img.url} alt={img.alt || product.name} className="h-full w-full object-cover" loading="lazy" /> : null}
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function PromoBannerTile({ banner, compact }: { banner: Banner; compact?: boolean }) {
  const title = banner.title || banner.subtitle || 'Offer'
  const description = banner.description || ''
  const href = banner.creative?.cta?.url || banner.href
  const cta = banner.creative?.cta?.label || banner.ctaLabel

  const content = (
    <div
      className={cn(
        'group relative overflow-hidden border bg-gradient-to-br from-background via-background/70 to-muted shadow-sm',
        'transition-shadow hover:shadow-lg',
        'rounded-2xl',
        compact && 'aspect-[4/3]'
      )}
    >
      <div className="absolute inset-0">
        {banner.imageUrl ? <img src={banner.imageUrl} alt={title} className="h-full w-full object-cover" loading="lazy" /> : null}
        <div
          className={cn(
            'absolute inset-0',
            compact ? 'bg-gradient-to-t from-background/90 via-background/20 to-background/0' : 'bg-gradient-to-r from-background/95 via-background/80 to-background/40'
          )}
        />
      </div>
      <div className={cn('relative h-full', compact ? 'flex flex-col justify-end p-3' : 'p-4 space-y-2')}>
        {!compact && banner.subtitle ? (
          <Badge variant="secondary" className="uppercase text-[11px] tracking-wide">
            {banner.subtitle}
          </Badge>
        ) : null}
        <div className={cn('font-semibold leading-snug', compact ? 'text-xs line-clamp-2' : 'text-sm')}>{title}</div>
        {!compact && description ? <div className="text-xs text-muted-foreground line-clamp-2">{description}</div> : null}
        {!compact && cta ? <div className="text-xs font-semibold text-primary">{cta} →</div> : null}
      </div>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}

export function ProductDetailPage({ onAddToCart }: ProductDetailPageProps) {
  const [, params] = useRoute('/product/:slug')
  const [, navigate] = useLocation()

  const [deliveryZone, setDeliveryZone] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Nairobi & Kiambu'
    try {
      const raw = window.localStorage.getItem('qt_delivery_zone')
      return raw ? String(JSON.parse(raw)) : 'Nairobi & Kiambu'
    } catch {
      return 'Nairobi & Kiambu'
    }
  })

  const setDeliveryZoneAndPersist = useCallback((value: string) => {
    setDeliveryZone(value)
    try {
      window.localStorage.setItem('qt_delivery_zone', JSON.stringify(value))
    } catch {
      // ignore
    }
  }, [])

  const channelHint = useMemo(() => {
    const raw =
      import.meta.env.VITE_DEFAULT_CHANNEL_CODE || import.meta.env.VITE_CHANNEL_CODE || import.meta.env.VITE_WEB_CHANNEL_CODE
    const value = typeof raw === 'string' ? raw.trim() : ''
    return value ? value.toUpperCase() : undefined
  }, [])

  const locationHint = useMemo(() => {
    return viewLocationForZone(deliveryZone)
  }, [deliveryZone])

  const viewParams = useMemo(
    () => ({
      channel: channelHint,
      location: locationHint,
    }),
    [channelHint, locationHint]
  )

  const { product, raw: productViewPayload, isLoading, error } = usePublicProduct({
    idOrSlug: params?.slug,
    view: true,
    viewParams,
  })

  const { category: categoryDetail } = usePublicCategoryById({ id: product?.category?.id || null })

  const { featureBanners } = usePublicBanners()
  const { summary: ratingSummary, isLoading: isRatingLoading } = usePublicProductRatingSummary(product?.id)
  const reviews = usePublicProductReviews({ productId: product?.id, limit: 8, sort: 'newest' })
  const setReviewsPage = reviews.setPage

  const { items: relatedProducts, isLoading: isRelatedLoading } = usePublicCategoryProducts({
    categoryId: product?.category?.id,
    limit: 6,
    view: true,
  })

  const showLoading = useDelayedFlag(isLoading)
  const showRelatedLoading = useDelayedFlag(isRelatedLoading)

  const [selectedImage, setSelectedImage] = useState(0)
  const [isZoomOpen, setIsZoomOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [isAddToCartModalOpen, setIsAddToCartModalOpen] = useState(false)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [specQuery, setSpecQuery] = useState('')
  const [notifyContact, setNotifyContact] = useState('')
  const [recentlyViewed, setRecentlyViewed] = useState(() => loadRecentlyViewed())

  const { toggle: toggleWishlist, isInWishlist } = useWishlist()

  const recentlyViewedAdapter = useMemo<ProductCardAdapter<StoredProduct>>(
    () => ({
      getId: (p) => p.id,
      getHref: (p) => `/product/${p.slug}`,
      getTitle: (p) => p.name,
      getSubtitle: (p) => p.category?.name || null,
      getBrand: (p) => p.brand || null,
      getImages: (p) => (p.images || []).map((img) => ({ url: img.url, alt: img.alt, isPrimary: img.isPrimary })),
      getBadges: (p) => {
        const out: Array<{ key: string; label: string; variant: 'destructive' | 'success' | 'secondary' }> = (p.badges || []).map(
          (b) => ({
          key: `${b.type}:${b.label}`,
          label: b.label,
          variant: (b.type === 'sale' ? 'destructive' : b.type === 'new' ? 'success' : 'secondary') as
            | 'destructive'
            | 'success'
            | 'secondary',
          })
        )

        if (typeof p.compareAtPrice === 'number' && typeof p.price === 'number' && p.compareAtPrice > p.price) {
          out.unshift({ key: 'sale', label: 'Sale', variant: 'destructive' })
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
      getSpecs: () => [],
    }),
    []
  )

  const images = product?.images ?? []
  const groupedVariants = useMemo(
    () => groupVariants(Array.isArray(product?.variants) ? product.variants : []),
    [product?.variants]
  )

  const skuData = useMemo(() => {
    const rawSkus = Array.isArray((productViewPayload as any)?.skus) ? (productViewPayload as any).skus : []
    return rawSkus
      .map((sku: any, index: number) => {
        const id = String(sku?.id || sku?.sku || sku?.code || index).trim()
        if (!id) return null
        const name =
          (typeof sku?.title === 'string' ? sku.title : undefined) ||
          pickLocalizedValue(sku?.name) ||
          (typeof sku?.name === 'string' ? sku.name : undefined)
        const optionsRaw = sku?.options && typeof sku.options === 'object' ? sku.options : sku?.attributes?.options
        const options = Object.fromEntries(
          Object.entries(optionsRaw || {})
            .map(([k, v]) => [normalizeOptionKey(k), String(v ?? '').trim()])
            .filter(([k, v]) => k && v)
        ) as Record<string, string>
        const prices = normalizeSkuPrices(sku?.prices)
        return {
          id,
          code: String(sku?.code || sku?.sku || sku?.id || id).trim(),
          name,
          options,
          availability: sku?.availability ?? {},
          isDefault: Boolean(sku?.isDefault ?? sku?.is_default),
          prices,
        }
      })
      .filter(Boolean) as Array<{
      id: string
      code: string
      name?: string
      options: Record<string, string>
      availability?: Record<string, unknown>
      isDefault?: boolean
      prices: Array<{
        priceListId?: string
        unitPrice?: number
        compareAtPrice?: number | null
        minQuantity?: number | null
        maxQuantity?: number | null
      }>
    }>
  }, [productViewPayload])

  const productLevelPrices = useMemo(() => {
    const rawPrices = (productViewPayload as any)?.prices
    return normalizeSkuPrices(rawPrices)
  }, [productViewPayload])

  const optionDefinitions = useMemo(() => {
    const rawDefs = Array.isArray((productViewPayload as any)?.optionDefinitions)
      ? (productViewPayload as any).optionDefinitions
      : []
    return rawDefs
      .map((def: any) => {
        const key = normalizeOptionKey(def?.key || def?.name)
        if (!key) return null
        const label = String(def?.label || def?.name || key).trim() || key
        const allowedValues = Array.isArray(def?.allowedValues)
          ? def.allowedValues.map((v: any) => String(v).trim()).filter(Boolean)
          : undefined
        return { key, label, allowedValues }
      })
      .filter(Boolean) as Array<{ key: string; label: string; allowedValues?: string[] }>
  }, [productViewPayload])

  const optionGroups = useMemo(() => {
    if (skuData.length) {
      const keys = optionDefinitions.length
        ? optionDefinitions.map((def) => def.key)
        : Array.from(new Set(skuData.flatMap((sku) => Object.keys(sku.options || {}))))

      return keys
        .map((key) => {
          const def = optionDefinitions.find((d) => d.key === key)
          const values = def?.allowedValues?.length
            ? def.allowedValues
            : Array.from(new Set(skuData.map((sku) => sku.options?.[key]).filter(Boolean)))
          if (!values.length) return null

          const isColor = isColorKey(key)
          const options = values.map((value) => {
            const selection = { ...selectedVariants, [key]: value }
            const isAvailable = skuData.some((sku) => {
              const matches = Object.entries(selection).every(([k, v]) => !v || sku.options?.[k] === v)
              if (!matches) return false
              const stock = (sku.availability as any)?.stock
              if (stock?.type && String(stock.type).toUpperCase() === 'FINITE') {
                return typeof stock.quantity === 'number' ? stock.quantity > 0 : true
              }
              if (typeof stock?.quantity === 'number') return stock.quantity > 0
              return true
            })

            return {
              value,
              label: value,
              inStock: isAvailable,
              colorHex: isColor ? resolveColorHex(value) : undefined,
            }
          })

          return {
            key,
            label: def?.label || humanizeKey(key),
            isColor,
            options,
          }
        })
        .filter(Boolean) as Array<{ key: string; label: string; isColor: boolean; options: { value: string; label: string; inStock: boolean; colorHex?: string }[] }>
    }

    const fallback = Object.entries(groupedVariants)
      .map(([key, variants]) => {
        if (!variants.length) return null
        return {
          key,
          label: humanizeKey(key),
          isColor: isColorKey(key),
          options: variants.map((variant) => ({
            value: variant.value,
            label: variant.name,
            inStock: variant.inStock,
            colorHex: variant.colorHex,
          })),
        }
      })
      .filter(Boolean) as Array<{ key: string; label: string; isColor: boolean; options: { value: string; label: string; inStock: boolean; colorHex?: string }[] }>

    return fallback
  }, [groupedVariants, optionDefinitions, selectedVariants, skuData])

  const selectedSku = useMemo(() => {
    if (!skuData.length) return null
    const optionKeys = optionGroups.map((group) => group.key)
    const hasSelection = optionKeys.some((key) => Boolean(selectedVariants[key]))
    if (!hasSelection) {
      return skuData.find((sku) => sku.isDefault) || skuData[0]
    }
    const match = skuData.find((sku) =>
      optionKeys.every((key) => {
        const expected = selectedVariants[key]
        if (!expected) return true
        return sku.options?.[key] === expected
      })
    )
    if (match) return match
    return skuData.find((sku) => sku.isDefault) || skuData[0]
  }, [optionGroups, selectedVariants, skuData])

  const selectedSkuPrice = useMemo(() => {
    const prices = selectedSku?.prices || []
    const fromSku = selectSkuPrice(prices, quantity)
    if (fromSku) return fromSku
    return selectSkuPrice(productLevelPrices, quantity)
  }, [productLevelPrices, quantity, selectedSku?.prices])

  const displayPrice = typeof selectedSkuPrice?.unitPrice === 'number' ? selectedSkuPrice.unitPrice : product?.price
  const displayCompareAt =
    typeof selectedSkuPrice?.compareAtPrice === 'number'
      ? selectedSkuPrice.compareAtPrice
      : product?.compareAtPrice

  const displayImages = useMemo(() => {
    if (!selectedSku) return images
    const skuImages = images.filter((img) => img.skuId && img.skuId === selectedSku.id)
    return skuImages.length ? skuImages : images
  }, [images, selectedSku])

  useEffect(() => {
    if (!product) return
    if (!optionGroups.length) return
    setSelectedVariants((prev) => {
      const next = { ...prev }
      const defaultSku = skuData.find((sku) => sku.isDefault) || skuData[0]
      for (const group of optionGroups) {
        const key = group.key
        if (!next[key] && defaultSku?.options?.[key]) next[key] = defaultSku.options[key]
      }
      return next
    })
  }, [optionGroups, product, skuData])

  useEffect(() => {
    setSelectedImage(0)
    setQuantity(1)
    setIsAddToCartModalOpen(false)
    setSpecQuery('')
    setNotifyContact('')
    setReviewsPage(1)
  }, [product?.id, setReviewsPage])

  useEffect(() => {
    setSelectedImage(0)
  }, [selectedSku?.id])

  useEffect(() => {
    if (!product) return
    setRecentlyViewed(addRecentlyViewed(product, { max: 12 }))
  }, [product])

  const inWishlist = product ? isInWishlist(product.id) : false
  const savings = useMemo(() => {
    if (typeof displayCompareAt !== 'number' || typeof displayPrice !== 'number') {
      return product ? discountPercent(product) : null
    }
    if (displayCompareAt <= displayPrice) return null
    return Math.round(((displayCompareAt - displayPrice) / displayCompareAt) * 100)
  }, [displayCompareAt, displayPrice, product])
  const shortDescription = useMemo(() => {
    if (product?.shortDescription) return product.shortDescription
    return shortDescriptionFromMarkdown(product?.description || '')
  }, [product?.description, product?.shortDescription])
  const descriptionFitPreview = useMemo(() => {
    const text = stripMarkdown(product?.description || '')
    if (!text) return null
    const maxLen = 420
    if (text.length <= maxLen) return text
    return text.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…'
  }, [product?.description])

  const deliveryZoneOptions = useMemo(() => {
    const fromCategory = (categoryDetail?.shippingMatrix || [])
      .map((row) => {
        const value = String(row?.region || '').trim()
        if (!value) return null
        return {
          value,
          sla: String(row?.sla || '').trim() || undefined,
          surcharge: String(row?.surcharge || '').trim() || undefined,
        }
      })
      .filter(Boolean) as Array<{ value: string; sla?: string; surcharge?: string }>

    if (fromCategory.length) return fromCategory

    return [
      { value: 'Nairobi & Kiambu', sla: 'Same/next day', surcharge: 'KES 0' },
      { value: 'Kenya (rest)', sla: '2–3 business days', surcharge: 'KES 350' },
      { value: 'East Africa', sla: '3–6 business days', surcharge: undefined },
    ]
  }, [categoryDetail?.shippingMatrix])

  useEffect(() => {
    if (!deliveryZoneOptions.length) return
    if (deliveryZoneOptions.some((z) => z.value === deliveryZone)) return
    setDeliveryZoneAndPersist(deliveryZoneOptions[0].value)
  }, [deliveryZone, deliveryZoneOptions, setDeliveryZoneAndPersist])

  const selectedDeliveryZone = useMemo(() => {
    if (!deliveryZoneOptions.length) return null
    return deliveryZoneOptions.find((z) => z.value === deliveryZone) || deliveryZoneOptions[0]
  }, [deliveryZone, deliveryZoneOptions])

  const isFastDeliveryZone = useMemo(() => viewLocationForZone(selectedDeliveryZone?.value || deliveryZone) === 'ke-nbi', [
    deliveryZone,
    selectedDeliveryZone?.value,
  ])

  const deliveryEstimateText = useMemo(() => {
    const sla = selectedDeliveryZone?.sla ? String(selectedDeliveryZone.sla).trim() : ''
    if (sla) return `Estimated delivery: ${sla}.`

    const hint = viewLocationForZone(deliveryZone)
    if (hint === 'ke-nbi') return 'Estimated delivery: same/next day (eligible orders).'
    if (hint === 'ke') return 'Estimated delivery: 2–3 business days.'
    if (hint === 'ea') return 'Estimated delivery: 3–6 business days.'
    return 'Estimated delivery times are shown at checkout.'
  }, [deliveryZone, selectedDeliveryZone?.sla])

  const [deliveryCountdownTick, setDeliveryCountdownTick] = useState(() => Date.now())

  useEffect(() => {
    if (!isFastDeliveryZone) return
    const id = window.setInterval(() => setDeliveryCountdownTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isFastDeliveryZone])

  const nextDayCountdown = useMemo(() => {
    if (!isFastDeliveryZone) return null
    const now = new Date(deliveryCountdownTick)
    const cutoff = new Date(now)
    cutoff.setHours(16, 0, 0, 0)
    if (now.getTime() > cutoff.getTime()) cutoff.setDate(cutoff.getDate() + 1)
    const diffMs = cutoff.getTime() - now.getTime()
    if (!Number.isFinite(diffMs) || diffMs <= 0) return null
    const totalSeconds = Math.floor(diffMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0')
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }, [deliveryCountdownTick, isFastDeliveryZone])

  const selectedSkuInStock = useMemo(() => {
    if (!selectedSku) return Boolean(product?.inStock)
    const stock = (selectedSku?.availability as any)?.stock
    if (stock?.type && String(stock.type).toUpperCase() === 'FINITE') {
      if (typeof stock.quantity === 'number') return stock.quantity > 0
    }
    if (typeof stock?.quantity === 'number') return stock.quantity > 0
    return Boolean(product?.inStock)
  }, [product?.inStock, selectedSku])

  const maxQty = useMemo(() => {
    const stock = (selectedSku?.availability as any)?.stock
    if (typeof stock?.quantity === 'number') return Math.max(1, Math.floor(stock.quantity))
    if (typeof product?.stockCount === 'number') return Math.max(1, Math.floor(product.stockCount))
    return 99
  }, [product?.stockCount, selectedSku])

  const variantSummary = useMemo(() => {
    if (!optionGroups.length) return null
    const parts = optionGroups
      .map((group) => {
        const selectedValue = selectedVariants[group.key]
        if (!selectedValue) return null
        const label = group.options.find((o) => o.value === selectedValue)?.label || selectedValue
        return `${group.label}: ${label}`
      })
      .filter(Boolean) as string[]
    return parts.length ? parts.join(' • ') : null
  }, [optionGroups, selectedVariants])

  const modalImage = useMemo(() => {
    const img = displayImages[selectedImage] || displayImages[0]
    return img?.url ? { url: img.url, alt: img.alt || product?.name } : null
  }, [displayImages, product?.name, selectedImage])

  const share = async () => {
    if (typeof window === 'undefined') return
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title: product?.name || 'Product', url })
        return
      } catch {
        // ignore and fall back
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied', { description: 'Share it anywhere.' })
    } catch {
      toast.error('Copy failed', { description: 'Please copy the URL from the address bar.' })
    }
  }

  const chat = () => {
    if (typeof window === 'undefined') return
    const phone = '254712345678'
    const url = window.location.href
    const text = `Hi QueshTech, I have a question about ${product?.name || 'a product'}: ${url}`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  const specs = useMemo(() => {
    const base = product?.specifications ?? {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(base)) {
      const key = humanizeKey(k)
      const value = String(v ?? '').trim()
      if (!key || !value) continue
      out[key] = value
    }
    return out
  }, [product?.specifications])

  const specGroups = useMemo(() => buildSpecGroups(specs), [specs])
  const specFiltered = useMemo(() => {
    const q = specQuery.trim().toLowerCase()
    if (!q) return specs
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(specs)) {
      if (`${k} ${v}`.toLowerCase().includes(q)) out[k] = v
    }
    return out
  }, [specQuery, specs])

  const promoBanners = useMemo(() => {
    const productId = product?.id
    const categoryId = product?.category?.id
    if (!productId) return []

    const matches = (banner: Banner) => {
      if (!banner?.targets || banner.targets.length === 0) return false
      return banner.targets.some((t) => {
        if (!t?.kind) return false
        if (t.kind === 'product') return t.refId === productId
        if (t.kind === 'category') return t.refId === categoryId
        return false
      })
    }

    const targeted = featureBanners.filter(matches)
    const fallback = featureBanners.filter((b) => !b.targets || b.targets.length === 0)
    const merged = [...targeted, ...fallback]
    const seen = new Set<string>()
    return merged.filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true))).slice(0, 3)
  }, [featureBanners, product?.category?.id, product?.id])

  if (showLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-10">
        <div className="space-y-8">
          <Skeleton className="h-4 w-56" />
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="space-y-4">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <div className="grid grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="aspect-square w-full rounded-xl" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-10 w-44" />
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
              <Skeleton className="h-36 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) return <div className="container mx-auto px-4 py-12" />

  if (!product) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-12">
        <div className="rounded-2xl border bg-card p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <WarningCircle size={22} weight="bold" />
          </div>
          <h1 className="text-2xl font-bold">Product not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'This product may have been removed.'}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/search" className={buttonVariants({ variant: 'default' })}>
              Search products
            </Link>
            <Link href="/" className={buttonVariants({ variant: 'outline' })}>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const add = () => {
    if (!selectedSkuInStock) {
      toast.error('Out of stock', { description: 'This variant is currently unavailable.' })
      return
    }
    const missing = optionGroups.filter((g) => !selectedVariants[g.key])
    if (missing.length) {
      toast.error('Select options', { description: `Please select: ${missing.map((m) => m.label).join(', ')}` })
      return
    }
    const price = typeof displayPrice === 'number' ? displayPrice : product.price
    const compareAtPrice = typeof displayCompareAt === 'number' ? displayCompareAt : product.compareAtPrice
    const productWithSkuPrice = {
      ...product,
      price,
      compareAtPrice: compareAtPrice ?? undefined,
    }
    onAddToCart(productWithSkuPrice, selectedVariants, quantity, selectedSku?.id)
    setIsAddToCartModalOpen(true)
  }

  const toggleFavorite = () => {
    toggleWishlist(product)
    toast.success(inWishlist ? 'Removed from wishlist' : 'Added to wishlist')
  }

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-muted/35 via-background to-background" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-6 sm:py-8 pb-28 sm:pb-10">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) window.history.back()
              else navigate('/')
            }}
            aria-label="Back"
          >
            <ArrowLeft size={18} weight="bold" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={share}
            aria-label="Share product"
            title="Share"
          >
            <ShareNetwork size={18} weight="bold" />
          </Button>
        </div>

        <Breadcrumbs
          items={[
            { label: product.category.name, href: `/category/${product.category.slug}` },
            { label: product.name },
          ]}
        />

        <div className="mt-2 grid gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <ProductMedia
              product={product}
              images={displayImages}
              selectedIndex={selectedImage}
              onSelectIndex={setSelectedImage}
              onZoom={() => setIsZoomOpen(true)}
            />
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="rounded-[28px] border-border/60 bg-card p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-wide">
                  {product.category.name}
                </Badge>
                {selectedSkuInStock ? (
                  <Badge variant="outline" className="rounded-full">
                    In stock
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="rounded-full">
                    Out of stock
                  </Badge>
                )}
              </div>

              <div className="mt-2 space-y-3">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>

                  <div className="flex items-center justify-between gap-3">
                    <Rating
                      rating={Number(ratingSummary?.avgRating ?? product.rating ?? 0)}
                      count={ratingSummary?.ratingCount ?? product.reviewCount}
                      size="sm"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <Price
                      price={typeof displayPrice === 'number' ? displayPrice : product.price}
                      compareAtPrice={typeof displayCompareAt === 'number' ? displayCompareAt : product.compareAtPrice}
                      currency={product.currency}
                      size="lg"
                    />
                    {savings ? (
                      <Badge variant="secondary" className="rounded-full">
                        {savings}% OFF
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl border bg-muted/10 px-3 py-1.5 text-xs text-muted-foreground">
                    <SealCheck size={16} weight="bold" className="text-muted-foreground" />
                    <span className="leading-relaxed">
                      {nextDayCountdown ? (
                        <>
                          Order in <span className="font-medium text-foreground">{nextDayCountdown}</span> for same/next day delivery.
                        </>
                      ) : (
                        deliveryEstimateText
                      )}
                    </span>
                  </div>
                </div>

                {optionGroups.length ? (
                  <div className="space-y-3">
                    {optionGroups.map((group) => (
                      <OptionSelector
                        key={group.key}
                        label={group.label}
                        options={group.options}
                        isColor={group.isColor}
                        selectedValue={selectedVariants[group.key]}
                        onValueChange={(value) => setSelectedVariants((prev) => ({ ...prev, [group.key]: value }))}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Quantity</div>
                  <QuantityInput
                    value={quantity}
                    onChange={setQuantity}
                    min={1}
                    max={Math.min(99, maxQty)}
                    className="rounded-full bg-background"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    size="lg"
                    className="h-12 flex-1 rounded-full bg-foreground text-background hover:bg-foreground/90"
                    onClick={add}
                    disabled={!selectedSkuInStock}
                  >
                    Add to cart
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full"
                    onClick={toggleFavorite}
                    aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                    title={inWishlist ? 'Saved' : 'Save'}
                  >
                    <Heart
                      size={18}
                      weight={inWishlist ? 'fill' : 'bold'}
                      className={inWishlist ? 'text-primary' : undefined}
                    />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full"
                    onClick={chat}
                    aria-label="Chat on WhatsApp"
                    title="Chat"
                  >
                    <ChatCircleDots size={18} weight="bold" />
                  </Button>
                </div>
              </div>

              {!selectedSkuInStock ? (
                <div className="mt-5 rounded-2xl border bg-muted/10 p-4">
                  <div className="text-sm font-medium">Get notified when it’s back</div>
                  <div className="mt-1 text-xs text-muted-foreground">Drop an email or phone number. We’ll alert you as soon as it’s available.</div>
                  <div className="mt-3 flex gap-2">
                    <Input value={notifyContact} onChange={(e) => setNotifyContact(e.target.value)} placeholder="Email or phone" className="h-10" />
                    <Button
                      className="h-10"
                      onClick={() => toast.success('You’re on the list', { description: notifyContact ? notifyContact : 'We’ll notify you soon.' })}
                      disabled={!notifyContact.trim()}
                    >
                      Notify
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 overflow-hidden rounded-2xl border bg-background/40">
                <Accordion type="multiple" defaultValue={['description']} className="w-full">
                  <AccordionItem value="description" className="border-b px-4">
                    <AccordionTrigger className="py-4 text-sm font-semibold hover:no-underline">Description & fit</AccordionTrigger>
                    <AccordionContent className="pb-4">
                      {shortDescription ? (
                        <p className="text-sm text-muted-foreground leading-relaxed">{shortDescription}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No short description yet.</p>
                      )}
                      {descriptionFitPreview ? (
                        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{descriptionFitPreview}</p>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">No full description available yet.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="shipping" className="border-none px-4">
                    <AccordionTrigger className="py-4 text-sm font-semibold hover:no-underline">Shipping</AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="flex items-center justify-between gap-2 rounded-2xl border bg-muted/10 p-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <MapPin size={16} weight="bold" className="text-muted-foreground" />
                          Deliver to
                        </div>
                        <Select value={deliveryZone} onValueChange={setDeliveryZoneAndPersist}>
                          <SelectTrigger className="h-9 w-[210px] rounded-full bg-background">
                            <SelectValue placeholder="Select area" />
                          </SelectTrigger>
                          <SelectContent>
                            {deliveryZoneOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border bg-muted/10 p-3">
                          <div className="flex items-start gap-3">
                            <SealCheck size={16} weight="bold" className="mt-0.5 text-muted-foreground" />
                            <div>
                              <div className="text-xs text-muted-foreground">Discount</div>
                              <div className="text-sm font-semibold">{savings ? `${savings}%` : '—'}</div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-muted/10 p-3">
                          <div className="flex items-start gap-3">
                            <Package size={16} weight="bold" className="mt-0.5 text-muted-foreground" />
                            <div>
                              <div className="text-xs text-muted-foreground">Package</div>
                              <div className="text-sm font-semibold">Regular package</div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-muted/10 p-3">
                          <div className="flex items-start gap-3">
                            <Truck size={16} weight="bold" className="mt-0.5 text-muted-foreground" />
                            <div>
                              <div className="text-xs text-muted-foreground">Delivery time</div>
                              <div className="text-sm font-semibold">{selectedDeliveryZone?.sla || 'Shown at checkout'}</div>
                              {selectedDeliveryZone?.surcharge ? (
                                <div className="mt-1 text-xs text-muted-foreground">Delivery fee: {selectedDeliveryZone.surcharge}</div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-muted/10 p-3">
                          <div className="flex items-start gap-3">
                            <MapPin size={16} weight="bold" className="mt-0.5 text-muted-foreground" />
                            <div>
                              <div className="text-xs text-muted-foreground">Est. arrive</div>
                              <div className="text-sm font-semibold">
                                {estimateArrivalRange(selectedDeliveryZone?.sla, new Date(deliveryCountdownTick)) || 'Shown at checkout'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {promoBanners.length ? (
                <div className="mt-6 space-y-3">
                  <div className="text-sm font-medium">Featured</div>
                  <div className="rounded-[26px] border bg-muted/10 p-3">
                    <div className="grid grid-cols-3 gap-3">
                      {promoBanners.map((banner) => (
                        <PromoBannerTile key={banner.id} banner={banner} compact />
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>
          </div>
        </div>

        <div className="mt-10">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto rounded-2xl bg-muted/30">
              <TabsTrigger value="overview" className="min-w-[140px] justify-start">
                Overview
              </TabsTrigger>
              <TabsTrigger value="specs" className="min-w-[140px] justify-start">
                Specs
              </TabsTrigger>
              <TabsTrigger value="reviews" className="min-w-[140px] justify-start">
                Reviews
              </TabsTrigger>
              <TabsTrigger value="shipping" className="min-w-[160px] justify-start">
                Shipping & returns
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="grid gap-2 lg:grid-cols-12">
                <Card className="lg:col-span-7 rounded-2xl border-border/60 bg-card p-5 sm:p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">Story</div>
                  </div>
                  <Separator className="my-4" />
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {product.description ? <MarkdownContent content={product.description} /> : 'No description available yet.'}
                  </div>
                </Card>

                <div className="lg:col-span-5 space-y-6">
                  <Card className="rounded-2xl border-border/60 bg-card p-5 sm:p-6 shadow-sm">
                    <div className="text-sm font-medium">At a glance</div>
                    <Separator className="my-4" />
                    {specGroups.Highlights.length ? (
                      <div className="grid gap-3">
                        {specGroups.Highlights.map(({ key, value }) => (
                          <div key={key} className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium text-foreground">{key}</div>
                            <div className="text-sm text-muted-foreground text-right">{value}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Highlights will appear once attributes/specs are added.</div>
                    )}
                  </Card>

                  <Card className="rounded-2xl border-border/60 bg-card p-5 sm:p-6 shadow-sm">
                    <div className="text-sm font-medium">Confidence</div>
                    <Separator className="my-4" />
                    <div className="grid gap-3 text-sm">
                      <div className="flex items-start gap-3">
                        <ShieldCheck size={18} weight="bold" className="mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">Secure checkout</div>
                          <div className="text-muted-foreground">Trusted payment providers and encrypted transactions.</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <ArrowsCounterClockwise size={18} weight="bold" className="mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">Easy returns</div>
                          <div className="text-muted-foreground">30-day returns on eligible items.</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Package size={18} weight="bold" className="mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">Fast dispatch</div>
                          <div className="text-muted-foreground">Ships quickly when in stock.</div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="specs" className="mt-6">
              {Object.keys(specFiltered).length ? (
                <Card className="rounded-2xl border-border/60 bg-card p-5 sm:p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-medium">Specifications</div>
                    <div className="flex gap-2">
                      <Input
                        value={specQuery}
                        onChange={(e) => setSpecQuery(e.target.value)}
                        placeholder="Search specs…"
                        className="h-9 w-full sm:w-[320px]"
                      />
                      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSpecQuery('')} aria-label="Clear search">
                        <ArrowsCounterClockwise size={16} weight="bold" />
                      </Button>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <Accordion type="multiple" defaultValue={['Highlights', 'Display', 'Performance']} className="w-full">
                    {(Object.entries(buildSpecGroups(specFiltered)) as Array<[SpecGroup, Array<{ key: string; value: string }>]>)
                      .filter(([_, items]) => items.length)
                      .map(([group, items]) => (
                        <AccordionItem key={group} value={group}>
                          <AccordionTrigger className="text-sm">{group}</AccordionTrigger>
                          <AccordionContent>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {items.map(({ key, value }) => (
                                <div key={key} className="flex items-start justify-between gap-3 rounded-xl border bg-muted/10 p-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium">{key}</div>
                                    <div className="text-sm text-muted-foreground break-words">{value}</div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(String(value))
                                        toast.success('Copied', { description: key })
                                      } catch {
                                        toast.error('Copy failed')
                                      }
                                    }}
                                    aria-label={`Copy ${key}`}
                                  >
                                    <Copy size={14} weight="bold" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                  </Accordion>
                </Card>
              ) : (
                <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">No specifications available yet.</div>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-12">
                <Card className="lg:col-span-4 rounded-2xl border-border/60 bg-card p-5 sm:p-6 shadow-sm">
                  <div className="text-sm font-medium">Ratings</div>
                  <Separator className="my-4" />
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-3xl font-bold">{(ratingSummary?.avgRating ?? product.rating).toFixed(1)}</div>
                    <div className="text-right">
                      <Rating rating={ratingSummary?.avgRating ?? product.rating} showCount={false} />
                      <div className="mt-1 text-xs text-muted-foreground">
                        {(ratingSummary?.ratingCount ?? product.reviewCount) || 0} reviews
                      </div>
                    </div>
                  </div>

                  {ratingSummary ? (
                    <div className="mt-5 space-y-2">
                      {([5, 4, 3, 2, 1] as const).map((stars) => {
                        const total = ratingSummary?.ratingCount ?? 0
                        const count =
                          stars === 5
                            ? ratingSummary.star5Count
                            : stars === 4
                              ? ratingSummary.star4Count
                              : stars === 3
                                ? ratingSummary.star3Count
                                : stars === 2
                                  ? ratingSummary.star2Count
                                  : ratingSummary.star1Count
                        const pct = total ? Math.round((count / total) * 100) : 0
                        return (
                          <div key={stars} className="grid grid-cols-[44px_1fr_44px] items-center gap-3 text-xs">
                            <div className="text-muted-foreground">{stars}★</div>
                            <Progress value={pct} />
                            <div className="text-right text-muted-foreground">{count}</div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="mt-5 text-sm text-muted-foreground">Rating breakdown isn’t available yet.</div>
                  )}

                  {isRatingLoading ? <div className="mt-4 text-xs text-muted-foreground">Refreshing…</div> : null}
                </Card>

                <div className="lg:col-span-8 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-medium">Customer reviews</div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground">Sort</div>
                      <Select
                        value={reviews.sort}
                        onValueChange={(v) => {
                          reviews.setPage(1)
                          reviews.setSort(v as any)
                        }}
                      >
                        <SelectTrigger className="h-9 w-[190px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest</SelectItem>
                          <SelectItem value="oldest">Oldest</SelectItem>
                          <SelectItem value="highest">Highest rated</SelectItem>
                          <SelectItem value="lowest">Lowest rated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {reviews.isLoading ? (
                    <div className="grid gap-3">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="rounded-2xl border bg-card p-5">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="mt-3 h-4 w-2/3" />
                          <Skeleton className="mt-2 h-4 w-3/4" />
                        </div>
                      ))}
                    </div>
                  ) : reviews.items.length ? (
                    <div className="grid gap-3">
                      {reviews.items.map((r) => (
                        <Card key={r.id} className="rounded-2xl border-border/60 bg-card p-5 sm:p-6 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <Rating rating={r.rating} showCount={false} />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {r.isVerifiedPurchase ? <Badge variant="success">Verified purchase</Badge> : <Badge variant="secondary">Customer</Badge>}
                              {r.createdAt ? <span>{formatDate(r.createdAt)}</span> : null}
                            </div>
                          </div>
                          {r.title ? <div className="mt-3 text-sm font-semibold">{r.title}</div> : null}
                          {r.body ? <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{r.body}</div> : null}
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">No reviews yet. Be the first to share feedback.</div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="shipping" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-12">
                <Card className="lg:col-span-7 rounded-2xl border-border/60 bg-card p-5 sm:p-6 shadow-sm">
	                  <div className="text-sm font-medium">Delivery</div>
	                  <Separator className="my-4" />
	                  <div className="text-sm text-muted-foreground">
	                    Nationwide shipping with express options at checkout. Delivery time and fee depend on your zone.
	                  </div>
	                  <div className="mt-5 rounded-xl border bg-muted/10 p-4">
	                    <div className="flex items-center justify-between gap-3">
	                      <div className="flex items-center gap-2 text-sm font-medium">
	                        <MapPin size={16} weight="bold" className="text-muted-foreground" />
	                        Delivery zone
	                      </div>
	                      <Select value={deliveryZone} onValueChange={setDeliveryZoneAndPersist}>
	                        <SelectTrigger className="h-9 w-[210px]">
	                          <SelectValue placeholder="Select area" />
	                        </SelectTrigger>
	                        <SelectContent>
	                          {deliveryZoneOptions.map((opt) => (
	                            <SelectItem key={opt.value} value={opt.value}>
	                              {opt.value}
	                            </SelectItem>
	                          ))}
	                        </SelectContent>
	                      </Select>
	                    </div>
	                    <div className="mt-2 text-sm text-muted-foreground">{deliveryEstimateText}</div>
	                    {selectedDeliveryZone?.surcharge ? (
	                      <div className="mt-2 text-xs text-muted-foreground">Delivery fee: {selectedDeliveryZone.surcharge}</div>
	                    ) : null}
	                  </div>
	                </Card>

                <Card className="lg:col-span-5 rounded-2xl border-border/60 bg-card p-5 sm:p-6 shadow-sm">
                  <div className="text-sm font-medium">Returns & warranty</div>
                  <Separator className="my-4" />
                  <div className="grid gap-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-3">
                      <ArrowsCounterClockwise size={18} weight="bold" className="mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-foreground">30-day returns</div>
                        <div>Returns on unopened items in original packaging (category exceptions may apply).</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <ShieldCheck size={18} weight="bold" className="mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-foreground">Trusted checkout</div>
                        <div>Secure processing and privacy-first handling.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Package size={18} weight="bold" className="mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-foreground">Safe packaging</div>
                        <div>Carefully packed to arrive in excellent condition.</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {recentlyViewed.length > 1 ? (
          <div className="mt-14">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Recently viewed</h2>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {recentlyViewed
                .filter((p) => p.id !== product.id)
                .slice(0, 6)
                .map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    adapter={recentlyViewedAdapter}
                    behavior={{ actions: { mode: 'none', showAdd: false, showQuickView: false, showWishlist: false } }}
                  />
                ))}
            </div>
          </div>
        ) : null}

        <div className="mt-14">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">You may also like</h2>
            <Link
              href={`/category/${product.category.slug}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'hidden sm:inline-flex')}
            >
              <span className="inline-flex items-center gap-2">
                <ArrowLeft size={16} weight="bold" />
                Back to category
              </span>
            </Link>
          </div>

          <div className="mt-6">
            {showRelatedLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-border/60 overflow-hidden">
                    <Skeleton className="aspect-square w-full" />
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : relatedProducts.length ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {relatedProducts
                  .filter((p) => p.id !== product.id)
                  .slice(0, 6)
                  .map((p) => (
                    <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
                  ))}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">No related products found.</div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/75 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:hidden">
        <div className="container mx-auto px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{product.name}</div>
              <div className="flex items-baseline gap-2">
                <Price price={product.price} compareAtPrice={product.compareAtPrice} currency={product.currency} size="sm" />
                {savings ? (
                  <Badge variant="destructive" className="text-[10px]">
                    -{savings}%
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <QuantityInput value={quantity} onChange={setQuantity} min={1} max={Math.min(99, maxQty)} className="rounded-full bg-background" />
              <Button className="shrink-0" onClick={add} disabled={!selectedSkuInStock}>
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ImageZoomDialog open={isZoomOpen} onOpenChange={setIsZoomOpen} images={displayImages} initialIndex={selectedImage} />

      <SimpleModal open={isAddToCartModalOpen} onOpenChange={setIsAddToCartModalOpen} className="sm:max-w-2xl">
        <SimpleModalHeader className="text-left">
          <SimpleModalTitle>Added to cart</SimpleModalTitle>
        </SimpleModalHeader>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start mt-4">
          <div className="flex gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border bg-muted/20">
              {modalImage?.url ? <img src={modalImage.url} alt={modalImage.alt || product.name} className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{product.name}</div>
              {variantSummary ? <div className="mt-1 text-xs text-muted-foreground">{variantSummary}</div> : null}
              <div className="mt-2 flex items-center gap-2">
                <Price price={product.price} compareAtPrice={product.compareAtPrice} currency={product.currency} size="sm" />
                {selectedSkuInStock ? <Badge variant="outline" className="rounded-full text-[10px]">In stock</Badge> : null}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
            <div className="text-xs text-muted-foreground">Quantity</div>
            <div className="rounded-full border px-4 py-2 text-sm font-semibold">{quantity}</div>
          </div>
        </div>

        <SimpleModalFooter className="gap-3 sm:gap-3 mt-6">
          <Button variant="outline" className="h-11 rounded-full" onClick={() => setIsAddToCartModalOpen(false)}>
            Continue shopping
          </Button>
          <Button
            className="h-11 rounded-full"
            onClick={() => {
              setIsAddToCartModalOpen(false)
              navigate('/cart')
            }}
          >
            Go to cart
          </Button>
        </SimpleModalFooter>
      </SimpleModal>
    </div>
  )
}
