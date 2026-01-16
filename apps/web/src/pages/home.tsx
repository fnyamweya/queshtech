import { Link } from 'wouter'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProductCard } from '@/components/commerce/product-card'
import { FuturisticHero, type FuturisticHeroSlide } from '@/components/commerce/home/futuristic-hero'
import { HorizontalScroll } from '@/components/commerce/horizontal-scroll'
import { Product } from '@/types'
import { usePublicCollections } from '@/hooks/use-catalog-collections'
import { usePublicBanners } from '@/hooks/use-banners'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { resolvePhosphorIcon } from '@/lib/phosphor'
import { usePublicCategories } from '@/hooks/use-catalog-categories'
import { CategoryCard } from '@/components/commerce/category-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { BannerCard } from '@/components/commerce/home/banner-card'
import { HeroOverlapGrid } from '@/components/commerce/home/hero-overlap-grid'
import { SectionHeading } from '@/components/commerce/home/section-heading'
import { NewsletterCard } from '@/components/commerce/home/newsletter-card'
import {
  Truck,
  ShieldCheck,
  ArrowsCounterClockwise,
  Headset,
  Fire,
  ArrowRight,
  Percent,
} from '@phosphor-icons/react'

interface HomePageProps {
  onAddToCart: (product: Product) => void
}

