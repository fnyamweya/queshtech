import { Link } from 'wouter'
import { Card } from '@/components/ui/card'
import { Category } from '@/types'
import { cn } from '@/lib/utils'
import { ArrowRight } from '@phosphor-icons/react'

interface CategoryCardProps {
  category: Category
  className?: string
}

export function CategoryCard({ category, className }: CategoryCardProps) {
  return (
    <Link href={`/category/${category.slug}`}>
      <Card
        className={cn(
          'group relative overflow-hidden aspect-[4/3] hover:shadow-lg transition-all duration-300',
          className
        )}
      >
        {(category.imageUrl || category.image) && (
          <div className="absolute inset-0">
            <img
              src={category.imageUrl || category.image}
              alt={category.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </div>
        )}

        <div className="relative h-full p-6 flex flex-col justify-end">
          <h3 className="text-xl font-semibold text-white mb-1">
            {category.name}
          </h3>
          {category.description && (
            <p className="text-sm text-white/90 mb-3 line-clamp-2">
              {category.description}
            </p>
          )}
          <div className="flex items-center text-white font-medium text-sm group-hover:gap-2 transition-all">
            Shop Now
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
