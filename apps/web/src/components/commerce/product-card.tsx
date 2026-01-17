import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { ShoppingCart, Heart, HeartStraight, Eye, Lightning } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Price } from './price'
import { Rating } from './rating'
import { Product } from '@/types'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  href?: string
  variant?: 'grid' | 'horizontal' | 'compact' | 'showcase'
  config?: {
    preset?: 'default' | 'soft' | 'glass' | 'minimal' | 'elevated'
    density?: 'comfortable' | 'compact'
    media?: { aspect?: 'square' | 'portrait' | 'auto'; hoverSwap?: boolean; showGradient?: boolean }
    badges?: {
      show?: boolean
      max?: number
      includeProductBadges?: boolean
      includeDiscountBadge?: boolean
      items?: Array<{
        label: string
        variant?: 'default' | 'secondary' | 'success' | 'info' | 'warning' | 'destructive' | 'outline'
      }>
    }
    meta?: { showBrand?: boolean; showRating?: boolean; showStockHint?: boolean }
    actions?: {
      mode?: 'none' | 'hover' | 'always'
      showAddToCart?: boolean
      showQuickView?: boolean
      showWishlist?: boolean
    }
  }
  onAddToCart?: (product: Product, variants?: Record<string, string>) => void
  onQuickView?: (product: Product) => void
  onWishlistToggle?: (product: Product) => void
  isWishlisted?: boolean
  className?: string
}

