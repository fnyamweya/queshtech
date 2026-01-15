import { useState, useEffect } from 'react'
import { Link, useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ShoppingCart,
  MagnifyingGlass,
  User,
  List,
  SignOut,
  DeviceMobile,
} from '@phosphor-icons/react'
import { MegaMenu } from './mega-menu'
import { ThemeToggle } from './theme-toggle'
import { useAuth } from '@/hooks/use-auth'
import { usePublicCategories } from '@/hooks/use-catalog-categories'
import { cn } from '@/lib/utils'
import { resolvePhosphorIcon } from '@/lib/phosphor'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'

interface HeaderProps {
  cartItemCount: number
  onCartClick: () => void
  onSearchOpen: () => void
  onMobileMenuOpen: () => void
}

export function Header({
  cartItemCount,
  onCartClick,
  onSearchOpen,
  onMobileMenuOpen,
}: HeaderProps) {
  const [location, setLocation] = useLocation()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false)
  const { user, isAuthenticated, logout } = useAuth()
  const { categories } = usePublicCategories({ isActive: true })

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleMegaMenu = () => {
    setIsMegaMenuOpen(!isMegaMenuOpen)
  }

  const handleLogout = () => {
    logout()
    toast.success('Signed out successfully', {
      description: 'Come back soon!',
    })
    setLocation('/')
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b transition-all duration-200',
        isScrolled
          ? 'bg-card/95 backdrop-blur-md shadow-sm'
          : 'bg-card'
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px]">
        <div className="flex items-center justify-between h-16 sm:h-18 lg:h-20">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="hidden lg:flex -ml-2 gap-2 h-9"
              onClick={toggleMegaMenu}
            >
              <List size={18} weight="bold" />
              <span className="text-sm font-medium">Menu</span>
            </Button>

            <Link href="/">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-primary via-electric-blue to-cyber-cyan flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105">
                  <span className="text-white font-black text-base sm:text-lg lg:text-xl">Q</span>
                </div>
                <h1
                  className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight bg-gradient-to-r from-primary to-electric-blue bg-clip-text text-transparent"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  QueshTech
                </h1>
              </div>
            </Link>
          </div>

          <Button
            variant="outline"
            className="hidden md:flex items-center gap-2 w-full max-w-xs lg:max-w-md h-9 justify-start text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            onClick={onSearchOpen}
          >
            <MagnifyingGlass size={16} />
            <span className="text-sm">Search products...</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-8 w-8 p-0"
              onClick={onSearchOpen}
            >
              <MagnifyingGlass size={18} weight="bold" />
            </Button>

            <ThemeToggle />

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-9 sm:w-9 p-0">
                    <User size={18} weight="bold" />
                    <span className="sr-only">Account menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {user && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </div>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/profile">
                      <span>My Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile/orders">
                      <span>Order History</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile/settings">
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <SignOut size={16} weight="bold" className="mr-2" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 sm:h-9 gap-1"
                onClick={() => {
                  if (location.startsWith('/login')) {
                    setLocation('/login')
                    return
                  }
                  setLocation(`/login?redirect=${encodeURIComponent(location)}`)
                }}
              >
                <User size={18} weight="bold" />
                <span className="hidden sm:inline text-xs sm:text-sm">Sign In</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="relative h-8 w-8 sm:h-9 sm:w-9 p-0"
              onClick={onCartClick}
            >
              <ShoppingCart size={18} weight="bold" />
              {cartItemCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 min-w-[1rem] flex items-center justify-center p-0 text-[9px] bg-accent text-accent-foreground animate-pulse">
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
        <div className="flex lg:hidden items-center justify-between py-2 border-t text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={onMobileMenuOpen}
          >
            <List size={18} weight="bold" />
            <span className="font-medium">Browse</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-2" onClick={toggleMegaMenu}>
            <List size={16} weight="bold" />
            <span className="font-medium">Categories</span>
          </Button>
        </div>
      </div>

      <div className="border-t hidden lg:block">
        <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px]">
          <ScrollArea className="w-full">
            <div className="flex items-center gap-1 py-2">
              {categories.map((category) => {
                const Icon = resolvePhosphorIcon(category.icon) || DeviceMobile
                return (
                <Link key={category.slug} href={`/category/${category.slug}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'gap-2 text-sm font-medium transition-colors h-8',
                      location === `/category/${category.slug}`
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon size={16} weight="bold" />
                    <span>{category.name}</span>
                  </Button>
                </Link>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      <MegaMenu isOpen={isMegaMenuOpen} onClose={() => setIsMegaMenuOpen(false)} />
    </header>
  )
}
