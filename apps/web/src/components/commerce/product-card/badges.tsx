import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProductCardContext, ProductCardSlot } from './types'

function resolveSlot<TProduct>(slot: ProductCardSlot<TProduct> | undefined, ctx: ProductCardContext<TProduct>) {
  if (!slot) return null
  return typeof slot === 'function' ? slot(ctx) : slot
}

export function ProductCardBadges<TProduct>({
  ctx,
  slot,
  className,
}: {
  ctx: ProductCardContext<TProduct>
  slot?: ProductCardSlot<TProduct>
  className?: string
}) {
  const custom = resolveSlot(slot, ctx)
  if (custom) return <>{custom}</>

  const cfg = ctx.behavior.badges
  const show = cfg.show ?? true
  if (!show) return null

  const combined = [...(cfg.items || []), ...ctx.badges]
  if (combined.length === 0) return null

  const max = typeof cfg.max === 'number' ? cfg.max : ctx.variant === 'compact' ? 1 : 3
  const visible = combined.slice(0, max)

  return (
    <div className={cn('absolute left-3 top-3 z-20 flex flex-col items-start gap-1.5', className)}>
      {visible.map((b) => (
        <Badge
          key={b.key || b.label}
          variant={b.variant || 'secondary'}
          className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold tracking-tight shadow-sm', b.className)}
        >
          {b.icon ? <span className="mr-1.5">{b.icon}</span> : null}
          {b.label}
        </Badge>
      ))}
    </div>
  )
}
