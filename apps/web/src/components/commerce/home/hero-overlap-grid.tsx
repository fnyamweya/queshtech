import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Category, Product } from '@/types'

function GridCard({
  title,
  footerLabel,
  footerHref,
  children,
  className,
}: {
  title: string
  footerLabel: string
  footerHref: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(
      'rounded-xl border border-border bg-background shadow-lg shadow-black/5',
      'w-[290px] sm:w-auto flex-shrink-0 snap-start',
      className
    )}>
      <div className="p-3 sm:p-5">
        <div className="text-base sm:text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </div>
        <div className="mt-3 sm:mt-4">{children}</div>
      </div>
      <div className="hidden sm:block px-4 sm:px-5 pb-4 sm:pb-5">
        <Button asChild variant="link" className="h-auto p-0 text-primary">
          <Link href={footerHref}>{footerLabel}</Link>
        </Button>
      </div>
    </div>
  )
}

function Tile({
  href,
  image,
  label,
}: {
  href: string
  image?: string | null
  label: string
}) {
  return (
    <Link href={href} className="group">
      <div className="overflow-hidden rounded-lg bg-muted/30 border border-border">
        {image ? (
          <img
            src={image}
            alt={label}
            className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="aspect-[4/3] w-full bg-muted" />
        )}
      </div>
      <div className="mt-2 text-xs text-foreground/90 leading-snug line-clamp-1 sm:line-clamp-2">{label}</div>
    </Link>
  )
}

function CompactTile({
  href,
  image,
  label,
}: {
  href: string
  image?: string | null
  label: string
}) {
  return (
    <Link href={href} className="group w-[92px] shrink-0 snap-start">
      <div className="overflow-hidden rounded-lg bg-muted/30 border border-border">
        {image ? (
          <img
            src={image}
            alt={label}
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="aspect-square w-full bg-muted" />
        )}
      </div>
      <div className="mt-1 text-[11px] text-foreground/90 leading-snug line-clamp-1">{label}</div>
    </Link>
  )
}

function productImage(product: Product): string | null {
  return product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url || null
}

export function HeroOverlapGrid({
  categories,
  trending,
  deals,
  newArrivals,
  isLoading,
  isCategoriesLoading,
}: {
  categories: Category[]
  trending: Product[]
  deals: Product[]
  newArrivals: Product[]
  isLoading: boolean
  isCategoriesLoading: boolean
}) {
  const categoryTiles = categories.slice(0, 4)
  const trendingTiles = trending.slice(0, 4)
  const dealsTiles = deals.slice(0, 4)
  const newTiles = newArrivals.slice(0, 4)


  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 sm:grid sm:overflow-visible sm:snap-none sm:grid-cols-2 lg:grid-cols-4">
      <GridCard title="Shop by category" footerLabel="Explore all categories" footerHref="/category/all">
        {isCategoriesLoading ? null : categoryTiles.length === 0 ? (
          <>
            <div className="sm:hidden flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1 pb-1">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="w-[92px] shrink-0 snap-start space-y-2">
                  <div className="aspect-square w-full rounded-lg border border-border bg-muted/30" />
                  <div className="h-3 w-20 rounded bg-muted/30" />
                </div>
              ))}
            </div>
            <div className="hidden sm:grid grid-cols-2 gap-2 sm:gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="aspect-[4/3] w-full rounded-lg border border-border bg-muted/30" />
                  <div className="h-3 w-24 rounded bg-muted/30" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="sm:hidden flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1 pb-1">
              {categoryTiles.map((c) => (
                <CompactTile
                  key={c.id}
                  href={`/category/${c.slug}`}
                  image={c.imageUrl || c.avatarUrl || c.image || null}
                  label={c.name}
                />
              ))}
            </div>
            <div className="hidden sm:grid grid-cols-2 gap-2 sm:gap-3">
              {categoryTiles.map((c) => (
                <Tile
                  key={c.id}
                  href={`/category/${c.slug}`}
                  image={c.imageUrl || c.avatarUrl || c.image || null}
                  label={c.name}
                />
              ))}
            </div>
          </>
        )}
      </GridCard>

      <GridCard title="Trending picks" footerLabel="Shop trending" footerHref="/category/all">
        {isLoading ? null : trendingTiles.length === 0 ? (
          <div className="text-sm text-muted-foreground">No trending products yet.</div>
        ) : (
          <>
            <div className="sm:hidden flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1 pb-1">
              {trendingTiles.map((p) => (
                <CompactTile key={p.id} href={`/product/${p.slug}`} image={productImage(p)} label={p.name} />
              ))}
            </div>
            <div className="hidden sm:grid grid-cols-2 gap-2 sm:gap-3">
              {trendingTiles.map((p) => (
                <Tile key={p.id} href={`/product/${p.slug}`} image={productImage(p)} label={p.name} />
              ))}
            </div>
          </>
        )}
      </GridCard>

      <GridCard title="Deals & markdowns" footerLabel="Shop deals" footerHref="/category/all">
        {isLoading ? null : dealsTiles.length === 0 ? (
          <div className="text-sm text-muted-foreground">No deals available yet.</div>
        ) : (
          <>
            <div className="sm:hidden flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1 pb-1">
              {dealsTiles.map((p) => (
                <CompactTile key={p.id} href={`/product/${p.slug}`} image={productImage(p)} label={p.name} />
              ))}
            </div>
            <div className="hidden sm:grid grid-cols-2 gap-2 sm:gap-3">
              {dealsTiles.map((p) => (
                <Tile key={p.id} href={`/product/${p.slug}`} image={productImage(p)} label={p.name} />
              ))}
            </div>
          </>
        )}
      </GridCard>

      <GridCard title="New arrivals" footerLabel="Shop new arrivals" footerHref="/category/all">
        {isLoading ? null : newTiles.length === 0 ? (
          <div className="text-sm text-muted-foreground">No new arrivals yet.</div>
        ) : (
          <>
            <div className="sm:hidden flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1 pb-1">
              {newTiles.map((p) => (
                <CompactTile key={p.id} href={`/product/${p.slug}`} image={productImage(p)} label={p.name} />
              ))}
            </div>
            <div className="hidden sm:grid grid-cols-2 gap-2 sm:gap-3">
              {newTiles.map((p) => (
                <Tile key={p.id} href={`/product/${p.slug}`} image={productImage(p)} label={p.name} />
              ))}
            </div>
          </>
        )}
      </GridCard>
    </div>
  )
}
