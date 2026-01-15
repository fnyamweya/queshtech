import { Button } from '@/components/ui/button'
import { Minus, Plus } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface QuantityInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  className?: string
}

export function QuantityInput({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: QuantityInputProps) {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1)
    }
  }

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1)
    }
  }

  return (
    <div className={cn('flex items-center border rounded-lg', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDecrement}
        disabled={value <= min}
        className="h-10 w-10 rounded-r-none"
      >
        <Minus size={16} weight="bold" />
      </Button>
      <div className="flex-1 text-center font-medium min-w-[3rem]">{value}</div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleIncrement}
        disabled={value >= max}
        className="h-10 w-10 rounded-l-none"
      >
        <Plus size={16} weight="bold" />
      </Button>
    </div>
  )
}
