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

  const addToCart = (product: Product, selectedVariants: Record<string, string> = {}) => {
    setCart((currentCart) => {
      const current = currentCart || defaultCart
      const existingItemIndex = current.items.findIndex(
        (item) =>
          item.product.id === product.id &&
          JSON.stringify(item.selectedVariants) === JSON.stringify(selectedVariants)
      )

      let updatedItems: CartItem[]

      if (existingItemIndex > -1) {
        updatedItems = current.items.map((item, index) =>
          index === existingItemIndex
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.price,
              }
            : item
        )
      } else {
        const newItem: CartItem = {
          id: `${product.id}-${Date.now()}`,
          product,
          quantity: 1,
          selectedVariants,
          price: product.price,
          subtotal: product.price,
        }
        updatedItems = [...current.items, newItem]
      }

      toast.success('Added to cart', {
        description: product.name,
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
