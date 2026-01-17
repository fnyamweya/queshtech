import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowsLeftRight,
  BellRinging,
  ChatCircleDots,
  Eye,
  Heart,
  HeartStraight,
  Package,
  ShoppingCart,
  Timer,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProductCardContext, ProductCardPurchaseMode, ProductCardSlot } from './types'
import { clampNumber } from './utils'

function resolveSlot<TProduct>(slot: ProductCardSlot<TProduct> | undefined, ctx: ProductCardContext<TProduct>) {
  if (!slot) return null
  return typeof slot === 'function' ? slot(ctx) : slot
}

function ctaLabel(mode: ProductCardPurchaseMode): string {
  switch (mode) {
    case 'subscribe':
      return 'Subscribe'
    case 'quote':
      return 'Request quote'
    case 'preorder':
      return 'Preorder'
    case 'notify':
      return 'Notify me'
    case 'add-to-cart':
    default:
      return 'Add to cart'
  }
}

function ctaIcon(mode: ProductCardPurchaseMode) {
  switch (mode) {
    case 'subscribe':
      return <Timer size={16} weight="bold" />
    case 'quote':
      return <ChatCircleDots size={16} weight="bold" />
    case 'preorder':
      return <Package size={16} weight="bold" />
    case 'notify':
      return <BellRinging size={16} weight="bold" />
    case 'add-to-cart':
    default:
      return <ShoppingCart size={16} weight="bold" />
  }
}

