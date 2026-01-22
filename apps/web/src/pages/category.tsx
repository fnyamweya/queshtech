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
import { ListingBanner } from '@/components/commerce/listing-banner'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Product, SortOption } from '@/types'
import { Funnel } from '@phosphor-icons/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { usePublicCategories } from '@/hooks/use-catalog-categories'
import { usePublicCategoryProducts, usePublicProducts } from '@/hooks/use-public-products'
import { resolvePhosphorIcon } from '@/lib/phosphor'

interface CategoryPageProps {
  onAddToCart: (product: Product, variants?: Record<string, string>, quantity?: number, skuId?: string) => void
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

  const isLoading = isCategoryLoading || isAllLoading

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
    <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-6 sm:py-8">
      <Breadcrumbs
        items={[
          { label: 'Categories', href: '/' },
          { label: category?.name || 'All Products' },
        ]}
      />
      
      <ListingBanner
        className="mt-3"
        eyebrow={category ? 'Category' : 'Catalog'}
        title={category?.name || 'All Products'}
        description={category?.description || 'Browse the latest additions, best deals, and top-rated picks.'}
        imageUrl={category?.imageUrl || category?.avatarUrl || category?.image || null}
        icon={
          category ? (
            <Avatar className="h-10 w-10">
              {category.avatarUrl || category.imageUrl ? (
                <AvatarImage src={category.avatarUrl || category.imageUrl} alt={category.name} />
              ) : null}
              <AvatarFallback>
                {(() => {
                  const Icon = resolvePhosphorIcon(category.icon)
                  return Icon ? <Icon size={16} weight="bold" /> : category.name.charAt(0)
                })()}
              </AvatarFallback>
            </Avatar>
          ) : null
        }
        actions={
          <>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[190px]">
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
          </>
        }
        footer={
          <>
            <p className="text-sm text-muted-foreground">{sortedProducts.length} products</p>
            {Object.keys(selectedFilters).length ? (
              <Button variant="ghost" className="h-9" onClick={handleClearFilters}>
                Clear filters
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mt-6 grid lg:grid-cols-4 gap-6">
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
          {isLoading ? null : sortedProducts.length === 0 ? (
            <div className="text-center py-20">
              <h3 className="text-xl font-semibold mb-2">No products found</h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your filters
              </p>
              <Button onClick={handleClearFilters}>Clear Filters</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
