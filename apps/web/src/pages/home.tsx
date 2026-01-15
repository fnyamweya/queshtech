import { Link } from 'wouter'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProductCard } from '@/components/commerce/product-card'
import { HeroCarousel, type HeroSlide } from '@/components/commerce/hero-carousel'
import { HorizontalScroll } from '@/components/commerce/horizontal-scroll'
import { Product } from '@/types'
import { usePublicCollections } from '@/hooks/use-catalog-collections'
import { usePublicBanners } from '@/hooks/use-banners'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { resolvePhosphorIcon } from '@/lib/phosphor'
import {
  Truck,
  ShieldCheck,
  ArrowsCounterClockwise,
  Headset,
  Lightning,
  Sparkle,
  Fire,
  ArrowRight,
  Percent,
  Trophy,
} from '@phosphor-icons/react'

interface HomePageProps {
  onAddToCart: (product: Product) => void
}

export function HomePage({ onAddToCart }: HomePageProps) {
  const { landingCollections, isLoading: isCollectionsLoading } = usePublicCollections({ limit: 12 })
  const { heroBanners, featureBanners } = usePublicBanners()

  const heroSlides: HeroSlide[] = heroBanners
    .filter((banner) => banner.creative?.imageKey || banner.imageUrl)
    .map((banner, idx) => {
      const image = banner.creative?.imageKey || banner.imageUrl || ''
      const ctaLabel = banner.creative?.cta?.label || banner.ctaLabel || 'Shop now'
      const ctaHref = banner.creative?.cta?.url || banner.href || '/'

      return {
        id: banner.id || `hero-${idx}`,
        title: banner.title || 'Landing spotlight',
        subtitle: banner.subtitle || banner.landingSection || 'Curated picks',
        description: banner.description || 'Explore the latest drops and campaigns.',
        image,
        cta: { label: ctaLabel, href: ctaHref },
        secondaryCta: banner.href ? { label: 'View details', href: banner.href } : undefined,
        badge: banner.subtitle || banner.landingSection || 'Featured',
        badgeColor: 'from-primary to-electric-blue',
        gradient: 'from-primary via-electric-blue to-cyber-cyan',
      }
    })

  const featuredProducts = landingCollections.flatMap((c) => c.products || []).slice(0, 12)
  const productsForGrid = featuredProducts

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

  return (
    <div className="flex flex-col">
      <section className="w-full">
        {heroSlides.length > 0 ? (
          <HeroCarousel slides={heroSlides} />
        ) : (
          <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-12 text-center">
            <p className="text-muted-foreground">No hero banners available.</p>
          </div>
        )}
      </section>

      <section className="border-y border-[color:var(--color-border)] bg-[color:var(--color-muted)] py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px]">
          <div className="flex items-center justify-center gap-4 overflow-x-auto scrollbar-hide">
            {[{
              icon: <Truck size={14} weight="bold" className="text-primary" />, label: 'Lightning Fast', sub: 'Same-day Nairobi', bg: 'bg-primary/10',
            }, {
              icon: <ShieldCheck size={14} weight="bold" className="text-neon-green" />, label: 'Secure Checkout', sub: 'M-Pesa & Cards', bg: 'bg-neon-green/10',
            }, {
              icon: <ArrowsCounterClockwise size={14} weight="bold" className="text-accent" />, label: 'Easy Returns', sub: '30-day guarantee', bg: 'bg-accent/10',
            }, {
              icon: <Headset size={14} weight="bold" className="text-cyber-cyan" />, label: '24/7 Support', sub: 'Always here', bg: 'bg-cyber-cyan/10',
            }, {
              icon: <Lightning size={14} weight="fill" className="text-vibrant-orange" />, label: 'Hot Deals', sub: 'Flash sales', bg: 'bg-vibrant-orange/10',
            }, {
              icon: <Trophy size={14} weight="fill" className="text-gamer-purple" />, label: 'Top Rated', sub: '5-star picks', bg: 'bg-gamer-purple/10',
            }, {
              icon: <Sparkle size={14} weight="fill" className="text-hot-pink" />, label: 'New Arrivals', sub: 'Fresh tech', bg: 'bg-hot-pink/10',
            }, {
              icon: <Percent size={14} weight="bold" className="text-success" />, label: 'Best Prices', sub: 'Guaranteed', bg: 'bg-success/10',
            }].map((item, idx) => (
              <div className="flex items-center gap-2 shrink-0" key={idx}>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${item.bg}`}>
                  {item.icon}
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold leading-tight">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{item.sub}</span>
                </div>
                {idx < 7 && <div className="h-6 w-px bg-border shrink-0 ml-3" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {orphanBanners.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-10 sm:py-14">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold uppercase text-primary tracking-wide mb-1">Landing highlights</p>
              <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                Featured banners
              </h2>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {orphanBanners.map((banner) => (
              <div
                key={banner.id}
                className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-background via-background/70 to-muted shadow-sm"
              >
                <div className="absolute inset-0">
                  {banner.imageUrl ? (
                    <img src={banner.imageUrl} alt={banner.title || 'Banner'} className="w-full h-full object-cover" />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/30" />
                </div>
                <div className="relative p-6 space-y-3">
                  {banner.subtitle && (
                    <Badge variant="secondary" className="uppercase text-[11px] tracking-wide">
                      {banner.subtitle}
                    </Badge>
                  )}
                  <h3 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                    {banner.title || 'Promoted placement'}
                  </h3>
                  {banner.description && <p className="text-sm text-muted-foreground max-w-xl">{banner.description}</p>}
                  <Button asChild size="sm" variant="secondary" className="gap-2">
                    <Link href={banner.href || '/'}>
                      {banner.ctaLabel || 'Shop now'}
                      <ArrowRight size={14} weight="bold" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-10 sm:py-14">
        <div className="space-y-10">
            {landingCollections.map((collection) => {
              const collectionKey = collection.slug || collection.handle || collection.id || ''
              const collectionBanners = bannersByLanding.get(collectionKey) || bannersByLanding.get(collection.id || '') || []

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
                              return Icon ? <Icon size={18} weight="bold" /> : (collection.title || collection.name || 'C').charAt(0)
                            })()}
                          </AvatarFallback>
                        </Avatar>
                        <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                          {collection.title || collection.name || 'Collection'}
                        </h2>
                      </div>
                      {collection.description ? (
                        <p className="text-muted-foreground max-w-2xl">{collection.description}</p>
                      ) : null}
                    </div>
                    <Button variant="outline" asChild className="hidden sm:flex">
                      <Link href={`/category/${collection.slug || collection.handle || 'collection'}`}>
                        Explore
                        <ArrowRight size={14} weight="bold" className="ml-2" />
                      </Link>
                    </Button>
                  </div>

                  {collectionBanners.length > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {collectionBanners.map((banner) => (
                        <div
                          key={banner.id}
                          className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-background via-background/70 to-muted shadow-sm"
                        >
                          <div className="absolute inset-0">
                            {banner.imageUrl ? (
                              <img src={banner.imageUrl} alt={banner.title || 'Banner'} className="w-full h-full object-cover" />
                            ) : null}
                            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/30" />
                          </div>
                          <div className="relative p-6 space-y-3">
                            {banner.subtitle && (
                              <Badge variant="secondary" className="uppercase text-[11px] tracking-wide">
                                {banner.subtitle}
                              </Badge>
                            )}
                            <h3 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                              {banner.title || 'Promoted placement'}
                            </h3>
                            {banner.description && <p className="text-sm text-muted-foreground max-w-xl">{banner.description}</p>}
                            <Button asChild size="sm" variant="secondary" className="gap-2">
                              <Link href={banner.href || '/'}>
                                {banner.ctaLabel || 'Shop now'}
                                <ArrowRight size={14} weight="bold" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {collection.products && collection.products.length > 0 ? (
                    <HorizontalScroll>
                      {collection.products.map((product) => (
                        <ProductCard key={product.id} product={product} variant="compact" onAddToCart={onAddToCart} />
                      ))}
                    </HorizontalScroll>
                  ) : (
                    <div className="border border-dashed border-border rounded-xl p-6 text-center text-muted-foreground">
                      {isCollectionsLoading ? 'Loading collection products...' : 'No products in this collection yet.'}
                    </div>
                  )}
                </section>
              )
            })}
        </div>
      </section>

      <section className="bg-accent py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] text-center">
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            🎮 Gaming Zone
          </h2>
          <p className="text-lg text-accent-foreground/90 mb-8 max-w-2xl mx-auto">
            Level up with the latest gaming gear, consoles, and accessories
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="bg-white text-accent hover:bg-white/90 font-semibold"
            asChild
          >
            <Link href="/category/gaming">
              Explore Gaming
              <Fire size={20} weight="fill" className="ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="bg-cyber-cyan py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px]">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="text-white">
              <Badge className="bg-white/20 text-white border-0 text-xs font-bold px-4 py-1.5 uppercase tracking-wide mb-4">
                Exclusive Offer
              </Badge>
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Sign Up & Save 15%
              </h2>
              <p className="text-lg text-white/90 mb-6">
                Join QueshTech and get instant access to exclusive deals, early product launches, and special member-only prices.
              </p>
              <Button
                size="lg"
                variant="secondary"
                className="bg-white text-cyber-cyan hover:bg-white/90 font-semibold"
                asChild
              >
                <Link href="/signup">
                  Create Account
                  <ArrowRight size={20} weight="bold" className="ml-2" />
                </Link>
              </Button>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white mb-2">15%</div>
                    <div className="text-sm text-white/80">Welcome Discount</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white mb-2">24/7</div>
                    <div className="text-sm text-white/80">Customer Support</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white mb-2">FREE</div>
                    <div className="text-sm text-white/80">Shipping KES 10K+</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white mb-2">30</div>
                    <div className="text-sm text-white/80">Days Returns</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-10 sm:py-16">
        <div className="mb-6 sm:mb-8">
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Featured Products
          </h2>
          <p className="text-muted-foreground">
            Handpicked items from our latest collection
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {productsForGrid.length === 0 ? (
                <div className="col-span-full text-center text-muted-foreground py-10">No featured products available.</div>
              ) : (
                productsForGrid.map((product) => (
                  <ProductCard key={product.id} product={product} variant="compact" onAddToCart={onAddToCart} />
                ))
              )}
            </div>

            {productsForGrid.length > 0 && (
              <div className="text-center mt-10">
                <Button size="lg" asChild>
                  <Link href="/category/all">Explore All Products</Link>
                </Button>
              </div>
            )}
      </section>
    </div>
  )
}