export function ProductCardActions<TProduct>({
  ctx,
  slot,
  placement,
  className,
}: {
  ctx: ProductCardContext<TProduct>
  slot?: ProductCardSlot<TProduct>
  placement: 'overlay' | 'inline'
  className?: string
}): ReactNode {
  const custom = resolveSlot(slot, ctx)
  if (custom) return <>{custom}</>

  const actions = ctx.behavior.actions
  const purchase = ctx.behavior.purchase
  const interaction = ctx.behavior.interaction
  const telemetry = ctx.behavior.telemetry

  const effectiveMode = useMemo(() => {
    const mode = actions.mode
    if (mode === 'hover' && ctx.isTouch) return 'always'
    return mode
  }, [actions.mode, ctx.isTouch])

  const showAdd = Boolean(actions.showAdd && purchase.onPurchase)
  const showQuickView = Boolean(actions.showQuickView && actions.onQuickView)
  const showWishlist = Boolean(actions.showWishlist && actions.onWishlistToggle)
  const compare = ctx.behavior.discovery.compare
  const showCompare = Boolean(compare?.show && compare.onToggle)
  const compareSelected = Boolean(compare?.selected)

  const showAny = effectiveMode !== 'none' && (showAdd || showQuickView || showWishlist || showCompare)
  if (!showAny) return null

  const [inlineFeedback, setInlineFeedback] = useState<string | null>(null)

  const wishlisted = Boolean(actions.wishlisted)

  const canPurchase = (() => {
    const mode = purchase.mode
    if (mode === 'notify' || mode === 'quote') return true
    if (mode === 'preorder') return true
    return ctx.inStock
  })()

  const purchaseMode = purchase.mode ?? 'add-to-cart'

  const quantityCfg = purchase.quantity ?? {}
  const qtyMin = quantityCfg.min ?? 1
  const qtyMax = quantityCfg.max ?? 99
  const qtyStep = quantityCfg.step ?? 1
  const showQty = Boolean(quantityCfg.show)

  const setQty = (next: number) => ctx.setQuantity(clampNumber(next, qtyMin, qtyMax))

  const track = (action: string, meta?: Record<string, unknown>) => {
    telemetry.onAction?.({ product: ctx.product, action, meta })
  }

  const purchaseClick = () => {
    if (!purchase.onPurchase) return
    if (!canPurchase) return

    purchase.onPurchase({
      product: ctx.product,
      selected: ctx.selectedOptions,
      quantity: ctx.quantity,
      mode: purchaseMode,
    })
    track('purchase', { mode: purchaseMode, quantity: ctx.quantity })

    const feedback = interaction.feedback || 'none'
    if (feedback === 'toast') {
      const undoEnabled = Boolean(interaction.undoAddToCart?.enabled && purchaseMode === 'add-to-cart' && purchase.onUndoPurchase)
      const duration = interaction.undoAddToCart?.windowMs ?? 4500
      toast.success(ctaLabel(purchaseMode), {
        description: ctx.title,
        duration,
        action: undoEnabled
          ? {
              label: 'Undo',
              onClick: () => {
                purchase.onUndoPurchase?.({ product: ctx.product, selected: ctx.selectedOptions, quantity: ctx.quantity })
                track('undo_purchase', { mode: purchaseMode, quantity: ctx.quantity })
              },
            }
          : undefined,
      })
    } else if (feedback === 'inline') {
      setInlineFeedback(`${ctaLabel(purchaseMode)} • ${ctx.quantity}x`)
      window.setTimeout(() => setInlineFeedback(null), 2400)
    }
  }

  const quickViewClick = () => {
    actions.onQuickView?.({ product: ctx.product })
    track('quick_view')
  }

  const wishlistClick = () => {
    const next = !wishlisted
    actions.onWishlistToggle?.({ product: ctx.product, selected: next })
    track(next ? 'wishlist_add' : 'wishlist_remove')
  }

  const compareClick = () => {
    const next = !compareSelected
    compare?.onToggle?.({ product: ctx.product, selected: next })
    track('compare_toggle', { selected: next })
  }

  const container =
    placement === 'overlay'
      ? cn(
          'absolute left-3 right-3 bottom-3 z-20 flex items-center gap-2',
          effectiveMode === 'always'
            ? 'opacity-100 translate-y-0'
            : cn(
                'opacity-0 translate-y-2 pointer-events-none',
                'transition-all duration-200',
                'group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0',
                'group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0'
              )
        )
      : cn(
          'relative z-20 mt-3 flex flex-wrap items-center gap-2',
          effectiveMode === 'hover'
            ? cn(
                'opacity-0 translate-y-1 pointer-events-none transition-all duration-200',
                'group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0',
                'group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0'
              )
            : ''
        )

  return (
    <div className={cn(container, className)}>
      {showQty ? (
        <div className="flex items-center rounded-full border border-border bg-background/70 backdrop-blur-sm">
          <button
            type="button"
            className="h-9 w-9 rounded-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setQty(ctx.quantity - qtyStep)
              track('quantity_decrement', { quantity: ctx.quantity - qtyStep })
            }}
            disabled={ctx.quantity <= qtyMin}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-semibold tabular-nums">{ctx.quantity}</span>
          <button
            type="button"
            className="h-9 w-9 rounded-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setQty(ctx.quantity + qtyStep)
              track('quantity_increment', { quantity: ctx.quantity + qtyStep })
            }}
            disabled={ctx.quantity >= qtyMax}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      ) : null}

      {showAdd ? (
        <Button
          size="sm"
          className={cn('rounded-full', placement === 'overlay' ? 'flex-1' : '')}
          disabled={!canPurchase}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            purchaseClick()
          }}
        >
          {ctaIcon(purchaseMode)}
          {canPurchase ? ctaLabel(purchaseMode) : 'Out of stock'}
        </Button>
      ) : null}

      {showQuickView ? (
        <Button
          size="sm"
          variant="secondary"
          className={cn('rounded-full', placement === 'overlay' ? '' : '')}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            quickViewClick()
          }}
          aria-label="Quick view"
        >
          <Eye size={16} weight="bold" />
          {placement === 'inline' ? 'Quick view' : null}
        </Button>
      ) : null}

      {showWishlist ? (
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            wishlistClick()
          }}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          {wishlisted ? <HeartStraight size={16} weight="fill" /> : <Heart size={16} />}
          {placement === 'inline' ? 'Wishlist' : null}
        </Button>
      ) : null}

      {showCompare ? (
        <Button
          size="sm"
          variant={compareSelected ? 'default' : 'secondary'}
          className="rounded-full"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            compareClick()
          }}
          aria-pressed={compareSelected}
          aria-label={compareSelected ? 'Remove from compare' : 'Add to compare'}
        >
          <ArrowsLeftRight size={16} weight="bold" />
          {placement === 'inline' ? 'Compare' : null}
        </Button>
      ) : null}

      {inlineFeedback ? (
        <span className="ml-auto text-xs text-muted-foreground">{inlineFeedback}</span>
      ) : null}
    </div>
  )
}
