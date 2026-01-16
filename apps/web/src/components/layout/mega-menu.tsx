import { Link } from 'wouter'
import { AnimatePresence, motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { usePublicCategories } from '@/hooks/use-catalog-categories'
import { resolvePhosphorIcon } from '@/lib/phosphor'
import {
  ArrowRight,
  DeviceMobile,
  Fire,
  GameController,
  Lightning,
  Sparkle,
  Tag,
  TrendUp,
  X,
} from '@phosphor-icons/react'

const featuredBanners = [
  {
    id: 1,
    title: 'RTX 4090 Ti',
    subtitle: 'Ultimate gaming performance',
    discount: '15% OFF',
    icon: Lightning,
    href: '/category/gaming',
    tone: 'primary' as const,
  },
  {
    id: 2,
    title: 'Galaxy S25 Ultra',
    subtitle: 'Pre-order now',
    badge: 'NEW',
    icon: Sparkle,
    href: '/category/smartphones-tablets',
    tone: 'accent' as const,
  },
]

interface MegaMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function MegaMenu({ isOpen, onClose }: MegaMenuProps) {
  const { categories } = usePublicCategories({ isActive: true })

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-gradient-to-b from-transparent via-black/10 to-black/25"
            onClick={onClose}
          />

          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              'absolute left-0 right-0 top-full z-50',
              'border-b border-border bg-background shadow-2xl'
            )}
          >
            <ScrollArea className="max-h-[min(36rem,calc(100vh-7rem))]">
              <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-4">
                <div className="flex items-center justify-between gap-4 pb-3">
                  <div className="flex items-center gap-2">
                    <Fire size={14} weight="fill" className="text-primary" />
                    <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                      Browse
                    </h2>
                    <span className="hidden sm:inline text-xs text-muted-foreground">
                      Categories, deals, and collections
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose} aria-label="Close menu">
                    <X size={18} weight="bold" />
                  </Button>
                </div>

                <div className="grid gap-5 lg:grid-cols-12">
                  <div className="lg:col-span-8">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {categories.map((category) => {
                        const Icon = resolvePhosphorIcon(category.icon) || DeviceMobile
                        return (
                          <Link key={category.id} href={`/category/${category.slug}`} onClick={onClose}>
                            <div className="group rounded-xl border border-border/60 bg-background/60 p-3 transition-colors hover:bg-primary/5 hover:border-primary/30">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                  <Icon size={18} weight="bold" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">{category.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {typeof category.productCount === 'number' ? `${category.productCount}+ items` : 'Browse'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link href="/category/all" onClick={onClose}>
                        <Button size="sm" variant="outline" className="h-9 rounded-full gap-2 bg-background/60">
                          <Tag size={14} weight="bold" />
                          Shop all
                        </Button>
                      </Link>
                      <Link href="/deals" onClick={onClose}>
                        <Button size="sm" variant="outline" className="h-9 rounded-full gap-2 bg-background/60">
                          <Lightning size={14} weight="fill" />
                          Deals
                        </Button>
                      </Link>
                      <Link href="/trending" onClick={onClose}>
                        <Button size="sm" variant="outline" className="h-9 rounded-full gap-2 bg-background/60">
                          <TrendUp size={14} weight="fill" />
                          Trending
                        </Button>
                      </Link>
                      <Link href="/category/gaming" onClick={onClose}>
                        <Button size="sm" variant="outline" className="h-9 rounded-full gap-2 bg-background/60">
                          <GameController size={14} weight="fill" />
                          Gaming
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <div className="lg:col-span-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Sparkle size={14} weight="fill" className="text-accent" />
                      Featured
                    </h3>

                    {featuredBanners.map((banner, index) => {
                      const Icon = banner.icon
                      const tone = banner.tone
                      return (
                        <motion.div
                          key={banner.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 + index * 0.05, duration: 0.18 }}
                        >
                          <Link href={banner.href} onClick={onClose}>
                            <div className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-background via-background to-muted p-4 transition-shadow hover:shadow-lg">
                              <div
                                className="absolute inset-0 opacity-70"
                                style={{
                                  background:
                                    tone === 'primary'
                                      ? 'radial-gradient(700px circle at 20% 10%, color-mix(in oklab, var(--color-primary) 16%, transparent), transparent 55%)'
                                      : 'radial-gradient(700px circle at 20% 10%, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 55%)',
                                }}
                              />

                              <div className="relative">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div
                                    className={cn(
                                      'h-10 w-10 rounded-xl flex items-center justify-center border',
                                      tone === 'primary'
                                        ? 'bg-primary/10 text-primary border-primary/15'
                                        : 'bg-accent/10 text-accent border-accent/15'
                                    )}
                                  >
                                    <Icon size={18} weight="bold" />
                                  </div>
                                  {banner.discount ? (
                                    <Badge className="bg-primary text-primary-foreground border-0 text-xs font-bold">
                                      {banner.discount}
                                    </Badge>
                                  ) : null}
                                  {banner.badge ? (
                                    <Badge variant="secondary" className="text-xs font-bold">
                                      {banner.badge}
                                    </Badge>
                                  ) : null}
                                </div>

                                <h4 className="text-base font-bold mb-1 group-hover:translate-x-0.5 transition-transform">
                                  {banner.title}
                                </h4>
                                <p className="text-sm text-muted-foreground mb-3">{banner.subtitle}</p>

                                <div className="flex items-center gap-2 text-sm font-semibold">
                                  <span>Shop now</span>
                                  <ArrowRight size={14} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      )
                    })}

                    <div className="relative rounded-2xl border border-border bg-background/60 p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          <Tag size={16} weight="bold" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">Student discount</div>
                          <div className="text-xs text-muted-foreground">Get 10% off with a valid student ID.</div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="w-full mt-3 h-9 rounded-full bg-background/60">
                        Learn more
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
