import { useState } from 'react'
import { Link } from 'wouter'
import { ShoppingCart, Heart, Eye, Truck, Lightning } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Price } from './price'
import { Rating } from './rating'
import { Product } from '@/types'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  variant?: 'grid' | 'horizontal' | 'compact'
  onAddToCart?: (product: Product, variants?: Record<string, string>) => void
  onQuickView?: (product: Product) => void
  className?: string
}

export function ProductCard({
  product,
  variant = 'grid',
  onAddToCart,
  onQuickView,
  className,
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  
  const currentImage = product.images[imageIndex] || product.images[0]
  const secondaryImage = product.images[1]

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onAddToCart && product.inStock) {
      onAddToCart(product)
    }
  }

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onQuickView) {
      onQuickView(product)
    }
  }

  if (variant === 'compact') {
    return (
      <Card className={cn('overflow-hidden snap-start flex-shrink-0 w-full', className)}>
        <Link href={`/product/${product.slug}`}>
          <div className="relative aspect-square overflow-hidden bg-muted">
            <img
              src={currentImage?.url}
              alt={currentImage?.alt || product.name}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            />
            {product.badges && product.badges.length > 0 && (
              <div className="absolute top-2 left-2">
                <Badge
                  variant={product.badges[0].type === 'sale' ? 'destructive' : 'secondary'}
                  className="text-xs px-2 py-0.5 font-bold"
                >
                  {product.badges[0].label}
                </Badge>
              </div>
            )}
            {!product.inStock && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Badge variant="secondary" className="text-xs">
                  Out of Stock
                </Badge>
              </div>
            )}
          </div>

          <div className="p-3">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold truncate">
              {product.brand}
            </p>
            <h3 className="font-medium text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
              {product.name}
            </h3>
            <Rating rating={product.rating} count={product.reviewCount} size="sm" />
            <div className="mt-2 flex items-baseline justify-between">
              <Price
                price={product.price}
                compareAtPrice={product.compareAtPrice}
                currency={product.currency}
                size="sm"
              />
            </div>
          </div>
        </Link>
      </Card>
    )
  }

  if (variant === 'horizontal') {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <Link href={`/product/${product.slug}`}>
          <div className="flex gap-4 p-4 hover:bg-muted/50 transition-colors">
            <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
              <img
                src={currentImage?.url}
                alt={currentImage?.alt || product.name}
                className="w-full h-full object-cover"
              />
              {!product.inStock && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Badge variant="secondary">Out of Stock</Badge>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">{product.brand}</p>
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
                  <Rating rating={product.rating} count={product.reviewCount} size="sm" />
                </div>
                <div className="text-right">
                  <Price
                    price={product.price}
                    compareAtPrice={product.compareAtPrice}
                    currency={product.currency}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </Card>
    )
  }

  return (
    <Card
      className={cn('group overflow-hidden', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/product/${product.slug}`}>
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          <img
            src={isHovered && secondaryImage ? secondaryImage.url : currentImage?.url}
            alt={currentImage?.alt || product.name}
            className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
          />

          {product.badges && product.badges.length > 0 && (
            <div className="absolute top-3 left-3">
              <Badge
                variant={product.badges[0].type === 'sale' ? 'destructive' : 'secondary'}
                className="text-xs font-bold"
              >
                {product.badges[0].label}
              </Badge>
            </div>
          )}

          {!product.inStock && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Badge variant="secondary" className="text-sm">
                Out of Stock
              </Badge>
            </div>
          )}

          <div
            className={cn(
              'absolute bottom-3 left-3 right-3 flex items-center gap-2 transition-all duration-200',
              isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            )}
          >
            <Button
              size="sm"
              className="flex-1"
              onClick={handleAddToCart}
              disabled={!product.inStock}
            >
              <ShoppingCart size={16} weight="bold" />
              Add to Cart
            </Button>
            {onQuickView && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleQuickView}
              >
                <Eye size={16} weight="bold" />
              </Button>
            )}
          </div>

          <button
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <Heart size={18} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold">
            {product.brand}
          </p>
          <h3 className="font-medium mb-2 line-clamp-2 min-h-[2.5rem]">
            {product.name}
          </h3>

          <div className="flex items-center justify-between mb-2">
            <Rating rating={product.rating} count={product.reviewCount} size="sm" />
            {product.stockCount && product.stockCount < 10 && (
              <span className="text-[10px] text-accent font-semibold">
                <Lightning size={10} weight="fill" className="inline mr-0.5" />
                {product.stockCount} left
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between">
            <Price
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              currency={product.currency}
              size="md"
            />
          </div>
        </div>
      </Link>
    </Card>
  )
}
