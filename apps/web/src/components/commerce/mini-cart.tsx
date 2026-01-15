import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { GamerButton } from '@/components/ui/gamer-button'
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
import { Cart } from '@/types'
import { ShoppingBag, Sparkle } from '@phosphor-icons/react'
import { useLocation } from 'wouter'

interface MiniCartProps {
  isOpen: boolean
  onClose: () => void
  cart: Cart
  onQuantityChange: (id: string, quantity: number) => void
  onRemove: (id: string) => void
}

export function MiniCart({
  isOpen,
  onClose,
  cart,
  onQuantityChange,
  onRemove,
}: MiniCartProps) {
  const [, setLocation] = useLocation()

  const handleCheckout = () => {
    onClose()
    setLocation('/checkout')
  }

  const handleViewCart = () => {
    onClose()
    setLocation('/cart')
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: isOpen ? [0, -10, 10, -10, 0] : 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <ShoppingBag size={24} weight="bold" />
            </motion.div>
            Shopping Cart ({cart.items.length})
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
            <GamerButton onClick={onClose} variant="primary" size="md">
              <Sparkle size={18} weight="fill" />
              Continue Shopping
            </GamerButton>
          </motion.div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-4">
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
              </div>
            </ScrollArea>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="space-y-4 pt-4"
            >
              <Separator />

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
                <GamerButton 
                  className="w-full" 
                  size="lg" 
                  onClick={handleCheckout}
                  variant="primary"
                >
                  Proceed to Checkout
                </GamerButton>
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
