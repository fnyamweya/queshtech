import { useState, useEffect, forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
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
  CaretDown,
} from '@phosphor-icons/react'
import { MegaMenu } from './mega-menu'
import { ThemeToggle } from './theme-toggle'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface HeaderProps {
  cartItemCount: number
  onCartClick: () => void
  onSearchOpen: () => void
  onMobileMenuOpen: () => void
}

type HeaderTwoLineItemProps = {
  top: string
  bottom: string
  rightIcon?: ReactNode
}

const HeaderTwoLineItem = forwardRef<HTMLButtonElement, HeaderTwoLineItemProps & ComponentPropsWithoutRef<'button'>>(
  ({ top, bottom, rightIcon, className, type, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type || 'button'}
        className={cn(
          'rounded-md px-3 py-2 text-left transition-colors',
          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          className
        )}
        {...props}
      >
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] leading-none text-muted-foreground truncate">{top}</div>
            <div className="text-sm leading-tight font-semibold text-foreground truncate">{bottom}</div>
          </div>
          {rightIcon ? <div className="shrink-0 text-muted-foreground">{rightIcon}</div> : null}
        </div>
      </button>
    )
  }
)

HeaderTwoLineItem.displayName = 'HeaderTwoLineItem'

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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!isMegaMenuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMegaMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isMegaMenuOpen])

  useEffect(() => {
    setIsMegaMenuOpen(false)
  }, [location])

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

  const handleLoginRedirect = (redirectTo?: string) => {
    const redirect = redirectTo || location
    if (redirect.startsWith('/login')) {
      setLocation('/login')
      return
    }
    setLocation(`/login?redirect=${encodeURIComponent(redirect)}`)
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-200',
        isMegaMenuOpen
          ? 'bg-background shadow-sm'
          : isScrolled
            ? 'bg-background/80 backdrop-blur-xl shadow-sm'
            : 'bg-background'
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px]">
        <div className="h-16 flex items-center">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9"
              onClick={onMobileMenuOpen}
              aria-label="Open menu"
            >
              <List size={18} weight="bold" />
            </Button>

            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <span className="font-black text-base">Q</span>
              </div>
              <span
                className="text-base sm:text-lg font-black tracking-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                QueshTech
              </span>
            </Link>

            <div className="hidden lg:flex items-center">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'ml-2 h-9 rounded-full gap-2 border-border/60 bg-background/60',
                  isMegaMenuOpen ? 'border-primary/40 text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={toggleMegaMenu}
                aria-expanded={isMegaMenuOpen}
              >
                <List size={16} weight="bold" />
                Browse
                <CaretDown size={14} weight="bold" className={cn('transition-transform', isMegaMenuOpen ? 'rotate-180' : 'rotate-0')} />
              </Button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-3">
            <Button
              variant="outline"
              className={cn(
                'hidden md:flex items-center gap-2 w-full max-w-[620px] h-10 rounded-full justify-start',
                'text-muted-foreground hover:text-foreground hover:border-primary/40 bg-background/60'
              )}
              onClick={onSearchOpen}
            >
              <MagnifyingGlass size={16} />
              <span className="text-sm">Search products, brands, categories…</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={onSearchOpen}
              aria-label="Search"
            >
              <MagnifyingGlass size={18} weight="bold" />
            </Button>

            <div className="hidden md:flex items-center gap-1">
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <HeaderTwoLineItem
                      top={`Hi${user?.firstName ? `, ${user.firstName}` : ''}`}
                      bottom="Account & Lists"
                      rightIcon={<CaretDown size={14} weight="bold" />}
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {user ? (
                      <>
                        <div className="px-2 py-1.5">
                          <div className="text-sm font-semibold">{user.firstName} {user.lastName}</div>
                          <div className="text-xs text-muted-foreground">Manage your account</div>
                        </div>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    <DropdownMenuItem asChild>
                      <Link href="/profile">
                        <span>My profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile/orders">
                        <span>Orders</span>
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
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <HeaderTwoLineItem
                  top="Hello, sign in"
                  bottom="Account & Lists"
                  rightIcon={<CaretDown size={14} weight="bold" />}
                  onClick={() => handleLoginRedirect()}
                />
              )}

              <HeaderTwoLineItem
                top="Returns"
                bottom="& Orders"
                onClick={() => {
                  if (!isAuthenticated) {
                    handleLoginRedirect()
                    return
                  }
                  setLocation('/profile/orders')
                }}
              />

              <button
                type="button"
                onClick={onCartClick}
                className={cn(
                  'rounded-md px-3 py-2 text-left transition-colors',
                  'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
                )}
                aria-label="Cart"
              >
                <div className="flex items-end gap-2">
                  <div className="relative">
                    <ShoppingCart size={20} weight="bold" />
                    {cartItemCount > 0 ? (
                      <Badge className="absolute -top-2 -right-2 h-4 min-w-[1rem] flex items-center justify-center p-0 text-[9px] bg-primary text-primary-foreground">
                        {cartItemCount}
                      </Badge>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-[11px] leading-none text-muted-foreground">&nbsp;</div>
                    <div className="text-sm leading-tight font-semibold text-foreground">Cart</div>
                  </div>
                </div>
              </button>

              <ThemeToggle />
            </div>

            <div className="flex md:hidden items-center gap-1.5">
              <ThemeToggle />
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Account">
                      <User size={18} weight="bold" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {user ? (
                      <>
                        <div className="px-2 py-1.5">
                          <div className="text-sm font-semibold">{user.firstName} {user.lastName}</div>
                          <div className="text-xs text-muted-foreground">Manage your account</div>
                        </div>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    <DropdownMenuItem asChild>
                      <Link href="/profile">
                        <span>My profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile/orders">
                        <span>Orders</span>
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
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => handleLoginRedirect()}
                  aria-label="Sign in"
                >
                  <User size={18} weight="bold" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                onClick={onCartClick}
                aria-label="Cart"
              >
                <ShoppingCart size={18} weight="bold" />
                {cartItemCount > 0 ? (
                  <Badge className="absolute -top-1 -right-1 h-4 min-w-[1rem] flex items-center justify-center p-0 text-[9px] bg-primary text-primary-foreground">
                    {cartItemCount}
                  </Badge>
                ) : null}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <MegaMenu isOpen={isMegaMenuOpen} onClose={() => setIsMegaMenuOpen(false)} />
    </header>
  )
}
