import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ProductCardVariant } from './types'

export function ProductCardSkeleton({ variant, className }: { variant: ProductCardVariant; className?: string }) {
  if (variant === 'horizontal') {
    return (
      <Card className={cn('rounded-2xl border border-border/60 p-4 gap-0', className)}>
        <div className="flex gap-4">
          <Skeleton className="h-28 w-28 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-40" />
            <div className="pt-2 flex gap-2">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-6 w-24" />
        </div>
      </Card>
    )
  }

  const isCompact = variant === 'compact'
  const media = isCompact ? 'aspect-square' : 'aspect-[4/5]'

  return (
    <Card className={cn('rounded-2xl border border-border/60 p-0 gap-0 overflow-hidden', className)}>
      <Skeleton className={cn('w-full', media)} />
      <div className={cn(isCompact ? 'p-3' : 'p-4', 'space-y-2')}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-6 w-28" />
      </div>
    </Card>
  )
}

