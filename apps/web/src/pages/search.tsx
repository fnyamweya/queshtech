import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'wouter'
import { MagnifyingGlass, X, TrendUp, Tag } from '@phosphor-icons/react'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ProductCard } from '@/components/commerce/product-card'
import { usePublicProducts } from '@/hooks/use-public-products'
import { usePublicCategories } from '@/hooks/use-catalog-categories'
import type { Product, SortOption } from '@/types'
import { addRecentSearch, clearRecentSearches, loadRecentSearches } from '@/lib/recent-searches'

interface SearchPageProps {
  onAddToCart: (product: Product, variants?: Record<string, string>) => void
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

  const { items, total, q, setQ, limit, setLimit, isLoading, error, setPage, refresh } = usePublicProducts({
    view: true,
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

      <div className="mt-2 rounded-2xl border border-border/60 bg-background/70 backdrop-blur-xl p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Search</h1>
            <p className="text-sm text-muted-foreground">Find products fast with instant results, categories, and smart sorting.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="rounded-full">
              <TrendUp size={12} weight="bold" className="mr-1" />
              Tip: try “gaming laptop”
            </Badge>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search products, brands, categories…"
              className="h-11 rounded-full pl-10 pr-11 bg-background"
              aria-label="Search query"
            />
            {inputValue.trim() ? (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => setInputValue('')}
                aria-label="Clear search"
              >
                <X size={16} weight="bold" />
              </button>
            ) : null}
          </div>
          <Button
            variant="outline"
            className="h-11 rounded-full"
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
                className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent transition-colors"
                onClick={() => setInputValue(term)}
              >
                {term}
              </button>
            ))}
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 ml-1"
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
                  ? 'inline-flex items-center rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs'
                  : 'inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent transition-colors'
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
                    ? 'inline-flex items-center rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs'
                    : 'inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent transition-colors'
                }
                onClick={() => setSelectedCategorySlug(c.slug)}
              >
                <Tag size={12} weight="bold" className="mr-1" />
                {c.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                    ? 'inline-flex items-center rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs'
                    : 'inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent transition-colors'
                }
                onClick={() => setSortBy(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Searching…</p>
          </div>
        ) : error ? (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                <Button variant="outline" className="rounded-full" onClick={() => setLimit(limit + 24)}>
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
