import { Link } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  GameController,
  DeviceMobile,
  Lightning,
  Fire,
  TrendUp,
  Tag,
  ArrowRight,
  Sparkle,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { usePublicCategories } from '@/hooks/use-catalog-categories'
import { resolvePhosphorIcon } from '@/lib/phosphor'

const featuredBanners = [
  {
    id: 1,
    title: 'RTX 4090 Ti',
    subtitle: 'Ultimate Gaming Power',
    discount: '15% OFF',
    gradient: 'from-gamer-purple via-electric-blue to-cyber-cyan',
    icon: Lightning,
    href: '/category/gaming',
  },
  {
    id: 2,
    title: 'Galaxy S25 Ultra',
    subtitle: 'Pre-Order Now',
    badge: 'NEW',
    gradient: 'from-hot-pink via-accent to-gamer-purple',
    icon: Sparkle,
    href: '/category/smartphones-tablets',
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
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute left-0 right-0 top-full z-50 border-b bg-card/95 backdrop-blur-xl shadow-2xl"
          >
            <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                    <Fire size={14} weight="fill" className="text-primary" />
                    Categories
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {categories.map((category, index) => {
                      const Icon = resolvePhosphorIcon(category.icon) || DeviceMobile
                      return (
                        <motion.div
                          key={category.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02, duration: 0.2 }}
                        >
                          <Link href={`/category/${category.slug}`} onClick={onClose}>
                            <button className="group w-full text-left p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-accent/10 hover:border-primary/50 transition-all duration-200 hover:shadow-md hover:shadow-primary/5">
                              <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                                  <Icon size={18} weight="bold" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm mb-0.5 group-hover:text-primary transition-colors truncate">
                                    {category.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {typeof category.productCount === 'number' ? `${category.productCount}+ items` : 'Browse'}
                                  </div>
                                </div>
                              </div>
                            </button>
                          </Link>
                        </motion.div>
                      )
                    })}
                  </div>
                  
                  <div className="mt-5 pt-5 border-t border-border/50">
                    <div className="flex flex-wrap gap-2">
                      <Link href="/deals" onClick={onClose}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 h-8"
                        >
                          <Lightning size={14} weight="fill" />
                          Flash Deals
                        </Button>
                      </Link>
                      <Link href="/trending" onClick={onClose}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 text-orange-700 dark:text-orange-400 h-8"
                        >
                          <TrendUp size={14} weight="bold" />
                          Trending
                        </Button>
                      </Link>
                      <Link href="/category/gaming" onClick={onClose}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-gamer-purple/30 bg-gamer-purple/5 hover:bg-gamer-purple/10 text-gamer-purple h-8"
                        >
                          <GameController size={14} weight="fill" />
                          Gaming Hub
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                    <Sparkle size={14} weight="fill" className="text-accent" />
                    Featured
                  </h3>
                  
                  {featuredBanners.map((banner, index) => {
                    const Icon = banner.icon
                    return (
                      <motion.div
                        key={banner.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.05, duration: 0.2 }}
                      >
                        <Link href={banner.href} onClick={onClose}>
                          <div
                            className={cn(
                              'group relative overflow-hidden rounded-xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl',
                              'bg-gradient-to-br',
                              banner.gradient
                            )}
                          >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            <div className="relative z-10">
                              <div className="flex items-start justify-between mb-2.5">
                                <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                                  <Icon size={20} weight="bold" className="text-white" />
                                </div>
                                {banner.discount && (
                                  <Badge className="bg-white/90 text-foreground font-bold shadow-lg text-xs">
                                    {banner.discount}
                                  </Badge>
                                )}
                                {banner.badge && (
                                  <Badge className="bg-neon-green text-neon-green-foreground font-bold shadow-lg animate-pulse text-xs">
                                    {banner.badge}
                                  </Badge>
                                )}
                              </div>
                              
                              <h4 className="text-lg font-bold text-white mb-1 group-hover:translate-x-0.5 transition-transform">
                                {banner.title}
                              </h4>
                              <p className="text-white/90 text-sm mb-3">{banner.subtitle}</p>
                              
                              <div className="flex items-center gap-2 text-white text-sm font-medium group-hover:gap-2.5 transition-all">
                                <span>Shop Now</span>
                                <ArrowRight size={14} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                              </div>
                            </div>
                            
                            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}

                  <div className="relative rounded-lg border border-border/50 bg-muted/30 p-4 overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-xl" />
                    <div className="relative z-10">
                      <Tag size={18} weight="bold" className="text-primary mb-2" />
                      <h4 className="font-semibold text-sm mb-1">Student Discount</h4>
                      <p className="text-xs text-muted-foreground mb-2.5">
                        Get 10% off with valid student ID
                      </p>
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs">
                        Learn More
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