export function ProductCard({
  product,
  href,
  variant = 'grid',
  config,
  onAddToCart,
  onQuickView,
  onWishlistToggle,
  isWishlisted,
  className,
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  
  const currentImage = product.images[imageIndex] || product.images[0]
  const secondaryImage = product.images[1]

  const preset = config?.preset ?? 'default'
  const density = config?.density ?? 'comfortable'
  const mediaAspect = config?.media?.aspect ?? (variant === 'compact' ? 'square' : variant === 'horizontal' ? 'square' : 'portrait')
  const mediaHoverSwap = config?.media?.hoverSwap ?? true
  const mediaShowGradient = config?.media?.showGradient ?? true
  const actionsMode = config?.actions?.mode ?? (variant === 'horizontal' ? 'always' : variant === 'compact' ? 'none' : 'hover')
  const showAddToCart = config?.actions?.showAddToCart ?? true
  const showQuickView = config?.actions?.showQuickView ?? Boolean(onQuickView)
  const showWishlist = config?.actions?.showWishlist ?? Boolean(onWishlistToggle)
  const showBrand = config?.meta?.showBrand ?? true
  const showRating = config?.meta?.showRating ?? true
  const showStockHint = config?.meta?.showStockHint ?? true
  const showBadges = config?.badges?.show ?? true

  const resolvedHref = href || `/product/${product.slug}`

  const shellClassName = useMemo(() => {
    const base = 'overflow-hidden'
    switch (preset) {
      case 'minimal':
        return cn(base, 'border-0 shadow-none')
      case 'glass':
        return cn(base, 'bg-background/60 backdrop-blur-xl border border-border/60')
      case 'elevated':
        return cn(base, 'shadow-lg border border-border/60')
      case 'soft':
        return cn(base, 'border border-border/60 shadow-sm')
      default:
        return cn(base, 'border border-border/60 shadow-sm')
    }
  }, [preset])

  const aspectClassName = useMemo(() => {
    switch (mediaAspect) {
      case 'square':
        return 'aspect-square'
      case 'portrait':
        return 'aspect-[4/5]'
      case 'auto':
      default:
        return 'aspect-[4/5]'
    }
  }, [mediaAspect])

  const badgeItems = useMemo(() => {
    if (!showBadges) return [] as Array<{ label: string; variant: ProductCardProps['config'] extends infer C ? any : any }>
    const max = typeof config?.badges?.max === 'number' ? config?.badges?.max : 2
    const includeProductBadges = config?.badges?.includeProductBadges ?? true
    const includeDiscountBadge = config?.badges?.includeDiscountBadge ?? true
    const custom = config?.badges?.items

    const out: Array<{ label: string; variant: any }> = []
    if (Array.isArray(custom) && custom.length > 0) {
      for (const b of custom) {
        if (!b?.label) continue
        out.push({ label: b.label, variant: b.variant ?? 'secondary' })
        if (out.length >= max) return out
      }
    }

    if (includeDiscountBadge && typeof product.compareAtPrice === 'number' && product.compareAtPrice > product.price) {
      out.push({ label: 'Sale', variant: 'destructive' })
    }

    if (includeProductBadges && Array.isArray(product.badges)) {
      for (const b of product.badges) {
        if (!b?.label) continue
        const v = b.type === 'sale' ? 'destructive' : 'secondary'
        out.push({ label: b.label, variant: v })
        if (out.length >= max) break
      }
    }

    return out.slice(0, max)
  }, [config?.badges, product.badges, product.compareAtPrice, product.price, showBadges])

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onAddToCart && product.inStock) {
      onAddToCart(product)
    }
  }

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onQuickView) {
      onQuickView(product)
    }
  }

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onWishlistToggle) onWishlistToggle(product)
  }

  const showActions = actionsMode !== 'none'
  const actionsVisibleClass =
    actionsMode === 'always' ? 'opacity-100 translate-y-0' : isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'

  if (variant === 'compact') {
    return (
      <Card className={cn(shellClassName, 'snap-start flex-shrink-0 w-full', className)}>
        <Link href={resolvedHref}>
          <div className={cn('relative overflow-hidden bg-muted', aspectClassName)}>
            <img
              src={currentImage?.url}
              alt={currentImage?.alt || product.name}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            />
            {badgeItems.length > 0 ? (
              <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
                {badgeItems.map((b) => (
                  <Badge key={b.label} variant={b.variant} className="text-xs px-2 py-0.5 font-bold">
                    {b.label}
                  </Badge>
                ))}
              </div>
            ) : null}
            {!product.inStock && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Badge variant="secondary" className="text-xs">
                  Out of Stock
                </Badge>
              </div>
            )}
          </div>

          <div className={cn(density === 'compact' ? 'p-3' : 'p-4')}>
            {showBrand ? (
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold truncate">{product.brand}</p>
            ) : null}
            <h3 className="font-medium text-sm mb-2 line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
            {showRating ? <Rating rating={product.rating} count={product.reviewCount} size="sm" /> : null}
            <div className="mt-2 flex items-baseline justify-between">
              <Price
                price={product.price}
                compareAtPrice={product.compareAtPrice}
                currency={product.currency}
                size="sm"
              />
            </div>
          </div>
        </Link>
      </Card>
    )
  }

  if (variant === 'horizontal') {
    return (
      <Card className={cn(shellClassName, className)}>
        <Link href={resolvedHref}>
          <div className={cn('flex gap-4 hover:bg-muted/50 transition-colors', density === 'compact' ? 'p-3' : 'p-4')}>
            <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
              <img
                src={currentImage?.url}
                alt={currentImage?.alt || product.name}
                className="w-full h-full object-cover"
              />
              {!product.inStock && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Badge variant="secondary">Out of Stock</Badge>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {showBrand ? <p className="text-xs text-muted-foreground mb-1">{product.brand}</p> : null}
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
                  {showRating ? <Rating rating={product.rating} count={product.reviewCount} size="sm" /> : null}
                </div>
                <div className="text-right">
                  <Price
                    price={product.price}
                    compareAtPrice={product.compareAtPrice}
                    currency={product.currency}
                    size="sm"
                  />
                </div>
              </div>

              {showActions && (showAddToCart || showQuickView || showWishlist) ? (
                <div className={cn('mt-3 flex items-center gap-2', actionsMode === 'always' ? '' : 'hidden')}>
                  {showAddToCart ? (
                    <Button size="sm" className="h-9 rounded-full" onClick={handleAddToCart} disabled={!product.inStock}>
                      <ShoppingCart size={16} weight="bold" />
                      Add to cart
                    </Button>
                  ) : null}
                  {showQuickView ? (
                    <Button size="sm" variant="secondary" className="h-9 rounded-full" onClick={handleQuickView}>
                      <Eye size={16} weight="bold" />
                      Quick view
                    </Button>
                  ) : null}
                  {showWishlist ? (
                    <Button size="sm" variant="outline" className="h-9 rounded-full" onClick={handleWishlistToggle}>
                      {isWishlisted ? <HeartStraight size={16} weight="fill" /> : <Heart size={16} />}
                      Wishlist
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </Link>
      </Card>
    )
  }

  if (variant === 'showcase') {
    return (
      <Card className={cn(shellClassName, 'group', className)} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <Link href={resolvedHref}>
          <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
            <div className={cn('relative overflow-hidden bg-muted', aspectClassName)}>
              <img
                src={isHovered && mediaHoverSwap && secondaryImage ? secondaryImage.url : currentImage?.url}
                alt={currentImage?.alt || product.name}
                className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
              />
              {mediaShowGradient ? (
                <div className="absolute inset-0 bg-gradient-to-t from-background/35 via-transparent to-transparent" />
              ) : null}

              {badgeItems.length > 0 ? (
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {badgeItems.map((b) => (
                    <Badge key={b.label} variant={b.variant} className="text-xs font-bold">
                      {b.label}
                    </Badge>
                  ))}
                </div>
              ) : null}

              {!product.inStock ? (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Badge variant="secondary" className="text-sm">
                    Out of Stock
                  </Badge>
                </div>
              ) : null}
            </div>

            <div className={cn(density === 'compact' ? 'p-4' : 'p-6', 'flex flex-col justify-between')}>
              <div>
                {showBrand ? (
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">{product.brand}</p>
                ) : null}
                <h3 className="text-lg sm:text-xl font-semibold tracking-tight line-clamp-2">{product.name}</h3>
                <div className="mt-3 flex items-center justify-between">
                  {showRating ? <Rating rating={product.rating} count={product.reviewCount} size="sm" /> : null}
                  {showStockHint && product.stockCount && product.stockCount < 10 ? (
                    <span className="text-xs text-accent font-semibold">
                      <Lightning size={12} weight="fill" className="inline mr-1" />
                      {product.stockCount} left
                    </span>
                  ) : null}
                </div>
                <div className="mt-4">
                  <Price price={product.price} compareAtPrice={product.compareAtPrice} currency={product.currency} size="md" />
                </div>
              </div>

              {showActions && (showAddToCart || showQuickView || showWishlist) ? (
                <div className={cn('mt-5 flex flex-wrap items-center gap-2')}
                >
                  {showAddToCart ? (
                    <Button size="sm" className="h-10 rounded-full" onClick={handleAddToCart} disabled={!product.inStock}>
                      <ShoppingCart size={16} weight="bold" />
                      Add to cart
                    </Button>
                  ) : null}
                  {showQuickView ? (
                    <Button size="sm" variant="secondary" className="h-10 rounded-full" onClick={handleQuickView}>
                      <Eye size={16} weight="bold" />
                      Quick view
                    </Button>
                  ) : null}
                  {showWishlist ? (
                    <Button size="sm" variant="outline" className="h-10 rounded-full" onClick={handleWishlistToggle}>
                      {isWishlisted ? <HeartStraight size={16} weight="fill" /> : <Heart size={16} />}
                      Wishlist
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </Link>
      </Card>
    )
  }

  return (
    <Card
      className={cn(shellClassName, 'group', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={resolvedHref}>
        <div className={cn('relative overflow-hidden bg-muted', aspectClassName)}>
          <img
            src={isHovered && mediaHoverSwap && secondaryImage ? secondaryImage.url : currentImage?.url}
            alt={currentImage?.alt || product.name}
            className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
          />

          {mediaShowGradient ? (
            <div className="absolute inset-0 bg-gradient-to-t from-background/35 via-transparent to-transparent" />
          ) : null}

          {badgeItems.length > 0 ? (
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {badgeItems.map((b) => (
                <Badge key={b.label} variant={b.variant} className="text-xs font-bold">
                  {b.label}
                </Badge>
              ))}
            </div>
          ) : null}

          {!product.inStock && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Badge variant="secondary" className="text-sm">
                Out of Stock
              </Badge>
            </div>
          )}

          {showActions && (showAddToCart || showQuickView || showWishlist) ? (
            <div
              className={cn(
                'absolute bottom-3 left-3 right-3 flex items-center gap-2 transition-all duration-200',
                actionsVisibleClass
              )}
            >
              {showAddToCart ? (
                <Button size="sm" className="flex-1" onClick={handleAddToCart} disabled={!product.inStock}>
                  <ShoppingCart size={16} weight="bold" />
                  Add to Cart
                </Button>
              ) : null}
              {showQuickView ? (
                <Button size="sm" variant="secondary" onClick={handleQuickView}>
                  <Eye size={16} weight="bold" />
                </Button>
              ) : null}
              {showWishlist ? (
                <Button size="sm" variant="secondary" onClick={handleWishlistToggle}>
                  {isWishlisted ? <HeartStraight size={16} weight="fill" /> : <Heart size={16} />}
                </Button>
              ) : null}
            </div>
          ) : null}

          {showWishlist && !showActions ? (
            <button
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
              onClick={handleWishlistToggle}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              {isWishlisted ? <HeartStraight size={18} weight="fill" /> : <Heart size={18} />}
            </button>
          ) : null}
        </div>

        <div className={cn(density === 'compact' ? 'p-3' : 'p-4')}>
          {showBrand ? (
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold">{product.brand}</p>
          ) : null}
          <h3 className={cn('font-medium mb-2 line-clamp-2', density === 'compact' ? 'min-h-[2.25rem]' : 'min-h-[2.5rem]')}>{product.name}</h3>

          <div className="flex items-center justify-between mb-2">
            {showRating ? <Rating rating={product.rating} count={product.reviewCount} size="sm" /> : <span />}
            {showStockHint && product.stockCount && product.stockCount < 10 && (
              <span className="text-[10px] text-accent font-semibold">
                <Lightning size={10} weight="fill" className="inline mr-0.5" />
                {product.stockCount} left
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between">
            <Price
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              currency={product.currency}
              size="md"
            />
          </div>
        </div>
      </Link>
    </Card>
  )
}
