import { Cart, CartItem, Product } from '@/types'
import { toast } from 'sonner'
import { useStorage } from '@/hooks/use-storage'

export function useCart() {
  const defaultCart: Cart = {
    items: [],
    subtotal: 0,
    tax: 0,
    shipping: 0,
    discount: 0,
    total: 0,
  }
  
  const [cart, setCart] = useStorage<Cart>('cart', defaultCart)

  const resolveSkuFromProduct = (product: Product, selectedVariants: Record<string, string>) => {
    const skus = Array.isArray(product.skus) ? product.skus : []
    if (!skus.length) return null

    const variantKeys = Object.keys(selectedVariants || {})
    if (variantKeys.length) {
      const match = skus.find((sku) => {
        const opts = sku.options || {}
        return variantKeys.every((key) => String(opts[key] || '').trim() === String(selectedVariants[key] || '').trim())
      })
      if (match) return match
    }

    return skus.find((sku) => sku.isDefault) || skus[0] || null
  }

  const calculateTotals = (items: CartItem[], discount = 0): Cart => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    const tax = subtotal * 0.08
    const shipping = subtotal > 100 ? 0 : 15
    const total = subtotal + tax + shipping - discount

    return {
      items,
      subtotal,
      tax,
      shipping,
      discount,
      total,
    }
  }

  const addToCart = (
    product: Product,
    selectedVariants: Record<string, string> = {},
    quantity: number = 1,
    skuId?: string
  ) => {
    const qty = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1

    const resolvedSku = skuId
      ? { id: skuId, code: product.skus?.find((s) => s.id === skuId)?.code }
      : resolveSkuFromProduct(product, selectedVariants)
    if (!resolvedSku?.id) {
      toast.error('Select a product option', {
        description: 'Please open the product and pick a variation before adding to cart.',
      })
      return
    }

    setCart((currentCart) => {
      const current = currentCart || defaultCart
      const existingItemIndex = current.items.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.productSkuId === resolvedSku.id &&
          JSON.stringify(item.selectedVariants) === JSON.stringify(selectedVariants)
      )

      let updatedItems: CartItem[]

      if (existingItemIndex > -1) {
        updatedItems = current.items.map((item, index) =>
          index === existingItemIndex
            ? {
                ...item,
                quantity: item.quantity + qty,
                subtotal: (item.quantity + qty) * item.price,
              }
            : item
        )
      } else {
        const newItem: CartItem = {
          id: `${product.id}-${Date.now()}`,
          product,
          productSkuId: resolvedSku.id,
          skuCode: resolvedSku.code,
          quantity: qty,
          selectedVariants,
          price: product.price,
          subtotal: qty * product.price,
        }
        updatedItems = [...current.items, newItem]
      }

      toast.success('Added to cart', {
        description: qty === 1 ? product.name : `${qty} × ${product.name}`,
      })

      return calculateTotals(updatedItems, current.discount)
    })
  }

  const updateQuantity = (itemId: string, quantity: number) => {
    setCart((currentCart) => {
      const current = currentCart || defaultCart
      const updatedItems = current.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity,
              subtotal: quantity * item.price,
            }
          : item
      )

      return calculateTotals(updatedItems, current.discount)
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart((currentCart) => {
      const current = currentCart || defaultCart
      const updatedItems = current.items.filter((item) => item.id !== itemId)

      toast.success('Removed from cart')

      return calculateTotals(updatedItems, current.discount)
    })
  }

  const clearCart = () => {
    setCart(defaultCart)
  }

  const applyPromoCode = (code: string) => {
    setCart((currentCart) => {
      const current = currentCart || defaultCart
      if (code === 'SAVE10') {
        const discount = current.subtotal * 0.1
        toast.success('Promo code applied!', {
          description: '10% discount',
        })
        return { ...calculateTotals(current.items, discount), promoCode: code }
      } else {
        toast.error('Invalid promo code')
        return current
      }
    })
  }

  return {
    cart: cart || defaultCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyPromoCode,
    itemCount: (cart || defaultCart).items.reduce((sum, item) => sum + item.quantity, 0),
  }
}
