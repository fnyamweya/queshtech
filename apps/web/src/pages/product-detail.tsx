import { useEffect, useState } from 'react'
import { Link, useRoute } from 'wouter'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MarkdownContent } from '@/components/common/markdown-content'
import { Card } from '@/components/ui/card'
import { Price } from '@/components/commerce/price'
import { Rating } from '@/components/commerce/rating'
import { VariantSelector } from '@/components/commerce/variant-selector'
import { QuantityInput } from '@/components/commerce/quantity-input'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { ImageZoomDialog } from '@/components/commerce/image-zoom-dialog'
import { Product } from '@/types'
import { toast } from 'sonner'
import {
  ShoppingCart,
  Heart,
  Truck,
  ShieldCheck,
  ArrowLeft,
  ArrowsCounterClockwise,
  ShieldStar,
  Clock,
  Lightning,
  ChartLineUp,
  Medal,
  Package,
  Share,
  ChatCircle,
  Star,
  CheckCircle,
  MagnifyingGlassPlus,
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { usePublicProduct, usePublicCategoryProducts } from '@/hooks/use-public-products'
import { ProductCard } from '@/components/commerce/product-card'

interface ProductDetailPageProps {
  onAddToCart: (product: Product, variants: Record<string, string>) => void
}

export function ProductDetailPage({ onAddToCart }: ProductDetailPageProps) {
  const [, params] = useRoute('/product/:slug')
  const { product, isLoading, error } = usePublicProduct({ idOrSlug: params?.slug, view: true })
  const { items: relatedProducts, isLoading: isRelatedLoading } = usePublicCategoryProducts({ categoryId: product?.category.id, limit: 4, view: true })

  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [isFavorite, setIsFavorite] = useState(false)
  const [isZoomOpen, setIsZoomOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">Loading product...</h1>
        <p className="text-muted-foreground">Fetching the latest details.</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Product Not Found</h1>
        <p className="text-muted-foreground mb-4">{error || 'This product is unavailable or may have been moved.'}</p>
        <Button asChild>
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    )
  }

  const images = product.images ?? []
  const variantsList = Array.isArray(product.variants) ? product.variants : []
  const mainImage = images[selectedImage] || images[0]

  const groupedVariants = variantsList.reduce((acc, variant) => {
    if (!acc[variant.type]) {
      acc[variant.type] = []
    }
    acc[variant.type].push(variant)
    return acc
  }, {} as Record<string, typeof variantsList>)

  useEffect(() => {
    if (!product) return
    if (Object.keys(groupedVariants).length === 0) return
    setSelectedVariants((prev) => {
      const next = { ...prev }
      for (const [type, options] of Object.entries(groupedVariants)) {
        if (!next[type] && options.length) next[type] = options[0].value
      }
      return next
    })
  }, [groupedVariants, product])

  const handleVariantChange = (type: string, value: string) => {
    setSelectedVariants((prev) => ({ ...prev, [type]: value }))
  }

  const handleAddToCart = () => {
    onAddToCart(product, selectedVariants)
    toast.success('Added to cart!', {
      description: `${product.name} has been added to your cart.`,
    })
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied!', {
      description: 'Product link copied to clipboard.',
    })
  }

  const handleToggleFavorite = () => {
    setIsFavorite(!isFavorite)
    toast.success(isFavorite ? 'Removed from wishlist' : 'Added to wishlist')
  }

  return (
    <div className="flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-accent/10 via-primary/5 to-cyber-cyan/10 border-b"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Lightning size={16} weight="fill" className="text-accent" />
              <span className="font-medium">Limited Time Offer</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-border" />
            <div className="hidden sm:flex items-center gap-2">
              <Clock size={16} weight="bold" className="text-primary" />
              <span className="text-muted-foreground">Order within 2 hours for same-day delivery</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: 'Categories', href: '/' },
            { label: product.category.name, href: `/category/${product.category.slug}` },
            { label: product.name },
          ]}
        />

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mt-6 mb-12">
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-square rounded-2xl overflow-hidden bg-muted group cursor-pointer"
              onClick={() => setIsZoomOpen(true)}
            >
              {mainImage && (
                <img
                  src={mainImage.url}
                  alt={mainImage.alt || product.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              {product.badges && product.badges.length > 0 && (
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {product.badges.map((badge) => (
                    <Badge
                      key={badge.type}
                      variant={badge.type === 'sale' ? 'destructive' : 'secondary'}
                      className="text-xs font-bold shadow-lg"
                    >
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <MagnifyingGlassPlus size={24} weight="bold" className="text-foreground" />
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-4 gap-3">
              {images.map((image, index) => (
                <motion.button
                  key={image.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedImage(index)}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden bg-muted border-2 transition-all',
                    selectedImage === index
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent hover:border-muted-foreground/50'
                  )}
                >
                  <img
                    src={image.url}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                </motion.button>
              ))}
            </div>

          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold">
                  {product.brand}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="gap-2"
                >
                  <Share size={16} weight="bold" />
                  Share
                </Button>
              </div>
              
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-4 leading-tight">{product.name}</h1>

              <div className="flex items-center gap-4 mb-4">
                <Rating
                  rating={product.rating}
                  count={product.reviewCount}
                  size="md"
                />
                <Separator orientation="vertical" className="h-4" />
                <span className="text-sm text-muted-foreground">
                  {product.inStock ? (
                    <span className="text-success font-medium">In Stock</span>
                  ) : (
                    <span className="text-destructive font-medium">Out of Stock</span>
                  )}
                </span>
              </div>

              <div className="flex items-baseline gap-3">
                <Price
                  price={product.price}
                  compareAtPrice={product.compareAtPrice}
                  currency={product.currency}
                  size="lg"
                />
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <Badge variant="destructive" className="text-xs font-bold">
                    SAVE {Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}%
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Product Description</h3>
              <MarkdownContent markdown={product.description} />
            </div>

            {Object.entries(groupedVariants).map(([type, variants]) => (
              <VariantSelector
                key={type}
                label={type.charAt(0).toUpperCase() + type.slice(1)}
                variants={variants}
                selectedValue={selectedVariants[type]}
                onValueChange={(value) => handleVariantChange(type, value)}
              />
            ))}

            <div>
              <label className="text-sm font-semibold mb-3 block">Quantity</label>
              <QuantityInput
                value={quantity}
                onChange={setQuantity}
                max={product.stockCount || 99}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                {product.stockCount && product.stockCount < 10 && (
                  <span className="text-accent font-medium">Only {product.stockCount} left in stock!</span>
                )}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 gap-2 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all"
                onClick={handleAddToCart}
                disabled={!product.inStock}
              >
                <ShoppingCart size={20} weight="bold" />
                {product.inStock ? 'Add to Cart' : 'Out of Stock'}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleToggleFavorite}
                className={cn(
                  'transition-all',
                  isFavorite && 'bg-accent/10 border-accent text-accent'
                )}
              >
                <Heart size={20} weight={isFavorite ? 'fill' : 'bold'} />
              </Button>
              <Button size="lg" variant="outline">
                <ChatCircle size={20} weight="bold" />
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 pt-4">
              <Card className="p-4 bg-card">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Truck size={18} weight="bold" className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Free Shipping</p>
                    <p className="text-xs text-muted-foreground">
                      On orders over KES 10,000
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-card">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} weight="bold" className="text-success" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Secure Payment</p>
                    <p className="text-xs text-muted-foreground">
                      100% protected checkout
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-card">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <ArrowsCounterClockwise size={18} weight="bold" className="text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">30-Day Returns</p>
                    <p className="text-xs text-muted-foreground">
                      Easy return policy
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-card">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyber-cyan/10 flex items-center justify-center shrink-0">
                    <ShieldStar size={18} weight="bold" className="text-cyber-cyan" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Warranty</p>
                    <p className="text-xs text-muted-foreground">
                      2-year manufacturer warranty
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        <Tabs defaultValue="description" className="mb-20">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="specifications">Specifications</TabsTrigger>
            <TabsTrigger value="shipping">Shipping</TabsTrigger>
          </TabsList>

	          <TabsContent value="description" className="mt-6">
	            <MarkdownContent markdown={product.description} />
	          </TabsContent>

          <TabsContent value="specifications" className="mt-6">
            <div className="grid sm:grid-cols-2 gap-4">
              {Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between py-3 border-b">
                  <span className="font-medium">{key}</span>
                  <span className="text-muted-foreground">{value}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="shipping" className="mt-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Shipping Information</h3>
                <p className="text-muted-foreground">
                  Free standard shipping on orders over $100. Express shipping
                  available at checkout.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Returns & Exchanges</h3>
                <p className="text-muted-foreground">
                  30-day return policy. Items must be unused and in original
                  packaging.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {isRelatedLoading && (
          <div className="text-center text-sm text-muted-foreground mb-10">Loading related products...</div>
        )}
        {!isRelatedLoading && relatedProducts.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-8">You May Also Like</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  product={relatedProduct}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <ImageZoomDialog
        open={isZoomOpen}
        onOpenChange={setIsZoomOpen}
        images={product.images}
        initialIndex={selectedImage}
      />
    </div>
  )
}
