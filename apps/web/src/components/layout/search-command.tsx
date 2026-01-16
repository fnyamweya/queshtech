import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { MagnifyingGlass, Package, Tag, Sparkle } from '@phosphor-icons/react'
import { mockProducts, mockCategories } from '@/data/mock-data'
import { getAlgoliaCatalogPublicConfig, searchAlgoliaCatalogProducts } from '@/lib/algolia-catalog'

interface SearchCommandProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function fuzzyMatch(str: string, pattern: string): number {
  const strLower = str.toLowerCase()
  const patternLower = pattern.toLowerCase()
  
  if (strLower.includes(patternLower)) {
    return 100
  }
  
  let score = 0
  let patternIdx = 0
  let prevIdx = -1
  
  for (let i = 0; i < strLower.length; i++) {
    if (patternIdx < patternLower.length && strLower[i] === patternLower[patternIdx]) {
      score += prevIdx === i - 1 ? 5 : 1
      prevIdx = i
      patternIdx++
    }
  }
  
  if (patternIdx === patternLower.length) {
    score += (score / patternLower.length) * 2
    return score
  }
  
  return 0
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const [, setLocation] = useLocation()
  const [query, setQuery] = useState('')
  const [algoliaEnabled, setAlgoliaEnabled] = useState(false)
  const [minQueryLength, setMinQueryLength] = useState(2)
  const [debounceMs, setDebounceMs] = useState(150)
  const [algoliaProducts, setAlgoliaProducts] = useState<
    Array<{ id: string; slug: string; title: string; brandName?: string; imageUrl?: string }>
  >([])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const cfg = await getAlgoliaCatalogPublicConfig()
        if (!mounted) return
        setAlgoliaEnabled(Boolean(cfg.enabled))
        setMinQueryLength(cfg.minQueryLength ?? 2)
        setDebounceMs(cfg.debounceMs ?? 150)
      } catch {
        if (!mounted) return
        setAlgoliaEnabled(false)
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!algoliaEnabled) return

    const q = query.trim()
    if (!q || q.length < minQueryLength) {
      setAlgoliaProducts([])
      return
    }

    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const resp = await searchAlgoliaCatalogProducts(q, { hitsPerPage: 8 })
          if (cancelled) return
          const items = (resp.hits ?? []).map((h) => ({
            id: h.productId || h.objectID,
            slug: h.slug,
            title: h.title,
            brandName: h.brandName,
            imageUrl: h.imageUrl,
          }))
          setAlgoliaProducts(items)
        } catch {
          if (cancelled) return
          setAlgoliaProducts([])
        }
      })()
    }, debounceMs)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [algoliaEnabled, debounceMs, minQueryLength, query])

  const searchResults = useMemo(() => {
    // If Algolia is enabled, treat categories as quick links for now.
    if (algoliaEnabled) {
      const qlen = query.trim().length
      return {
        products: algoliaProducts,
        categories: qlen >= minQueryLength ? [] : mockCategories.slice(0, 4),
      }
    }

    if (!query || query.length < 2) {
      return {
        products: mockProducts.slice(0, 5),
        categories: mockCategories.slice(0, 4),
      }
    }

    const productMatches = mockProducts
      .map((product) => ({
        product,
        score: Math.max(
          fuzzyMatch(product.name, query),
          fuzzyMatch(product.brand, query),
          fuzzyMatch(product.description, query),
          ...(product.tags?.map((tag) => fuzzyMatch(tag, query)) || [0]),
        ),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ product }) => product)

    const categoryMatches = mockCategories
      .map((category) => ({
        category,
        score: Math.max(fuzzyMatch(category.name, query), fuzzyMatch(category.description || '', query)),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ category }) => category)

    return {
      products: productMatches,
      categories: categoryMatches,
    }
  }, [algoliaEnabled, algoliaProducts, minQueryLength, query])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !open)) {
        e.preventDefault()
        onOpenChange(true)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  const handleSelect = (callback: () => void) => {
    onOpenChange(false)
    setQuery('')
    callback()
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search products, categories, brands..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6">
            <MagnifyingGlass className="text-muted-foreground" size={48} weight="thin" />
            <p className="text-sm text-muted-foreground">
              No results found for "{query}"
            </p>
            <p className="text-xs text-muted-foreground">
              Try different keywords or browse categories
            </p>
          </div>
        </CommandEmpty>

        {searchResults.categories.length > 0 && (
          <>
            <CommandGroup heading="Categories">
              {searchResults.categories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={`category-${category.name}`}
                  onSelect={() => handleSelect(() => setLocation(`/category/${category.slug}`))}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <Tag className="text-primary" size={18} />
                  <div className="flex flex-col">
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {category.productCount} products
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {searchResults.products.length > 0 && (
          <CommandGroup heading="Products">
            {searchResults.products.map((product: any) => (
              <CommandItem
                key={product.id}
                value={`product-${algoliaEnabled ? product.title : product.name}`}
                onSelect={() => handleSelect(() => setLocation(`/product/${product.slug}`))}
                className="flex items-start gap-3 px-3 py-2.5"
              >
                <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={algoliaEnabled ? product.imageUrl : product.images[0]?.url}
                    alt={algoliaEnabled ? product.title : product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{algoliaEnabled ? product.title : product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {algoliaEnabled ? product.brandName || '—' : product.brand}
                      </p>
                    </div>
                    {!algoliaEnabled ? (
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-sm text-primary">{formatPrice(product.price)}</p>
                        {product.compareAtPrice && (
                          <p className="text-xs text-muted-foreground line-through">{formatPrice(product.compareAtPrice)}</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!query && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              <CommandItem
                onSelect={() => handleSelect(() => setLocation('/category/smartphones-tablets'))}
                className="flex items-center gap-3"
              >
                <Sparkle className="text-accent" size={18} />
                <span>View New Arrivals</span>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSelect(() => setLocation('/category/gaming'))}
                className="flex items-center gap-3"
              >
                <Package className="text-accent" size={18} />
                <span>Gaming Deals</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>

      <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              ↵
            </kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              esc
            </kbd>
            close
          </span>
        </div>
        <span className="hidden sm:inline">
          Press{' '}
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
            ⌘K
          </kbd>{' '}
          or{' '}
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
            /
          </kbd>{' '}
          to search
        </span>
      </div>
    </CommandDialog>
  )
}
