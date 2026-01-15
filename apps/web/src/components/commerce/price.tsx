import { cn } from '@/lib/utils'

interface PriceProps {
  price: number
  compareAtPrice?: number
  currency?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showDiscount?: boolean
}

export function Price({
  price,
  compareAtPrice,
  currency = 'KES',
  className,
  size = 'md',
  showDiscount = true,
}: PriceProps) {
  const hasDiscount = compareAtPrice && compareAtPrice > price
  const discountPercent = hasDiscount
    ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
    : 0

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
  }

  const compareSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <span className={cn('text-foreground', sizeClasses[size])}>
        {formatPrice(price)}
      </span>
      
      {hasDiscount && (
        <>
          <span
            className={cn(
              'text-muted-foreground line-through',
              compareSizeClasses[size]
            )}
          >
            {formatPrice(compareAtPrice)}
          </span>
          
          {showDiscount && (
            <span className="text-xs font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
              -{discountPercent}%
            </span>
          )}
        </>
      )}
    </div>
  )
}
