import type { ReactNode } from 'react'
import { Link } from 'wouter'
import { Lightning } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Rating } from '@/components/commerce/rating'
import type { ProductCardContext } from './types'
import { highlightTerms } from './utils'

function clampClass(prefix: 'line-clamp' | 'sm:line-clamp', value: number | undefined, fallback: string) {
  const n = typeof value === 'number' ? Math.round(value) : NaN
  if (!Number.isFinite(n)) return fallback
  if (n <= 1) return `${prefix}-1`
  if (n === 2) return `${prefix}-2`
  if (n === 3) return `${prefix}-3`
  if (n === 4) return `${prefix}-4`
  return fallback
}

export function ProductCardMeta<TProduct>({
  ctx,
  onTitleClick,
  className,
}: {
  ctx: ProductCardContext<TProduct>
  onTitleClick?: () => void
  className?: string
}): ReactNode {
  const meta = ctx.behavior.meta
  const content = ctx.behavior.content
  const discovery = ctx.behavior.discovery

  const showBrand = Boolean(meta.showBrand && ctx.brand)
  const showRating = Boolean(meta.showRating && typeof ctx.rating === 'number')
  const showStockHint = Boolean(
    meta.showStockHint &&
      ctx.inStock &&
      typeof ctx.stockCount === 'number' &&
      ctx.stockCount > 0 &&
      ctx.stockCount <= (meta.stockThreshold ?? 10)
  )

  const title = discovery.highlightTerms?.length ? highlightTerms(ctx.title, discovery.highlightTerms) : ctx.title
  const titleNode =
    ctx.behavior.a11y.linkStrategy === 'title-only'
      ? (
          <Link href={ctx.href} onClick={() => onTitleClick?.()} className="relative z-20 hover:underline">
            {title}
          </Link>
        )
      : (
          <>{title}</>
        )

  return (
    <div className={cn('space-y-2', className)}>
      {discovery.reason?.show && discovery.reason.text ? (
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{discovery.reason.text}</p>
      ) : null}

      {showBrand ? (
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold truncate">{ctx.brand}</p>
      ) : null}

      <h3
        className={cn(
          'font-semibold tracking-tight',
          ctx.variant === 'compact' ? 'text-sm' : 'text-[15px]',
          clampClass('line-clamp', content.titleClamp, 'line-clamp-2')
        )}
      >
        {titleNode}
      </h3>

      {content.showDescription && ctx.description ? (
        <p className={cn('text-sm text-muted-foreground', clampClass('line-clamp', content.descriptionClamp, 'line-clamp-2'))}>
          {ctx.description}
        </p>
      ) : null}

      {showRating || showStockHint ? (
        <div className="flex items-center justify-between gap-3">
          {showRating ? <Rating rating={ctx.rating || 0} count={ctx.reviewCount || undefined} size="sm" /> : <span />}
          {showStockHint ? (
            <span className="text-[10px] text-accent font-semibold">
              <Lightning size={10} weight="fill" className="inline mr-1" />
              {ctx.stockCount} left
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

