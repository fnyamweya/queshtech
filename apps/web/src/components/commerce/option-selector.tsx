import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ColorSwatch } from './color-swatch'

export type OptionValue = {
  value: string
  label?: string
  inStock?: boolean
  colorHex?: string
}

export function OptionSelector({
  label,
  options,
  selectedValue,
  onValueChange,
  isColor,
  className,
}: {
  label: string
  options: OptionValue[]
  selectedValue?: string
  onValueChange: (value: string) => void
  isColor?: boolean
  className?: string
}) {
  const colorMode = Boolean(isColor || options.some((opt) => opt.colorHex))

  if (colorMode) {
    return (
      <div className={className}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <Label className="block text-sm font-medium">Select {label}</Label>
          {selectedValue ? (
            <div className="text-xs text-muted-foreground">
              {options.find((opt) => opt.value === selectedValue)?.label || selectedValue}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <ColorSwatch
              key={opt.value}
              color={opt.colorHex || opt.value}
              selected={selectedValue === opt.value}
              disabled={opt.inStock === false}
              label={`${opt.label || opt.value}${opt.inStock === false ? ' (Out of Stock)' : ''}`}
              onClick={() => onValueChange(opt.value)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label className="block text-sm font-medium">Select {label}</Label>
        {selectedValue ? (
          <div className="text-xs text-muted-foreground">
            {options.find((opt) => opt.value === selectedValue)?.label || selectedValue}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selectedValue === opt.value
          const isDisabled = opt.inStock === false
          const text = opt.label || opt.value
          const isCompact = String(text).trim().length <= 3
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onValueChange(opt.value)}
              disabled={isDisabled}
              className={cn(
                'inline-flex cursor-pointer select-none items-center justify-center rounded-md border text-sm font-medium transition-[transform,box-shadow,background-color,color,border-color,opacity]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                'active:translate-y-px active:scale-[0.99]',
                isCompact ? 'h-11 w-11 px-0' : 'h-11 px-4',
                isSelected ? 'border-foreground bg-foreground text-background' : 'border-transparent bg-muted/25 hover:bg-muted/35',
                isDisabled && 'cursor-not-allowed opacity-40 hover:bg-muted/25'
              )}
            >
              {text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
