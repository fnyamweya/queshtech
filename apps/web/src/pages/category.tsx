import { useState } from 'react'
import { useRoute } from 'wouter'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ProductCard } from '@/components/commerce/product-card'
import { FilterSidebar } from '@/components/commerce/filter-sidebar'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Product, SortOption } from '@/types'
import { Funnel } from '@phosphor-icons/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { usePublicCategories } from '@/hooks/use-catalog-categories'
import { usePublicCategoryProducts, usePublicProducts } from '@/hooks/use-public-products'
import { resolvePhosphorIcon } from '@/lib/phosphor'

interface CategoryPageProps {
  onAddToCart: (product: Product, variants?: Record<string, string>) => void
}

const filterGroups = [
  {
    id: 'brand',
    label: 'Brand',
    options: [
      { id: 'audiotech', label: 'AudioTech', count: 12 },
      { id: 'urbancraft', label: 'UrbanCraft', count: 8 },
      { id: 'smartliving', label: 'SmartLiving', count: 15 },
      { id: 'ecowear', label: 'EcoWear', count: 6 },
    ],
  },
  {
    id: 'rating',
    label: 'Rating',
    options: [
      { id: '4+', label: '4+ Stars', count: 45 },
      { id: '3+', label: '3+ Stars', count: 78 },
    ],
  },
]

export function CategoryPage({ onAddToCart }: CategoryPageProps) {
  const [, params] = useRoute('/category/:slug')
  const { bySlug } = usePublicCategories({ isActive: true })
  const category = (params?.slug ? bySlug.get(params.slug) : undefined)

  const { items: categoryProducts, isLoading: isCategoryLoading } = usePublicCategoryProducts({
    categoryId: category?.id || null,
    view: true,
    limit: 60,
  })

  const { items: allProducts, isLoading: isAllLoading } = usePublicProducts({ view: true, limit: 60 })

  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({})
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000])
  const [sortBy, setSortBy] = useState<SortOption>('relevance')
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const sourceProducts = category ? categoryProducts : allProducts

  const filteredProducts = sourceProducts.filter((product) => {
    if (category && product.category.slug !== category.slug) return false
    if (product.price < priceRange[0] || product.price > priceRange[1]) return false
    return true
  })

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-asc':
        return a.price - b.price
      case 'price-desc':
        return b.price - a.price
      case 'rating':
        return (b.rating ?? 0) - (a.rating ?? 0)
      case 'newest':
        return (b.stockCount ?? 0) - (a.stockCount ?? 0)
      default:
        return 0
    }
  })

  const handleFilterChange = (groupId: string, optionId: string, checked: boolean) => {
    setSelectedFilters((prev) => {
      const current = prev[groupId] || []
      if (checked) {
        return { ...prev, [groupId]: [...current, optionId] }
      } else {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) }
      }
    })
  }

  const handleClearFilters = () => {
    setSelectedFilters({})
    setPriceRange([0, 1000])
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs
        items={[
          { label: 'Categories', href: '/' },
          { label: category?.name || 'All Products' },
        ]}
      />
      
      <div className="mb-8 mt-4">
        <div className="flex items-center gap-4 mb-2">
          {category ? (
            <Avatar className="h-12 w-12">
              {category.avatarUrl || category.imageUrl ? (
                <AvatarImage src={category.avatarUrl || category.imageUrl} alt={category.name} />
              ) : null}
              <AvatarFallback>
                {(() => {
                  const Icon = resolvePhosphorIcon(category.icon)
                  return Icon ? <Icon size={18} weight="bold" /> : category.name.charAt(0)
                })()}
              </AvatarFallback>
            </Avatar>
          ) : null}
          <h1 className="text-3xl sm:text-4xl font-bold">
            {category?.name || 'All Products'}
          </h1>
        </div>
        {category?.description && (
          <p className="text-muted-foreground text-lg">{category.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          {sortedProducts.length} products
        </p>

        <div className="flex items-center gap-3">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Most Relevant</SelectItem>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>

          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="default" className="lg:hidden">
                <Funnel size={18} weight="bold" className="mr-2" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterSidebar
                  filters={filterGroups}
                  selectedFilters={selectedFilters}
                  onFilterChange={handleFilterChange}
                  priceRange={priceRange}
                  onPriceChange={setPriceRange}
                  onClearAll={handleClearFilters}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <FilterSidebar
              filters={filterGroups}
              selectedFilters={selectedFilters}
              onFilterChange={handleFilterChange}
              priceRange={priceRange}
              onPriceChange={setPriceRange}
              onClearAll={handleClearFilters}
            />
          </div>
        </aside>

        <div className="lg:col-span-3">
          {(isCategoryLoading || isAllLoading) ? (
            <div className="text-center py-20">
              <h3 className="text-xl font-semibold mb-2">Loading products...</h3>
              <p className="text-muted-foreground">Please wait while we fetch inventory.</p>
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="text-center py-20">
              <h3 className="text-xl font-semibold mb-2">No products found</h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your filters
              </p>
              <Button onClick={handleClearFilters}>Clear Filters</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
