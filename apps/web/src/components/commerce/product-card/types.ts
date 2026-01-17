import type { ReactNode } from 'react'

export type ProductCardVariant =
  | 'grid'
  | 'compact'
  | 'horizontal'
  | 'showcase'
  | 'stacked'
  | 'editorial'
  | 'comparison'

export type ProductCardPreset =
  | 'default'
  | 'soft'
  | 'glass'
  | 'elevated'
  | 'minimal'
  | 'premium'
  | 'outline'
  | 'dark'

export type ProductCardDensity = 'comfortable' | 'compact'

export type ProductCardActionMode = 'none' | 'hover' | 'always'

export type ProductCardBadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'info'
  | 'warning'
  | 'destructive'
  | 'outline'

export type ProductCardBadge = {
  key?: string
  label: string
  variant?: ProductCardBadgeVariant
  icon?: ReactNode
  className?: string
}

export type ProductCardPriceMode = 'simple' | 'discount' | 'range' | 'tier' | 'unit'

export type ProductCardPriceConfig = {
  mode?: ProductCardPriceMode
  showTaxHint?: boolean
  showSavings?: 'amount' | 'percent' | 'both' | false
  currencyDisplay?: 'symbol' | 'code'
  explanation?: { show?: boolean; text?: string }
}

export type ProductCardOptionValue = {
  id: string
  label: string
  value: string
  inStock?: boolean
  colorHex?: string
}

export type ProductCardOptionGroup = {
  id: string
  label: string
  mode?: 'swatches' | 'dropdown' | 'pills'
  values: ProductCardOptionValue[]
}

export type ProductCardOptionsConfig<TProduct> = {
  show?: boolean
  mode?: 'swatches' | 'dropdown' | 'auto'
  maxVisible?: number
  onSelect?: (event: { product: TProduct; groupId: string; value: ProductCardOptionValue; selected: Record<string, string> }) => void
}

export type ProductCardPurchaseMode = 'add-to-cart' | 'subscribe' | 'quote' | 'preorder' | 'notify'

export type ProductCardPurchaseConfig<TProduct> = {
  mode?: ProductCardPurchaseMode
  quantity?: { show?: boolean; min?: number; max?: number; step?: number }
  onPurchase?: (event: { product: TProduct; selected: Record<string, string>; quantity: number; mode: ProductCardPurchaseMode }) => void
  onUndoPurchase?: (event: { product: TProduct; selected: Record<string, string>; quantity: number }) => void
}

export type ProductCardDiscoveryConfig<TProduct> = {
  compare?: { show?: boolean; selected?: boolean; onToggle?: (event: { product: TProduct; selected: boolean }) => void }
  reason?: { show?: boolean; text?: string }
  highlightTerms?: string[]
}

export type ProductCardSpecsConfig = {
  show?: boolean
  max?: number
  items?: Array<{ label: string; value: string }>
}

export type ProductCardInteractionConfig = {
  feedback?: 'none' | 'toast' | 'inline' | 'drawer'
  haptics?: boolean
  undoAddToCart?: { enabled?: boolean; windowMs?: number }
}

export type ProductCardExperimentsConfig = {
  key?: string
  variant?: 'A' | 'B' | 'C'
}

export type ProductCardTelemetry<TProduct> = {
  onImpression?: (event: { product: TProduct; variant: ProductCardVariant; experiment?: ProductCardExperimentsConfig }) => void
  onClick?: (event: { product: TProduct; variant: ProductCardVariant; href: string }) => void
  onAction?: (event: { product: TProduct; action: string; meta?: Record<string, unknown> }) => void
}

export type ProductCardA11yConfig = {
  focusRing?: 'auto' | 'always' | 'none'
  linkStrategy?: 'wrap' | 'title-only'
}

export type ProductCardMetaConfig = {
  showBrand?: boolean
  showRating?: boolean
  showStockHint?: boolean
  stockThreshold?: number
}

export type ProductCardBadgesConfig = {
  show?: boolean
  max?: number
  items?: ProductCardBadge[]
}

