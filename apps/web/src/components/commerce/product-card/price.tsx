import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Price } from '@/components/commerce/price'
import type { ProductCardContext } from './types'

function formatMoney(amount: number, currency?: string | null) {
  const hasCurrency = typeof currency === 'string' && currency.trim().length > 0
  return new Intl.NumberFormat('en-KE', {
    style: hasCurrency ? 'currency' : 'decimal',
    currency: hasCurrency ? currency : undefined,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function savings(ctx: ProductCardContext<any>): { amount?: string; percent?: string } {
  const price = ctx.price ?? null
  const compare = ctx.compareAtPrice ?? null
  if (typeof price !== 'number' || typeof compare !== 'number') return {}
  if (compare <= price) return {}
  const amount = compare - price
  const pct = Math.round((amount / compare) * 100)
  return {
    amount: formatMoney(amount, ctx.currency),
    percent: Number.isFinite(pct) && pct > 0 ? `${pct}%` : undefined,
  }
}

export function ProductCardPrice<TProduct>({ ctx }: { ctx: ProductCardContext<TProduct> }): ReactNode {
  const currency = ctx.currency
  const price = ctx.price
  const compare = ctx.compareAtPrice
  if (typeof price !== 'number') return null
  const dense = ctx.appearance.density === 'compact' || ctx.variant === 'compact'

  const mode = ctx.behavior.price.mode || (typeof compare === 'number' && compare > price ? 'discount' : 'simple')
  const showSavings = ctx.behavior.price.showSavings ?? false
  const showExplanation = Boolean(ctx.behavior.price.explanation?.show && ctx.behavior.price.explanation?.text)
  const s = savings(ctx)

  if (mode === 'unit' && ctx.unitPriceLabel) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Price price={price} compareAtPrice={compare || undefined} currency={currency} size="md" />
          <span className="text-xs text-muted-foreground">{ctx.unitPriceLabel}</span>
        </div>
        {showExplanation ? <p className="text-xs text-muted-foreground">{ctx.behavior.price.explanation?.text}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-end justify-between gap-2">
        <Price price={price} compareAtPrice={compare || undefined} currency={currency} size={dense ? 'sm' : 'md'} />
        {showSavings && (s.amount || s.percent) ? (
          <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
            Save {showSavings === 'amount' ? s.amount : showSavings === 'percent' ? s.percent : `${s.amount} • ${s.percent}`}
          </Badge>
        ) : null}
      </div>
      {showExplanation ? <p className={cn('text-xs text-muted-foreground', dense ? 'leading-snug' : '')}>{ctx.behavior.price.explanation?.text}</p> : null}
    </div>
  )
}
