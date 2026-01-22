import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'wouter'
import { MagnifyingGlass, X, TrendUp, Tag } from '@phosphor-icons/react'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ProductCard } from '@/components/commerce/product-card'
import { ListingBanner } from '@/components/commerce/listing-banner'
import { usePublicSearchProducts } from '@/hooks/use-public-products'
import { usePublicCategories } from '@/hooks/use-catalog-categories'
import type { Product, SortOption } from '@/types'
import { addRecentSearch, clearRecentSearches, loadRecentSearches } from '@/lib/recent-searches'

interface SearchPageProps {
  onAddToCart: (product: Product, variants?: Record<string, string>, quantity?: number, skuId?: string) => void
}

export function SearchPage({ onAddToCart }: SearchPageProps) {
  const container = 'container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px]'
  const [searchParams, setSearchParams] = useSearchParams()
  const qParam = (searchParams.get('q') || '').trim()
  const highlightTerms = useMemo(() => (qParam ? qParam.split(/\s+/g).filter(Boolean) : []), [qParam])

  const [inputValue, setInputValue] = useState(qParam)
  const [sortBy, setSortBy] = useState<SortOption>('relevance')
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all')
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const { items, total, q, setQ, limit, setLimit, isLoading, error, setPage, refresh } = usePublicSearchProducts({
    limit: 24,
    q: qParam,
  })


  const { categories } = usePublicCategories({ limit: 50, isActive: true })

  useEffect(() => {
    setRecentSearches(loadRecentSearches())
  }, [])

  useEffect(() => {
    setInputValue(qParam)
    setSelectedCategorySlug('all')
    setSortBy('relevance')
  }, [qParam])

  useEffect(() => {
    if (qParam === q) return
    setPage(1)
    setQ(qParam)
  }, [qParam, q, setPage, setQ])

  useEffect(() => {
    const t = window.setTimeout(() => {
      const nextQ = inputValue.trim()
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (nextQ) next.set('q', nextQ)
          else next.delete('q')
          return next
        },
        { replace: true }
      )
    }, 250)

    return () => window.clearTimeout(t)
  }, [inputValue, setSearchParams])

  useEffect(() => {
    if (!qParam || qParam.length < 2) return
    setRecentSearches(addRecentSearch(qParam, { max: 10 }))
  }, [qParam])

  const matchingCategories = useMemo(() => {
    if (!qParam) return categories.slice(0, 10)
    const term = qParam.toLowerCase()
    return categories
      .filter((c) => c.name.toLowerCase().includes(term) || (c.description || '').toLowerCase().includes(term))
      .slice(0, 10)
  }, [categories, qParam])

  const filteredProducts = useMemo(() => {
    const base = items || []
    if (selectedCategorySlug === 'all') return base
    return base.filter((p) => p.category?.slug === selectedCategorySlug)
  }, [items, selectedCategorySlug])

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts]
    switch (sortBy) {
      case 'price-asc':
        return list.sort((a, b) => a.price - b.price)
      case 'price-desc':
        return list.sort((a, b) => b.price - a.price)
      case 'rating':
        return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      case 'newest':
        return list.sort((a, b) => (b.stockCount ?? 0) - (a.stockCount ?? 0))
      default:
        return list
    }
  }, [filteredProducts, sortBy])

  const resultsCountLabel = useMemo(() => {
    const count = typeof total === 'number' ? total : items.length
    if (!qParam) return `${count} products`
    return `${count} results`
  }, [items.length, qParam, total])

  const showLoadMore = typeof total === 'number' ? items.length < total : items.length > 0 && items.length === limit

  return (
    <div className={container + ' py-6 sm:py-8'}>
      <Breadcrumbs items={[{ label: 'Search' }, ...(qParam ? [{ label: qParam }] : [])]} />

      <ListingBanner
        className="mt-2"
        eyebrow={qParam ? 'Search results' : 'Search'}
        title={qParam ? `Results for “${qParam}”` : 'Search'}
        description="Find products fast with instant results, categories, and smart sorting."
        actions={
          <Badge variant="secondary" className="px-2 py-1">
            <TrendUp size={12} weight="bold" className="mr-1" />
            Tip: try “gaming laptop”
          </Badge>
        }
        footer={
          <>
            <p className="text-sm text-muted-foreground">{resultsCountLabel}</p>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort:</span>
              {(
                [
                  { id: 'relevance', label: 'Relevance' },
                  { id: 'price-asc', label: 'Price ↑' },
                  { id: 'price-desc', label: 'Price ↓' },
                  { id: 'rating', label: 'Rating' },
                  { id: 'newest', label: 'Newest' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={
                    sortBy === opt.id
                      ? 'inline-flex items-center rounded-md bg-accent text-accent-foreground px-3 py-1 text-xs cursor-pointer active:translate-y-px active:scale-[0.99]'
                      : 'inline-flex items-center rounded-md border border-border bg-background px-3 py-1 text-xs cursor-pointer hover:bg-muted transition-colors active:translate-y-px active:scale-[0.99]'
                  }
                  onClick={() => setSortBy(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        }
      >
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search products, brands, categories…"
              className="h-11 rounded-md pl-10 pr-11 bg-background"
              aria-label="Search query"
            />
            {inputValue.trim() ? (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors active:translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => setInputValue('')}
                aria-label="Clear search"
              >
                <X size={16} weight="bold" />
              </button>
            ) : null}
          </div>
          <Button
            variant="outline"
            className="h-11 rounded-md"
            onClick={() => {
              setInputValue('')
              setSelectedCategorySlug('all')
              setSortBy('relevance')
            }}
          >
            Reset
          </Button>
        </div>

        {recentSearches.length > 0 && !qParam ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Recent:</span>
            {recentSearches.slice(0, 6).map((term) => (
              <button
                key={term}
                type="button"
                className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1 text-xs cursor-pointer hover:bg-muted transition-colors active:translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => setInputValue(term)}
              >
                {term}
              </button>
            ))}
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 ml-1 cursor-pointer"
              onClick={() => {
                clearRecentSearches()
                setRecentSearches([])
              }}
            >
              Clear
            </button>
          </div>
        ) : null}

        {matchingCategories.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Categories:</span>
            <button
              type="button"
              className={
                selectedCategorySlug === 'all'
                  ? 'inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-1 text-xs cursor-pointer active:translate-y-px active:scale-[0.99]'
                  : 'inline-flex items-center rounded-md border border-border bg-background px-3 py-1 text-xs cursor-pointer hover:bg-muted transition-colors active:translate-y-px active:scale-[0.99]'
              }
              onClick={() => setSelectedCategorySlug('all')}
            >
              All
            </button>
            {matchingCategories.map((c) => (
              <button
                key={c.slug}
                type="button"
                className={
                  selectedCategorySlug === c.slug
                    ? 'inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-1 text-xs cursor-pointer active:translate-y-px active:scale-[0.99]'
                    : 'inline-flex items-center rounded-md border border-border bg-background px-3 py-1 text-xs cursor-pointer hover:bg-muted transition-colors active:translate-y-px active:scale-[0.99]'
                }
                onClick={() => setSelectedCategorySlug(c.slug)}
              >
                <Tag size={12} weight="bold" className="mr-1" />
                {c.name}
              </button>
            ))}
          </div>
        ) : null}
      </ListingBanner>

      <div className="mt-8">
        {isLoading ? null : error ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <h2 className="text-lg font-semibold">Search unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => refresh()}>
                Retry
              </Button>
              <Button asChild>
                <Link href="/">Go home</Link>
              </Button>
            </div>
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <h2 className="text-lg font-semibold">No results found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {qParam ? 'Try a different keyword or browse categories.' : 'Start typing to search the catalog.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Button variant="outline" asChild>
                <Link href="/category/all">Browse all products</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {sortedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={onAddToCart}
                  behavior={{
                    discovery: { highlightTerms },
                    price: { showSavings: 'percent' },
                    badges: { max: 2 },
                  }}
                />
              ))}
            </div>

            {showLoadMore ? (
              <div className="mt-10 flex justify-center">
                <Button variant="outline" className="rounded-md" onClick={() => setLimit(limit + 24)}>
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
