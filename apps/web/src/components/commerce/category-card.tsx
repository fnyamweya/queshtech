import { Link } from 'wouter'
import { Card } from '@/components/ui/card'
import { Category } from '@/types'
import { cn } from '@/lib/utils'
import { ArrowRight } from '@phosphor-icons/react'

interface CategoryCardProps {
  category: Category
  className?: string
  size?: 'default' | 'compact'
}

export function CategoryCard({ category, className, size = 'default' }: CategoryCardProps) {
  const image = category.imageUrl || category.image
  const hasImage = Boolean(image)

  return (
    <Link href={`/category/${category.slug}`} className="block">
      <Card
        className={cn(
          'group relative overflow-hidden transition-all duration-300',
          size === 'compact' ? 'aspect-[4/3] rounded-xl hover:shadow-md' : 'aspect-[4/3] hover:shadow-lg',
          !hasImage ? 'bg-gradient-to-br from-muted/40 via-background to-background' : '',
          className
        )}
      >
        {hasImage && (
          <div className="absolute inset-0">
            <img
              src={image as string}
              alt={category.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </div>
        )}

        <div
          className={cn(
            'relative h-full flex flex-col justify-end',
            size === 'compact' ? 'p-4' : 'p-6',
            hasImage ? 'text-white' : 'text-foreground'
          )}
        >
          <h3
            className={cn(
              'font-semibold leading-snug',
              size === 'compact' ? 'text-sm sm:text-base line-clamp-1' : 'text-xl line-clamp-2'
            )}
          >
            {category.name}
          </h3>

          {size !== 'compact' && category.description ? (
            <p className={cn('mt-2 text-sm line-clamp-2', hasImage ? 'text-white/90' : 'text-muted-foreground')}>
              {category.description}
            </p>
          ) : null}

          <div
            className={cn(
              'mt-3 flex items-center font-medium text-xs sm:text-sm group-hover:gap-2 transition-all',
              hasImage ? 'text-white' : 'text-foreground'
            )}
          >
            {size === 'compact' ? 'Shop' : 'Shop now'}
            <ArrowRight
              size={16}
              weight="bold"
              className="ml-1 transition-transform group-hover:translate-x-1"
            />
          </div>
        </div>
      </Card>
    </Link>
  )
}
