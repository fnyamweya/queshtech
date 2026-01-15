import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ProductVariant } from '@/types'
import { cn } from '@/lib/utils'
import { Check } from '@phosphor-icons/react'

interface VariantSelectorProps {
  label: string
  variants: ProductVariant[]
  selectedValue?: string
  onValueChange: (value: string) => void
  className?: string
}

export function VariantSelector({
  label,
  variants,
  selectedValue,
  onValueChange,
  className,
}: VariantSelectorProps) {
  const isColorVariant = variants[0]?.type === 'color'

  if (isColorVariant) {
    return (
      <div className={className}>
        <Label className="text-sm font-medium mb-3 block">{label}</Label>
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => {
            const isSelected = selectedValue === variant.value
            const isDisabled = !variant.inStock

            return (
              <button
                key={variant.id}
                onClick={() => !isDisabled && onValueChange(variant.value)}
                disabled={isDisabled}
                className={cn(
                  'relative w-10 h-10 rounded-full border-2 transition-all',
                  isSelected
                    ? 'border-foreground ring-2 ring-ring ring-offset-2'
                    : 'border-border hover:border-foreground/50',
                  isDisabled && 'opacity-40 cursor-not-allowed'
                )}
                style={{ backgroundColor: variant.colorHex }}
                title={`${variant.name} ${!variant.inStock ? '(Out of Stock)' : ''}`}
              >
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check size={16} weight="bold" className="text-white drop-shadow" />
                  </div>
                )}
                {isDisabled && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-0.5 bg-foreground/60 rotate-45" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {selectedValue && (
          <p className="text-sm text-muted-foreground mt-2">
            Selected: {variants.find((v) => v.value === selectedValue)?.name}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={className}>
      <Label className="text-sm font-medium mb-3 block">{label}</Label>
      <RadioGroup value={selectedValue} onValueChange={onValueChange}>
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => {
            const isSelected = selectedValue === variant.value
            const isDisabled = !variant.inStock

            return (
              <div key={variant.id}>
                <RadioGroupItem
                  value={variant.value}
                  id={variant.id}
                  disabled={isDisabled}
                  className="sr-only"
                />
                <Label
                  htmlFor={variant.id}
                  className={cn(
                    'flex items-center justify-center px-4 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium',
                    isSelected
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:border-foreground/50 bg-background',
                    isDisabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  {variant.name}
                  {isDisabled && (
                    <span className="ml-1.5 text-xs">(Out of Stock)</span>
                  )}
                </Label>
              </div>
            )
          })}
        </div>
      </RadioGroup>
    </div>
  )
}
