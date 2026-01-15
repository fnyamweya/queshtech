import { Star, StarHalf } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ReactElement } from 'react'

interface RatingProps {
  rating: number
  count?: number
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
  className?: string
}

export function Rating({
  rating,
  count,
  size = 'md',
  showCount = true,
  className,
}: RatingProps) {
  const sizeMap = {
    sm: 14,
    md: 16,
    lg: 20,
  }

  const textSizeMap = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  const iconSize = sizeMap[size]

  const renderStars = () => {
    const stars: ReactElement[] = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Star key={i} size={iconSize} weight="fill" className="text-amber-400" />
      )
    }

    if (hasHalfStar) {
      stars.push(
        <StarHalf
          key="half"
          size={iconSize}
          weight="fill"
          className="text-amber-400"
        />
      )
    }

    const emptyStars = 5 - stars.length
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Star
          key={`empty-${i}`}
          size={iconSize}
          weight="regular"
          className="text-border"
        />
      )
    }

    return stars
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-0.5">{renderStars()}</div>
      
      {showCount && count !== undefined && (
        <span className={cn('text-muted-foreground', textSizeMap[size])}>
          ({count})
        </span>
      )}
    </div>
  )
}
