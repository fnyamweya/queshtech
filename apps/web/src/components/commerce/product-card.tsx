import { useEffect, useMemo, useRef, useState } from 'react'
import type { Product } from '@/types'
import { cn } from '@/lib/utils'
import { defaultProductAdapter } from './product-card/adapters'
import { ProductCardShell } from './product-card/shell'
import { ProductCardSkeleton } from './product-card/skeleton'
import { ProductCardLayout, normalizeVariant } from './product-card/layouts'
import type {
  ProductCardAdapter,
  ProductCardAppearance,
  ProductCardBehavior,
  ProductCardContext,
  ProductCardSlots,
  ProductCardVariant,
} from './product-card/types'
import { isCoarsePointer, prefersReducedMotion } from './product-card/utils'

type LegacyConfig = {
  preset?: 'default' | 'soft' | 'glass' | 'minimal' | 'elevated'
  density?: 'comfortable' | 'compact'
  media?: { aspect?: 'square' | 'portrait' | 'auto'; hoverSwap?: boolean; showGradient?: boolean; imageClassName?: string }
  badges?: { show?: boolean; max?: number; items?: Array<{ label: string; variant?: any }> }
  meta?: { showBrand?: boolean; showRating?: boolean; showStockHint?: boolean }
  actions?: { mode?: 'none' | 'hover' | 'always'; showAddToCart?: boolean; showQuickView?: boolean; showWishlist?: boolean }
}

export type ProductCardProps<TProduct = Product> = {
  product: TProduct
  variant?: ProductCardVariant
  href?: string
  className?: string
  loading?: boolean

  adapter?: ProductCardAdapter<TProduct>
  appearance?: ProductCardAppearance
  behavior?: ProductCardBehavior<TProduct>
  slots?: ProductCardSlots<TProduct>

  // Legacy props (supported for smooth migration).
  config?: LegacyConfig
  onAddToCart?: (product: any, variants?: Record<string, string>, quantity?: number, skuId?: string) => void
  onQuickView?: (product: any) => void
  onWishlistToggle?: (product: any) => void
  isWishlisted?: boolean
}

function resolveAppearance(variant: ProductCardVariant, input: ProductCardAppearance | undefined): Required<ProductCardAppearance> {
  const mediaAspect =
    input?.media?.aspect ||
    (variant === 'horizontal' || variant === 'compact' || variant === 'comparison' || variant === 'grid' ? 'square' : 'portrait')

  return {
    preset: input?.preset || 'default',
    density: input?.density || 'compact',
    media: {
      aspect: mediaAspect,
      hoverSwap: input?.media?.hoverSwap ?? true,
      showGradient: input?.media?.showGradient ?? true,
      imageClassName: input?.media?.imageClassName,
    },
  }
}