export function HomePage({ onAddToCart }: HomePageProps) {
  const container = 'container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px]'

  const { landingCollections, isLoading: isCollectionsLoading } = usePublicCollections({ limit: 12 })
  const { heroBanners, featureBanners, isLoading: isBannersLoading } = usePublicBanners()
  const { categories, isLoading: isCategoriesLoading } = usePublicCategories({ limit: 8, isActive: true })

  const heroSlides: FuturisticHeroSlide[] = heroBanners
    .filter((banner) => banner.creative?.imageKey || banner.imageUrl)
    .map((banner, idx) => {
      const image = banner.creative?.imageKey || banner.imageUrl || ''
      const ctaLabel = banner.creative?.cta?.label || banner.ctaLabel || 'Shop now'
      const ctaHref = banner.creative?.cta?.url || banner.href || '/'

      return {
        id: banner.id || `hero-${idx}`,
        title: banner.title || 'Tech that feels like the future.',
        subtitle: banner.subtitle || banner.landingSection || 'Curated picks',
        description: banner.description || 'Explore the latest drops and campaigns.',
        image,
        cta: { label: ctaLabel, href: ctaHref },
        secondaryCta: banner.href ? { label: 'View details', href: banner.href } : undefined,
        badge: banner.subtitle || banner.landingSection || 'Featured',
      }
    })

  const featuredProducts = useMemo(() => {
    const seen = new Set<string>()
    const list: Product[] = []
    for (const c of landingCollections) {
      for (const p of c.products || []) {
        if (!p?.id || seen.has(p.id)) continue
        seen.add(p.id)
        list.push(p)
      }
    }
    return list
  }, [landingCollections])

  const productTabs = useMemo(() => {
    const deals = featuredProducts
      .filter((p) => (p.compareAtPrice || 0) > p.price || p.badges?.some((b) => b.type === 'sale'))
      .slice(0, 12)

    const newArrivals = featuredProducts
      .filter((p) => p.badges?.some((b) => b.type === 'new') || p.tags?.some((t) => t.toLowerCase().includes('new')))
      .slice(0, 12)

    const trending = [...featuredProducts]
      .sort((a, b) => {
        const aScore = (a.rating || 0) * Math.log10(1 + (a.reviewCount || 0))
        const bScore = (b.rating || 0) * Math.log10(1 + (b.reviewCount || 0))
        return bScore - aScore
      })
      .slice(0, 12)

    const safe = (arr: Product[]) => (arr.length > 0 ? arr : featuredProducts.slice(0, 12))

    return {
      trending: safe(trending),
      deals: safe(deals),
      newArrivals: safe(newArrivals),
    }
  }, [featuredProducts])

  const bannersByLanding = useMemo(() => {
    const map = new Map<string, typeof featureBanners>()
    for (const banner of featureBanners) {
      const key = banner.landingSection || ''
      if (!key) continue
      const existing = map.get(key) || []
      map.set(key, [...existing, banner])
    }
    return map
  }, [featureBanners])

  const orphanBanners = useMemo(() => featureBanners.filter((b) => !b.landingSection), [featureBanners])
  const highlightBanners = useMemo(() => orphanBanners.slice(0, 3), [orphanBanners])

  return (
    <div className="flex flex-col">
      <section className="relative w-full">
        <FuturisticHero slides={heroSlides.length > 0 ? heroSlides : undefined} />

        <div className={container + ' relative -mt-24 sm:-mt-28 lg:-mt-32 pb-8'}>
          <HeroOverlapGrid
            categories={categories}
            isCategoriesLoading={isCategoriesLoading}
            trending={productTabs.trending}
            deals={productTabs.deals}
            newArrivals={productTabs.newArrivals}
            isLoading={isCollectionsLoading}
          />
        </div>
        {isBannersLoading ? (
          <div className="sr-only" aria-live="polite">
            Loading hero…
          </div>
        ) : null}
      </section>

      <section className="border-y border-[color:var(--color-border)] bg-[color:var(--color-muted)] py-8">
        <div className={container}>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Truck size={16} weight="bold" className="text-primary" />,
                label: 'Fast delivery',
                sub: 'Same-day Nairobi • Nationwide shipping',
                bg: 'bg-primary/10',
              },
              {
                icon: <ShieldCheck size={16} weight="bold" className="text-success" />,
                label: 'Secure payments',
                sub: 'M-Pesa, cards & wallets',
                bg: 'bg-success/10',
              },
              {
                icon: <ArrowsCounterClockwise size={16} weight="bold" className="text-accent" />,
                label: 'Easy returns',
                sub: '30-day return window',
                bg: 'bg-accent/10',
              },
              {
                icon: <Headset size={16} weight="bold" className="text-cyber-cyan" />,
                label: 'Real support',
                sub: 'Chat, call or WhatsApp',
                bg: 'bg-cyber-cyan/10',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${item.bg}`}>{item.icon}</div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={container + ' py-10 sm:py-14'}>
        <SectionHeading
          eyebrow="Shop by"
          title="Categories"
          description="Browse popular categories with fast filters and clear product comparisons."
          action={{ label: 'Explore all', href: '/category/all' }}
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isCategoriesLoading ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-border overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full" />
              </div>
            ))
          ) : categories.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              No categories available yet.
            </div>
          ) : (
            categories.slice(0, 8).map((category) => <CategoryCard key={category.id} category={category} />)
          )}
        </div>
      </section>

      {highlightBanners.length > 0 ? (
        <section className={container + ' py-10 sm:py-14'}>
          <SectionHeading
            eyebrow="Don’t miss"
            title="Featured offers"
            description="Limited-time campaigns and seasonal launches—updated regularly."
            action={{ label: 'Shop deals', href: '/category/all' }}
          />
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {highlightBanners.map((banner) => (
              <BannerCard key={banner.id} banner={banner} />
            ))}
          </div>
        </section>
      ) : null}

      <section className={container + ' py-10 sm:py-14'}>
        <SectionHeading
          eyebrow="Discover"
          title="Top picks for you"
          description="Quickly jump into trending products, the best deals, and what’s new."
          action={{ label: 'Browse products', href: '/category/all' }}
        />

        <div className="mt-6">
          <Tabs defaultValue="trending">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trending">Trending</TabsTrigger>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="newArrivals">New</TabsTrigger>
            </TabsList>

            {(
              [
                { key: 'trending', title: 'Trending', items: productTabs.trending },
                { key: 'deals', title: 'Deals', items: productTabs.deals },
                { key: 'newArrivals', title: 'New', items: productTabs.newArrivals },
              ] as const
            ).map((tab) => (
              <TabsContent key={tab.key} value={tab.key} className="mt-6">
                {isCollectionsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="rounded-xl border border-border overflow-hidden">
                        <Skeleton className="aspect-square w-full" />
                        <div className="p-3 space-y-2">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : tab.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
                    No products to show yet.
                  </div>
                ) : (
                  <>
                    <HorizontalScroll className="[&>*]:w-[190px] [&>*]:sm:w-[220px]">
                      {tab.items.map((product) => (
                        <ProductCard key={product.id} product={product} variant="compact" onAddToCart={onAddToCart} />
                      ))}
                    </HorizontalScroll>
                    <div className="mt-8 flex justify-center sm:hidden">
                      <Button asChild variant="outline" className="w-full">
                        <Link href="/category/all">
                          Browse all
                          <ArrowRight size={14} weight="bold" className="ml-2" />
                        </Link>
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <section className={container + ' py-10 sm:py-14'}>
        <SectionHeading
          eyebrow="Curated"
          title="Collections"
          description="Handpicked bundles and themed drops, updated by our merch team."
        />

        <div className="mt-8 space-y-12">
          {isCollectionsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="rounded-2xl border border-border overflow-hidden">
                  <Skeleton className="h-40 w-full" />
                  <div className="p-6 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : landingCollections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              No collections available yet.
            </div>
          ) : (
            landingCollections.map((collection) => {
              const collectionKey = collection.slug || collection.handle || collection.id || ''
              const collectionBanners =
                bannersByLanding.get(collectionKey) || bannersByLanding.get(collection.id || '') || []

              return (
                <section key={collection.id} className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="uppercase text-[11px] tracking-wide">
                          {(collection.type || 'Landing').toString()}
                        </Badge>
                        {collection.badge ? <Badge variant="outline">{collection.badge}</Badge> : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11">
                          {collection.avatarUrl || collection.imageUrl ? (
                            <AvatarImage
                              src={collection.avatarUrl || collection.imageUrl}
                              alt={collection.title || collection.name || 'Collection'}
                            />
                          ) : null}
                          <AvatarFallback>
                            {(() => {
                              const Icon = resolvePhosphorIcon(collection.icon)
                              return Icon
                                ? <Icon size={18} weight="bold" />
                                : (collection.title || collection.name || 'C').charAt(0)
                            })()}
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                          {collection.title || collection.name || 'Collection'}
                        </h3>
                      </div>
                      {collection.description ? <p className="text-muted-foreground max-w-2xl">{collection.description}</p> : null}
                    </div>
                    <Button variant="outline" asChild className="hidden sm:flex">
                      <Link href={`/category/${collection.slug || collection.handle || 'collection'}`}>
                        Explore
                        <ArrowRight size={14} weight="bold" className="ml-2" />
                      </Link>
                    </Button>
                  </div>

                  {collectionBanners.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {collectionBanners.slice(0, 2).map((banner) => (
                        <BannerCard key={banner.id} banner={banner} />
                      ))}
                    </div>
                  ) : null}

                  {collection.products && collection.products.length > 0 ? (
                    <HorizontalScroll>
                      {collection.products.map((product) => (
                        <ProductCard key={product.id} product={product} variant="compact" onAddToCart={onAddToCart} />
                      ))}
                    </HorizontalScroll>
                  ) : (
                    <div className="border border-dashed border-border rounded-xl p-6 text-center text-muted-foreground">
                      No products in this collection yet.
                    </div>
                  )}
                </section>
              )
            })
          )}
        </div>
      </section>

      <section className={container + ' py-10 sm:py-14'}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-7">
            <div
              className="absolute inset-0 opacity-80"
              style={{
                background:
                  'radial-gradient(900px circle at 20% 10%, color-mix(in oklab, var(--color-primary) 18%, transparent), transparent 55%)',
              }}
            />
            <div className="relative space-y-3">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold px-4 py-1.5 uppercase tracking-wide">
                Gaming & creators
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                Build your setup.
              </h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                Consoles, peripherals, monitors, and performance upgrades—curated for every budget.
              </p>
              <Button size="lg" className="font-semibold shadow-sm" asChild>
                <Link href="/category/gaming">
                  Explore gaming
                  <Fire size={18} weight="fill" className="ml-2" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-accent/10 via-background to-background p-7">
            <div
              className="absolute inset-0 opacity-80"
              style={{
                background:
                  'radial-gradient(900px circle at 20% 10%, color-mix(in oklab, var(--color-accent) 18%, transparent), transparent 55%)',
              }}
            />
            <div className="relative space-y-3">
              <Badge className="bg-accent/10 text-accent border-accent/20 text-xs font-bold px-4 py-1.5 uppercase tracking-wide">
                Member pricing
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                Sign up, save more.
              </h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                Create an account for early-access deals, faster checkout, and tailored recommendations.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="font-semibold shadow-sm" asChild>
                  <Link href="/signup">
                    Create account
                    <ArrowRight size={18} weight="bold" className="ml-2" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-background/60 hover:bg-background"
                  asChild
                >
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <Percent size={12} weight="bold" className="inline -mt-0.5 mr-1" />
                Welcome discounts and seasonal promos apply automatically when available.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={container + ' pb-14'}>
        <NewsletterCard />
      </section>
    </div>
  )
}
