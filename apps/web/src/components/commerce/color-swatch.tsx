import { Check } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export function ColorSwatch({
  color,
  selected,
  disabled,
  label,
  onClick,
}: {
  color: string
  selected?: boolean
  disabled?: boolean
  label?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'relative h-10 w-10 rounded-full border-2 transition-all',
        selected ? 'border-foreground ring-2 ring-ring ring-offset-2' : 'border-border hover:border-foreground/50',
        disabled && 'cursor-not-allowed opacity-40'
      )}
      style={{ backgroundColor: color }}
      aria-label={label}
    >
      {selected ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Check size={16} weight="bold" className="text-white drop-shadow" />
        </span>
      ) : null}
      {disabled ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-0.5 w-full rotate-45 bg-foreground/60" />
        </span>
      ) : null}
    </button>
  )
}
