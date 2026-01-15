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
  const baseStyles = 'relative w-full h-12 font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2.5 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variantStyles = {
    primary: 'bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98] shadow-lg hover:shadow-xl',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98]',
    outline: 'border-2 border-border bg-transparent text-foreground hover:bg-secondary active:scale-[0.98]',
    google: 'border-2 border-border bg-white text-foreground hover:bg-gray-50 active:scale-[0.98]'
  }

  return (
    <button
      className={cn(baseStyles, variantStyles[variant], className)}
      disabled={disabled || isLoading}
      style={{ borderRadius: 0 }}
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
