import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BoldButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'google'
  isLoading?: boolean
  icon?: ReactNode
}

export function BoldButton({
  children,
  variant = 'primary',
  isLoading = false,
  icon,
  className,
  disabled,
  ...props
}: BoldButtonProps) {
  const baseStyles =
    'relative w-full h-12 rounded-md font-semibold text-base transition-[transform,box-shadow,background-color,color,border-color,opacity] duration-200 flex items-center justify-center gap-2.5 overflow-hidden group cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:translate-y-px active:scale-[0.99]'
  
  const variantStyles = {
    primary:
      'bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:bg-[color-mix(in_oklab,var(--color-primary)_88%,black)] dark:hover:bg-[color-mix(in_oklab,var(--color-primary)_88%,white)]',
    secondary:
      'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklab,var(--color-secondary)_88%,black)] dark:hover:bg-[color-mix(in_oklab,var(--color-secondary)_88%,white)]',
    outline: 'border-2 border-border bg-transparent text-foreground hover:bg-muted',
    google:
      'border-2 border-border bg-background text-foreground hover:bg-muted dark:bg-input/30 dark:hover:bg-input/45'
  }

  return (
    <button
      className={cn(baseStyles, variantStyles[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-current border-t-transparent animate-spin" style={{ borderRadius: '50%' }} />
          <span>Loading...</span>
        </div>
      ) : (
        <>
          <span className="font-semibold tracking-wide">{children}</span>
          {icon && (
            <span className="transition-transform duration-200 group-hover:translate-x-1">
              {icon}
            </span>
          )}
        </>
      )}
    </button>
  )
}
