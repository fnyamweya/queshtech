import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Package } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import type { ProductCardContext, ProductCardSlot } from './types'
import { ProductCardBadges } from './badges'

function resolveSlot<TProduct>(slot: ProductCardSlot<TProduct> | undefined, ctx: ProductCardContext<TProduct>) {
  if (!slot) return null
  return typeof slot === 'function' ? slot(ctx) : slot
}

function mediaAspectClass(ctx: ProductCardContext<any>) {
  const aspect = ctx.appearance.media.aspect
  if (aspect === 'square') return 'aspect-square'
  if (aspect === 'portrait') return 'aspect-[4/5]'
  // auto
  if (ctx.variant === 'horizontal') return 'h-28 w-28'
  if (ctx.variant === 'compact') return 'aspect-square'
  return 'aspect-[4/5]'
}

export function ProductCardMedia<TProduct>({
  ctx,
  mediaSlot,
  badgesSlot,
  className,
}: {
  ctx: ProductCardContext<TProduct>
  mediaSlot?: ProductCardSlot<TProduct>
  badgesSlot?: ProductCardSlot<TProduct>
  className?: string
}): ReactNode {
  const custom = resolveSlot(mediaSlot, ctx)
  if (custom) return custom

  const images = ctx.images || []
  const primary = images.find((i) => i.isPrimary) || images[0]
  const secondary = images.find((i) => i.url !== primary?.url) || images[1]

  const hoverSwap = Boolean(ctx.appearance.media.hoverSwap) && !ctx.prefersReducedMotion && Boolean(secondary?.url)
  const gradient = Boolean(ctx.appearance.media.showGradient)

  return (
    <div className={cn('relative overflow-hidden bg-muted', mediaAspectClass(ctx), className)}>
      {primary?.url ? (
        <>
          <img
            src={primary.url}
            alt={primary.alt || ctx.title}
            loading="lazy"
            className={cn(
              'h-full w-full object-cover',
              ctx.appearance.media.imageClassName,
              hoverSwap ? 'transition-transform duration-500 group-hover:scale-[1.03]' : ''
            )}
          />
          {hoverSwap ? (
            <img
              src={secondary.url}
              alt={secondary.alt || ctx.title}
              loading="lazy"
              className={cn(
                'absolute inset-0 h-full w-full object-cover opacity-0',
                'transition-opacity duration-500 sm:group-hover:opacity-100'
              )}
            />
          ) : null}
        </>
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-muted to-muted/30 flex items-center justify-center">
          <Package size={22} className="text-muted-foreground" />
        </div>
      )}

      {gradient ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/55 via-background/0 to-transparent opacity-90" />
      ) : null}

      <ProductCardBadges ctx={ctx} slot={badgesSlot} />

      {!ctx.inStock ? (
        <div className="absolute inset-0 z-20 bg-background/70 backdrop-blur-[1px] flex items-center justify-center">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            Out of stock
          </Badge>
        </div>
      ) : null}
    </div>
  )
}

