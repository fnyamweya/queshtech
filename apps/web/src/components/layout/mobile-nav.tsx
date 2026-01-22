import { Link, useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DeviceMobile,
  Lightning,
  Fire,
  User,
  Package,
  Gear,
  Sparkle,
  Gift,
  ArrowRight,
  SignOut,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { usePublicCategories } from '@/hooks/use-catalog-categories'
import { resolvePhosphorIcon } from '@/lib/phosphor'

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const [location, setLocation] = useLocation()
  const { user, isAuthenticated, logout } = useAuth()
  const { categories } = usePublicCategories({ isActive: true })

  const handleLinkClick = () => {
    onOpenChange(false)
  }

  const handleLogout = () => {
    logout()
    toast.success('Signed out successfully', {
      description: 'Come back soon!',
    })
    onOpenChange(false)
    setLocation('/')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] sm:w-[340px] p-0">
        <ScrollArea className="h-full">
          <SheetHeader className="px-3 py-2.5 border-b bg-gradient-to-r from-primary/5 via-accent/5 to-cyber-cyan/5">
            <SheetTitle className="text-left">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary via-gamer-purple to-cyber-cyan flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xs">Q</span>
                </div>
                <span className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>QueshTech</span>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="py-3 px-3 space-y-3">
            <div>
              <h3 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Quick Access
              </h3>
              <div className="grid grid-cols-4 gap-1.5">
                {categories.slice(0, 8).map((category) => {
                  const Icon = resolvePhosphorIcon(category.icon) || DeviceMobile
                  return (
                    <Link key={category.id} href={`/category/${category.slug}`} onClick={handleLinkClick}>
                      <button className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-primary/5 transition-colors w-full group">
                        <div className="w-9 h-9 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                          <Icon size={16} weight="bold" className="text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-[9px] font-medium text-center leading-tight line-clamp-2">
                          {category.name.split(' ')[0]}
                        </span>
                      </button>
                    </Link>
                  )
                })}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-lg overflow-hidden bg-gradient-to-br from-gamer-purple via-electric-blue to-cyber-cyan p-3 shadow-lg"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.15),transparent)]" />
              
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Lightning size={14} weight="fill" className="text-white" />
                    <Badge className="bg-neon-green text-white border-0 text-[9px] px-1.5 py-0 font-bold">
                      HOT
                    </Badge>
                  </div>
                  <h4 className="text-white font-bold text-xs mb-0.5">Gaming Sale</h4>
                  <p className="text-white/90 text-[10px]">Up to 40% off</p>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="bg-background/95 hover:bg-background font-semibold h-7 px-3 text-xs"
                >
                  <Link href="/category/gaming" onClick={handleLinkClick}>
                    Shop
                  </Link>
                </Button>
              </div>
            </motion.div>

            <div>
              <h3 className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User size={11} weight="bold" />
                Account
              </h3>
              <nav className="space-y-0.5">
                {isAuthenticated ? (
                  <>
                    <Button
                      asChild
                      variant="ghost"
                      className="w-full justify-start gap-2 h-8 hover:bg-primary/10 hover:text-primary transition-colors text-xs"
                    >
                      <Link href="/profile" onClick={handleLinkClick}>
                        <div className="p-1 rounded-md bg-primary/10 text-primary">
                          <User size={12} weight="bold" />
                        </div>
                        <span className="font-medium">My Profile</span>
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      className="w-full justify-start gap-2 h-8 hover:bg-accent/10 hover:text-accent transition-colors text-xs"
                    >
                      <Link href="/profile/orders" onClick={handleLinkClick}>
                        <div className="p-1 rounded-md bg-accent/10 text-accent">
                          <Package size={12} weight="bold" />
                        </div>
                        <span className="font-medium">Orders</span>
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" className="w-full justify-start gap-2 h-8 hover:bg-muted transition-colors text-xs">
                      <Link href="/profile/settings" onClick={handleLinkClick}>
                        <div className="p-1 rounded-md bg-muted text-foreground">
                          <Gear size={12} weight="bold" />
                        </div>
                        <span className="font-medium">Settings</span>
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 h-8 hover:bg-primary/10 hover:text-primary transition-colors text-xs"
                      onClick={handleLogout}
                    >
                      <div className="p-1 rounded-md bg-primary/10 text-primary">
                        <SignOut size={12} weight="bold" />
                      </div>
                      <span className="font-medium">Sign Out</span>
                    </Button>
                    {user?.firstName ? (
                      <p className="px-1 pt-1 text-[10px] text-muted-foreground">
                        Signed in as {user.firstName}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <Link
                    href={location.startsWith('/login') ? '/login' : `/login?redirect=${encodeURIComponent(location)}`}
                    onClick={handleLinkClick}
                  >
                    <Button variant="ghost" className="w-full justify-start gap-2 h-8 hover:bg-primary/10 hover:text-primary transition-colors text-xs">
                      <div className="p-1 rounded-md bg-primary/10 text-primary">
                        <ArrowRight size={12} weight="bold" />
                      </div>
                      <span className="font-medium">Sign In</span>
                    </Button>
                  </Link>
                )}
              </nav>
            </div>

            <Separator className="my-2" />

            <div>
              <h3 className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Fire size={11} weight="fill" className="text-primary" />
                All Categories
              </h3>
              <nav className="space-y-0.5">
                {categories.map((category) => {
                  const Icon = resolvePhosphorIcon(category.icon) || DeviceMobile
                  const isGaming = category.slug === 'gaming'
                  return (
                    <Link key={category.id} href={`/category/${category.slug}`} onClick={handleLinkClick}>
                      <Button 
                        variant="ghost" 
                        className={cn(
                          "w-full justify-between gap-2 h-8 hover:bg-primary/10 hover:text-primary transition-all group text-xs",
                          isGaming && "bg-gamer-purple/5 hover:bg-gamer-purple/10 text-gamer-purple hover:text-gamer-purple"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-0.5 rounded-md transition-colors",
                            isGaming ? "bg-gamer-purple/20 text-gamer-purple" : "bg-muted text-foreground group-hover:bg-primary/20 group-hover:text-primary"
                          )}>
                            <Icon size={12} weight="bold" />
                          </div>
                          <span className="truncate font-medium">{category.name}</span>
                        </div>
                        {isGaming && (
                          <Badge variant="secondary" className="bg-gamer-purple/20 text-gamer-purple border-0 text-[9px] px-1 py-0">
                            HOT
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  )
                })}
              </nav>
            </div>

            <Separator className="my-2" />

            <div>
              <h3 className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkle size={11} weight="fill" className="text-accent" />
                Featured
              </h3>
              <nav className="space-y-0.5">
                <Link href="/deals" onClick={handleLinkClick}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 h-8 hover:bg-amber-500/10 text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 text-xs"
                  >
                    <div className="p-1 rounded-md bg-amber-500/20">
                      <Lightning size={12} weight="fill" />
                    </div>
                    <span className="font-medium">Flash Deals</span>
                  </Button>
                </Link>
                <Link href="/trending" onClick={handleLinkClick}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 h-8 hover:bg-orange-500/10 text-orange-600 dark:text-orange-500 hover:text-orange-700 dark:hover:text-orange-400 text-xs"
                  >
                    <div className="p-1 rounded-md bg-orange-500/20">
                      <Fire size={12} weight="fill" />
                    </div>
                    <span className="font-medium">Trending Now</span>
                  </Button>
                </Link>
              </nav>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative rounded-lg border bg-gradient-to-br from-neon-green/5 to-success/5 p-2.5 overflow-hidden mt-2"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-1.5 mb-1">
                  <Gift size={14} weight="bold" className="text-neon-green" />
                  <h4 className="font-bold text-xs">Student Discount</h4>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Get 10% off with valid student ID
                </p>
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] border-neon-green/30 hover:bg-neon-green/10">
                  Learn More
                </Button>
              </div>
            </motion.div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
