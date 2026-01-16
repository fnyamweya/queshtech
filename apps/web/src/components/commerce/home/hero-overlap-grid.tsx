import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Category, Product } from '@/types'

function GridCard({
  title,
  footerLabel,
  footerHref,
  children,
}: {
  title: string
  footerLabel: string
  footerHref: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-background shadow-lg shadow-black/5">
      <div className="p-5">
        <div className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </div>
        <div className="mt-4">{children}</div>
      </div>
      <div className="px-5 pb-5">
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
      <div className="mt-2 text-xs text-foreground/90 leading-snug line-clamp-2">{label}</div>
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <GridCard title="Shop by category" footerLabel="Explore all categories" footerHref="/category/all">
        {isCategoriesLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="space-y-2">
                <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : categoryTiles.length === 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="space-y-2">
                <div className="aspect-[4/3] w-full rounded-lg border border-border bg-muted/30" />
                <div className="h-3 w-24 rounded bg-muted/30" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {categoryTiles.map((c) => (
              <Tile
                key={c.id}
                href={`/category/${c.slug}`}
                image={c.imageUrl || c.avatarUrl || c.image || null}
                label={c.name}
              />
            ))}
          </div>
        )}
      </GridCard>

      <GridCard title="Trending picks" footerLabel="Shop trending" footerHref="/category/all">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="space-y-2">
                <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        ) : trendingTiles.length === 0 ? (
          <div className="text-sm text-muted-foreground">No trending products yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {trendingTiles.map((p) => (
              <Tile key={p.id} href={`/product/${p.slug}`} image={productImage(p)} label={p.name} />
            ))}
          </div>
        )}
      </GridCard>

      <GridCard title="Deals & markdowns" footerLabel="Shop deals" footerHref="/category/all">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="space-y-2">
                <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : dealsTiles.length === 0 ? (
          <div className="text-sm text-muted-foreground">No deals available yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {dealsTiles.map((p) => (
              <Tile key={p.id} href={`/product/${p.slug}`} image={productImage(p)} label={p.name} />
            ))}
          </div>
        )}
      </GridCard>

      <GridCard title="New arrivals" footerLabel="Shop new arrivals" footerHref="/category/all">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="space-y-2">
                <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : newTiles.length === 0 ? (
          <div className="text-sm text-muted-foreground">No new arrivals yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {newTiles.map((p) => (
              <Tile key={p.id} href={`/product/${p.slug}`} image={productImage(p)} label={p.name} />
            ))}
          </div>
        )}
      </GridCard>
    </div>
  )
}
