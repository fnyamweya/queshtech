import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CartItem } from './cart-item'
import { Price } from './price'
import { Cart, Product } from '@/types'
import { ShoppingBag, Plus, Sparkle } from '@phosphor-icons/react'
import { useLocation } from 'wouter'
import { usePublicCollections } from '@/hooks/use-catalog-collections'
import { cn } from '@/lib/utils'

interface MiniCartProps {
  isOpen: boolean
  onClose: () => void
  cart: Cart
  onQuantityChange: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onAddToCart: (product: Product) => void
}

export function MiniCart({
  isOpen,
  onClose,
  cart,
  onQuantityChange,
  onRemove,
  onAddToCart,
}: MiniCartProps) {
  const [, setLocation] = useLocation()
  const { landingCollections, isLoading: isUpsellLoading } = usePublicCollections({ limit: 12 })

  const handleCheckout = () => {
    onClose()
    setLocation('/checkout')
  }

  const handleViewCart = () => {
    onClose()
    setLocation('/cart')
  }

  const recommendations = useMemo(() => {
    const cartProductIds = new Set(cart.items.map((i) => i.product.id))
    const preferredCategoryId = cart.items[0]?.product?.category?.id

    const candidates: Product[] = []
    for (const c of landingCollections) {
      for (const p of c.products || []) {
        if (!p?.id) continue
        if (cartProductIds.has(p.id)) continue
        if (p.inStock === false) continue
        candidates.push(p)
      }
    }

    const score = (p: Product) => {
      let s = 0
      if (preferredCategoryId && p.category?.id === preferredCategoryId) s += 3
      if (p.compareAtPrice && p.compareAtPrice > p.price) s += 2
      if (p.badges?.some((b) => b.type === 'bestseller' || b.type === 'limited')) s += 1
      return s
    }

    return [...candidates]
      .sort((a, b) => score(b) - score(a))
      .slice(0, 4)
  }, [cart.items, landingCollections])

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
        <SheetHeader className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <SheetTitle className="flex items-center gap-2 pr-10">
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: isOpen ? [0, -10, 10, -10, 0] : 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <ShoppingBag size={24} weight="bold" />
            </motion.div>
            <div className="min-w-0">
              <div className="text-base font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Cart
              </div>
              <div className="text-xs text-muted-foreground">
                {cart.items.length} item{cart.items.length === 1 ? '' : 's'} • Ready to checkout
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {cart.items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center justify-center text-center py-12"
          >
            <motion.div
              animate={{ 
                y: [0, -10, 0],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            >
              <ShoppingBag size={64} weight="thin" className="text-muted-foreground mb-4" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Add items to get started
            </p>
            <Button onClick={onClose} className="h-11 rounded-full gap-2">
              <Sparkle size={18} weight="fill" />
              Continue Shopping
            </Button>
          </motion.div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="px-4 py-4 space-y-5">
                <AnimatePresence mode="popLayout">
                  {cart.items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <CartItem
                        item={item}
                        onQuantityChange={onQuantityChange}
                        onRemove={onRemove}
                        variant="compact"
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isUpsellLoading ? null : recommendations.length > 0 ? (
                  <div className="pt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Frequently bought together</div>
                        <div className="text-xs text-muted-foreground">Quick add essentials for your setup.</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3">
                      {recommendations.map((p) => {
                        const img = p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 p-3"
                          >
                            <Link href={`/product/${p.slug}`} className="shrink-0">
                              <div className="h-12 w-12 overflow-hidden rounded-lg border border-border bg-muted">
                                {img ? (
                                  <img src={img} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                                ) : null}
                              </div>
                            </Link>
                            <div className="min-w-0 flex-1">
                              <Link href={`/product/${p.slug}`} className="block">
                                <div className="text-sm font-medium line-clamp-1 hover:underline">{p.name}</div>
                              </Link>
                              <div className="text-xs text-muted-foreground line-clamp-1">{p.brand}</div>
                              <div className="mt-1 text-sm font-semibold">{formatMoney(p.price)}</div>
                            </div>
                            <Button
                              size="sm"
                              className={cn('h-9 rounded-full gap-2', !p.inStock && 'opacity-60')}
                              disabled={!p.inStock}
                              onClick={() => onAddToCart(p)}
                            >
                              <Plus size={16} weight="bold" />
                              Add
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 px-4 py-4 space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <Price price={cart.subtotal} currency="KES" size="sm" />
                </div>
                {cart.discount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-destructive">
                      -<Price price={cart.discount} currency="KES" size="sm" />
                    </span>
                  </motion.div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-sm">Calculated at checkout</span>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <Price price={cart.total} currency="KES" size="lg" />
              </div>

              <div className="space-y-2">
                <Button className="w-full h-12 rounded-full" onClick={handleCheckout}>
                  Proceed to checkout
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={handleViewCart}
                >
                  View Full Cart
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
