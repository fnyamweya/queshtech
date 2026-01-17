import { cn } from '@/lib/utils'
import type { ProductCardContext } from './types'

export function ProductCardSpecs<TProduct>({ ctx, className }: { ctx: ProductCardContext<TProduct>; className?: string }) {
  const cfg = ctx.behavior.specs
  const show = cfg.show ?? false
  if (!show) return null

  const items = (cfg.items && cfg.items.length > 0 ? cfg.items : ctx.specs).slice(0, cfg.max ?? 3)
  if (items.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-2 text-[11px] text-muted-foreground', className)}>
      {items.map((s) => (
        <span key={`${s.label}:${s.value}`} className="rounded-full border border-border bg-background/60 px-2.5 py-1">
          <span className="font-medium text-foreground/80">{s.label}:</span> {s.value}
        </span>
      ))}
    </div>
  )
}
