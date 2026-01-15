import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface BoldInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export const BoldInput = forwardRef<HTMLInputElement, BoldInputProps>(
  ({ label, error, className, required, ...props }, ref) => {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
        <input
          ref={ref}
          className={cn(
            'w-full h-12 px-4 text-base',
            'bg-background border-2 border-input',
            'text-foreground placeholder:text-muted-foreground',
            'transition-all duration-200',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            className
          )}
          style={{ borderRadius: 0 }}
          {...props}
        />
        {error && (
          <p className="text-sm text-destructive font-medium">{error}</p>
        )}
      </div>
    )
  }
)

BoldInput.displayName = 'BoldInput'
