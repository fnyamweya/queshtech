import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ProductCardContext, ProductCardOptionGroup, ProductCardOptionValue } from './types'

function autoMode(groups: ProductCardOptionGroup[]): 'swatches' | 'dropdown' {
  const hasColor = groups.some((g) => g.id.toLowerCase() === 'color' || g.values.some((v) => Boolean(v.colorHex)))
  if (hasColor) return 'swatches'
  return 'dropdown'
}

export function ProductCardOptions<TProduct>({ ctx, className }: { ctx: ProductCardContext<TProduct>; className?: string }) {
  const cfg = ctx.behavior.options
  const show = cfg.show ?? (ctx.optionGroups.length > 0)
  if (!show || ctx.optionGroups.length === 0) return null

  const mode = cfg.mode === 'auto' ? autoMode(ctx.optionGroups) : (cfg.mode || 'auto')
  const maxVisible = cfg.maxVisible ?? 6

  const firstGroup = ctx.optionGroups[0]
  const selection = ctx.selectedOptions[firstGroup.id] || ''

  const values = useMemo(() => firstGroup.values.slice(0, maxVisible), [firstGroup.values, maxVisible])

  const select = (value: ProductCardOptionValue) => {
    const next = { ...ctx.selectedOptions, [firstGroup.id]: value.value }
    ctx.setSelectedOptions(next)
    cfg.onSelect?.({ product: ctx.product, groupId: firstGroup.id, value, selected: next })
  }

  if (mode === 'swatches') {
    const swatches = values.filter((v) => v.colorHex)
    if (swatches.length === 0) return null
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-[11px] text-muted-foreground">{firstGroup.label}:</span>
        <div className="flex items-center gap-1.5">
          {swatches.map((v) => {
            const isSelected = selection === v.value
            const disabled = v.inStock === false
            return (
              <button
                key={v.id}
                type="button"
                className={cn(
                  'h-5 w-5 rounded-full border transition-colors',
                  isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                  disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-primary/50'
                )}
                style={{ backgroundColor: v.colorHex }}
                aria-label={v.label}
                aria-pressed={isSelected}
                disabled={disabled}
                onClick={() => select(v)}
              />
            )
          })}
        </div>
      </div>
    )
  }

  // Pills for the first group (compact preview). Full pickers belong in PDP/quick-view.
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-[11px] text-muted-foreground">{firstGroup.label}:</span>
      {values.map((v) => {
        const isSelected = selection === v.value
        const disabled = v.inStock === false
        return (
          <Button
            key={v.id}
            type="button"
            size="sm"
            variant={isSelected ? 'default' : 'outline'}
            className={cn('h-7 rounded-full px-3 text-[11px]', disabled ? 'pointer-events-none opacity-40' : '')}
            onClick={() => select(v)}
            aria-pressed={isSelected}
          >
            {v.label}
          </Button>
        )
      })}
    </div>
  )
}