function resolveBehavior<TProduct>(
  variant: ProductCardVariant,
  input: ProductCardBehavior<TProduct> | undefined,
  legacy: {
    onAddToCart?: (product: TProduct, variants?: Record<string, string>, quantity?: number, skuId?: string) => void
    onQuickView?: (product: TProduct) => void
    onWishlistToggle?: (product: TProduct) => void
    isWishlisted?: boolean
  }
): Required<ProductCardBehavior<TProduct>> {
  const actionsMode = input?.actions?.mode || (variant === 'horizontal' ? 'always' : variant === 'compact' ? 'none' : 'hover')
  const showAdd = input?.actions?.showAdd ?? true

  const experiments = { key: input?.experiments?.key, variant: input?.experiments?.variant }

  const defaults: Required<ProductCardBehavior<TProduct>> = {
    actions: {
      mode: actionsMode,
      showAdd,
      showQuickView: Boolean(input?.actions?.showQuickView ?? legacy.onQuickView),
      showWishlist: Boolean(input?.actions?.showWishlist ?? legacy.onWishlistToggle),
      onQuickView: (input?.actions?.onQuickView || (legacy.onQuickView ? ({ product }) => legacy.onQuickView?.(product) : undefined)) as any,
      onWishlistToggle: (input?.actions?.onWishlistToggle ||
        (legacy.onWishlistToggle
          ? ({ product, selected }) => {
              void selected
              legacy.onWishlistToggle?.(product)
            }
          : undefined)) as any,
      wishlisted: input?.actions?.wishlisted ?? legacy.isWishlisted ?? false,
    },
    meta: {
      showBrand: input?.meta?.showBrand ?? true,
      showRating: input?.meta?.showRating ?? true,
      showStockHint: input?.meta?.showStockHint ?? true,
      stockThreshold: input?.meta?.stockThreshold ?? 10,
    },
    badges: {
      show: input?.badges?.show ?? true,
      max: input?.badges?.max,
      items: input?.badges?.items || [],
    },
    price: {
      mode: input?.price?.mode,
      showTaxHint: input?.price?.showTaxHint ?? false,
      showSavings: input?.price?.showSavings ?? false,
      currencyDisplay: input?.price?.currencyDisplay,
      explanation: {
        show: input?.price?.explanation?.show ?? false,
        text: input?.price?.explanation?.text,
      },
    },
    options: {
      show: input?.options?.show ?? false,
      mode: input?.options?.mode ?? 'auto',
      maxVisible: input?.options?.maxVisible,
      onSelect: input?.options?.onSelect,
    },
    purchase: {
      mode: input?.purchase?.mode ?? 'add-to-cart',
      quantity: {
        show: input?.purchase?.quantity?.show ?? false,
        min: input?.purchase?.quantity?.min,
        max: input?.purchase?.quantity?.max,
        step: input?.purchase?.quantity?.step,
      },
      onPurchase:
        input?.purchase?.onPurchase ||
        (legacy.onAddToCart
          ? ({ product, selected }) => {
              legacy.onAddToCart?.(product, selected)
            }
          : undefined),
      onUndoPurchase: input?.purchase?.onUndoPurchase,
    },
    discovery: {
      compare: {
        show: input?.discovery?.compare?.show ?? false,
        selected: input?.discovery?.compare?.selected ?? false,
        onToggle: input?.discovery?.compare?.onToggle,
      },
      reason: {
        show: input?.discovery?.reason?.show ?? false,
        text: input?.discovery?.reason?.text,
      },
      highlightTerms: input?.discovery?.highlightTerms || [],
    },
    specs: {
      show: input?.specs?.show ?? false,
      max: input?.specs?.max,
      items: input?.specs?.items,
    },
    interaction: {
      feedback: input?.interaction?.feedback ?? 'none',
      haptics: input?.interaction?.haptics ?? false,
      undoAddToCart: {
        enabled: input?.interaction?.undoAddToCart?.enabled ?? false,
        windowMs: input?.interaction?.undoAddToCart?.windowMs ?? 4500,
      },
    },
    experiments,
    telemetry: {
      onImpression: input?.telemetry?.onImpression,
      onClick: input?.telemetry?.onClick,
      onAction: input?.telemetry?.onAction,
    },
    a11y: {
      focusRing: input?.a11y?.focusRing ?? 'auto',
      linkStrategy: input?.a11y?.linkStrategy ?? 'wrap',
    },
    content: {
      showDescription: input?.content?.showDescription ?? false,
      titleClamp: input?.content?.titleClamp ?? 2,
      descriptionClamp: input?.content?.descriptionClamp ?? 2,
    },
  }

  // Experiment-driven defaults: deterministic per list (caller sets experiments.variant).
  if (experiments.variant === 'A') {
    defaults.meta.showRating = true
    defaults.price.showSavings = false
    defaults.badges.max = defaults.badges.max ?? 2
  } else if (experiments.variant === 'B') {
    defaults.meta.showRating = false
    defaults.price.showSavings = defaults.price.showSavings === false ? 'percent' : defaults.price.showSavings
    defaults.badges.max = defaults.badges.max ?? 3
  } else if (experiments.variant === 'C') {
    defaults.actions.mode = defaults.actions.mode === 'none' ? 'always' : defaults.actions.mode
    defaults.badges.max = defaults.badges.max ?? 3
  }

  return defaults
}

function mergeLegacyConfig<TProduct>(config?: LegacyConfig): { appearance?: ProductCardAppearance; behavior?: ProductCardBehavior<TProduct> } {
  if (!config) return {}
  return {
    appearance: {
      preset: config.preset as any,
      density: config.density,
      media: {
        aspect: config.media?.aspect,
        hoverSwap: config.media?.hoverSwap,
        showGradient: config.media?.showGradient,
        imageClassName: config.media?.imageClassName,
      },
    },
    behavior: {
      badges: {
        show: config.badges?.show,
        max: config.badges?.max,
        items: (config.badges?.items || []).map((b) => ({ label: b.label, variant: b.variant })),
      },
      meta: {
        showBrand: config.meta?.showBrand,
        showRating: config.meta?.showRating,
        showStockHint: config.meta?.showStockHint,
      },
      actions: {
        mode: config.actions?.mode,
        showAdd: config.actions?.showAddToCart,
        showQuickView: config.actions?.showQuickView,
        showWishlist: config.actions?.showWishlist,
      },
    } as any,
  }
}