export type ProductCardContentConfig = {
  showDescription?: boolean
  titleClamp?: number
  descriptionClamp?: number
}

export type ProductCardAppearance = {
  preset?: ProductCardPreset
  density?: ProductCardDensity
  media?: {
    aspect?: 'square' | 'portrait' | 'auto'
    hoverSwap?: boolean
    showGradient?: boolean
    imageClassName?: string
  }
}

export type ProductCardBehavior<TProduct> = {
  actions?: {
    mode?: ProductCardActionMode
    showAdd?: boolean
    showQuickView?: boolean
    showWishlist?: boolean
    onQuickView?: (event: { product: TProduct }) => void
    onWishlistToggle?: (event: { product: TProduct; selected: boolean }) => void
    wishlisted?: boolean
  }
  meta?: ProductCardMetaConfig
  badges?: ProductCardBadgesConfig
  price?: ProductCardPriceConfig
  options?: ProductCardOptionsConfig<TProduct>
  purchase?: ProductCardPurchaseConfig<TProduct>
  discovery?: ProductCardDiscoveryConfig<TProduct>
  specs?: ProductCardSpecsConfig
  interaction?: ProductCardInteractionConfig
  experiments?: ProductCardExperimentsConfig
  telemetry?: ProductCardTelemetry<TProduct>
  a11y?: ProductCardA11yConfig
  content?: ProductCardContentConfig
}

export type ProductCardAdapter<TProduct> = {
  getId?: (product: TProduct) => string
  getHref?: (product: TProduct) => string
  getTitle: (product: TProduct) => string
  getSubtitle?: (product: TProduct) => string | null
  getDescription?: (product: TProduct) => string | null
  getBrand?: (product: TProduct) => string | null
  getImages?: (product: TProduct) => Array<{ url: string; alt?: string; isPrimary?: boolean }>
  getBadges?: (product: TProduct) => ProductCardBadge[]
  getPrice?: (product: TProduct) => number | null
  getCompareAtPrice?: (product: TProduct) => number | null
  getCurrency?: (product: TProduct) => string | null
  getUnitPriceLabel?: (product: TProduct) => string | null
  getRating?: (product: TProduct) => number | null
  getReviewCount?: (product: TProduct) => number | null
  getInStock?: (product: TProduct) => boolean | null
  getStockCount?: (product: TProduct) => number | null
  getOptionGroups?: (product: TProduct) => ProductCardOptionGroup[]
  getSpecs?: (product: TProduct) => Array<{ label: string; value: string }>
}

export type ProductCardContext<TProduct> = {
  product: TProduct
  variant: ProductCardVariant
  href: string
  title: string
  subtitle?: string | null
  description?: string | null
  brand?: string | null
  images: Array<{ url: string; alt?: string; isPrimary?: boolean }>
  badges: ProductCardBadge[]
  specs: Array<{ label: string; value: string }>
  inStock: boolean
  stockCount?: number | null
  rating?: number | null
  reviewCount?: number | null
  currency?: string | null
  price?: number | null
  compareAtPrice?: number | null
  unitPriceLabel?: string | null
  optionGroups: ProductCardOptionGroup[]
  selectedOptions: Record<string, string>
  setSelectedOptions: (next: Record<string, string>) => void
  quantity: number
  setQuantity: (next: number) => void
  appearance: Required<ProductCardAppearance>
  behavior: Required<ProductCardBehavior<TProduct>>
  isTouch: boolean
  prefersReducedMotion: boolean
}

export type ProductCardSlot<TProduct> = ReactNode | ((ctx: ProductCardContext<TProduct>) => ReactNode)

export type ProductCardSlots<TProduct> = {
  Header?: ProductCardSlot<TProduct>
  Footer?: ProductCardSlot<TProduct>
  Media?: ProductCardSlot<TProduct>
  Badges?: ProductCardSlot<TProduct>
  Price?: ProductCardSlot<TProduct>
  Options?: ProductCardSlot<TProduct>
  Specs?: ProductCardSlot<TProduct>
  Actions?: ProductCardSlot<TProduct>
}
