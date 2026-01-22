import { useState } from 'react'
import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CartItem } from '@/components/commerce/cart-item'
import { Price } from '@/components/commerce/price'
import { Cart as CartType } from '@/types'
import { ShoppingBag, ArrowRight, Tag } from '@phosphor-icons/react'

interface CartPageProps {
  cart: CartType
  onQuantityChange: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onApplyPromo: (code: string) => void
}

export function CartPage({
  cart,
  onQuantityChange,
  onRemove,
  onApplyPromo,
}: CartPageProps) {
  const [promoCode, setPromoCode] = useState('')
  const cartCurrency = cart.items[0]?.product?.currency || ''

  const formatMoney = (amount: number) => {
    const hasCurrency = typeof cartCurrency === 'string' && cartCurrency.trim().length > 0
    return new Intl.NumberFormat('en-KE', {
      style: hasCurrency ? 'currency' : 'decimal',
      currency: hasCurrency ? cartCurrency : undefined,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const handleApplyPromo = () => {
    if (promoCode.trim()) {
      onApplyPromo(promoCode.trim())
      setPromoCode('')
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-md mx-auto text-center space-y-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center">
            <ShoppingBag size={48} weight="thin" className="text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Your cart is empty</h1>
            <p className="text-muted-foreground">
              Looks like you haven't added anything to your cart yet.
            </p>
          </div>
          <Button size="lg" asChild>
            <Link href="/">
              Continue Shopping
              <ArrowRight size={20} weight="bold" className="ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="space-y-6">
              {cart.items.map((item, index) => (
                <div key={item.id}>
                  <CartItem
                    item={item}
                    onQuantityChange={onQuantityChange}
                    onRemove={onRemove}
                  />
                  {index < cart.items.length - 1 && <Separator className="mt-6" />}
                </div>
              ))}
            </div>
          </Card>

          <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
            <Link href="/">
              Continue Shopping
            </Link>
          </Button>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Promo Code</h2>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    placeholder="Enter code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleApplyPromo} variant="outline">
                  Apply
                </Button>
              </div>
              {cart.promoCode && (
                <p className="text-sm text-primary mt-2">
                  Promo code "{cart.promoCode}" applied
                </p>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Subtotal ({cart.items.reduce((sum, item) => sum + item.quantity, 0)}{' '}
                    items)
                  </span>
                  <Price price={cart.subtotal} currency={cartCurrency} size="sm" />
                </div>

                {cart.discount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-destructive font-medium">
                      -<Price price={cart.discount} currency={cartCurrency} size="sm" />
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  {cart.shipping === 0 ? (
                    <span className="text-primary font-medium text-sm">Free</span>
                  ) : (
                    <Price price={cart.shipping} currency={cartCurrency} size="sm" />
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax (estimated)</span>
                  <Price price={cart.tax} currency={cartCurrency} size="sm" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-lg">Total</span>
                  <Price price={cart.total} currency={cartCurrency} size="lg" />
                </div>
              </div>

              <Button size="lg" className="w-full mt-6" asChild>
                <Link href="/checkout">
                  Proceed to Checkout
                  <ArrowRight size={20} weight="bold" className="ml-2" />
                </Link>
              </Button>

              {cart.subtotal < 100 && (
                <p className="text-xs text-center text-muted-foreground mt-4">
                  Add {formatMoney(100 - cart.subtotal)} more for free shipping
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