export function ProductCard<TProduct = Product>({
  product,
  variant,
  href,
  className,
  loading,
  adapter: adapterProp,
  appearance: appearanceProp,
  behavior: behaviorProp,
  slots,
  config,
  onAddToCart,
  onQuickView,
  onWishlistToggle,
  isWishlisted,
}: ProductCardProps<TProduct>) {
  const v = normalizeVariant(variant)
  const adapter = useMemo(
    () => (adapterProp || (defaultProductAdapter() as unknown as ProductCardAdapter<TProduct>)),
    [adapterProp]
  )

  const [isTouch, setIsTouch] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setIsTouch(isCoarsePointer())
    setReducedMotion(prefersReducedMotion())
  }, [])

  const legacyMerged = useMemo(() => mergeLegacyConfig<TProduct>(config), [config])

  const appearance = useMemo(
    () => resolveAppearance(v, { ...legacyMerged.appearance, ...appearanceProp }),
    [appearanceProp, legacyMerged.appearance, v]
  )

  const behavior = useMemo(
    () =>
      resolveBehavior(v, { ...legacyMerged.behavior, ...behaviorProp }, {
        onAddToCart: onAddToCart as any,
        onQuickView: onQuickView as any,
        onWishlistToggle: onWishlistToggle as any,
        isWishlisted,
      }),
    [behaviorProp, isWishlisted, legacyMerged.behavior, onAddToCart, onQuickView, onWishlistToggle, v]
  )

  const derived = useMemo(() => {
    const getHref = adapter.getHref
    const id = adapter.getId?.(product) || (product as any)?.id || ''
    const computedHref = href || getHref?.(product) || (id ? `/product/${id}` : '#')

    const title = adapter.getTitle(product)
    const subtitle = adapter.getSubtitle?.(product) || null
    const description = adapter.getDescription?.(product) || null
    const brand = adapter.getBrand?.(product) || null
    const images = adapter.getImages?.(product) || []
    const badges = adapter.getBadges?.(product) || []
    const specs = adapter.getSpecs?.(product) || []
    const currency = adapter.getCurrency?.(product) || null
    const price = adapter.getPrice?.(product) ?? null
    const compareAtPrice = adapter.getCompareAtPrice?.(product) ?? null
    const unitPriceLabel = adapter.getUnitPriceLabel?.(product) || null
    const rating = adapter.getRating?.(product) ?? null
    const reviewCount = adapter.getReviewCount?.(product) ?? null
    const inStock = adapter.getInStock?.(product) ?? true
    const stockCount = adapter.getStockCount?.(product) ?? null
    const optionGroups = adapter.getOptionGroups?.(product) || []

    return {
      id,
      computedHref,
      title,
      subtitle,
      description,
      brand,
      images,
      badges,
      specs,
      currency,
      price,
      compareAtPrice,
      unitPriceLabel,
      rating,
      reviewCount,
      inStock: Boolean(inStock),
      stockCount,
      optionGroups,
    }
  }, [adapter, href, product])

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const g of derived.optionGroups) {
      const pick = g.values.find((v) => v.inStock !== false) || g.values[0]
      if (pick?.value) next[g.id] = pick.value
    }
    setSelectedOptions(next)

    const min = behavior.purchase.quantity?.min ?? 1
    setQuantity(min)
  }, [behavior.purchase.quantity?.min, derived.id, derived.optionGroups])

  const ctx: ProductCardContext<TProduct> = {
    product,
    variant: v,
    href: derived.computedHref,
    title: derived.title,
    subtitle: derived.subtitle,
    description: derived.description,
    brand: derived.brand,
    images: derived.images,
    badges: derived.badges,
    specs: derived.specs,
    inStock: derived.inStock,
    stockCount: derived.stockCount,
    rating: derived.rating,
    reviewCount: derived.reviewCount,
    currency: derived.currency,
    price: derived.price,
    compareAtPrice: derived.compareAtPrice,
    unitPriceLabel: derived.unitPriceLabel,
    optionGroups: derived.optionGroups,
    selectedOptions,
    setSelectedOptions,
    quantity,
    setQuantity,
    appearance,
    behavior,
    isTouch,
    prefersReducedMotion: reducedMotion,
  }

  const rootRef = useRef<HTMLDivElement | null>(null)
  const impressionSent = useRef(false)

  useEffect(() => {
    if (!behavior.telemetry.onImpression) return
    if (!rootRef.current) return
    if (impressionSent.current) return

    const el = rootRef.current
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          if (impressionSent.current) return
          impressionSent.current = true
          behavior.telemetry.onImpression?.({ product, variant: v, experiment: behavior.experiments })
          io.disconnect()
        }
      },
      { threshold: 0.4 }
    )

    io.observe(el)
    return () => io.disconnect()
  }, [behavior.experiments, behavior.telemetry, product, v])

  const onLinkClick = () => {
    behavior.telemetry.onClick?.({ product, variant: v, href: ctx.href })
  }

  if (loading) {
    return (
      <div className={className}>
        <ProductCardSkeleton variant={v} />
      </div>
    )
  }

  return (
    <div ref={rootRef}>
      <ProductCardShell
        href={ctx.href}
        ariaLabel={ctx.title}
        appearance={ctx.appearance}
        a11y={ctx.behavior.a11y}
        onLinkClick={onLinkClick}
        className={cn(className)}
      >
        <ProductCardLayout ctx={ctx} slots={slots} onLinkClick={onLinkClick} />
      </ProductCardShell>
    </div>
  )
}
