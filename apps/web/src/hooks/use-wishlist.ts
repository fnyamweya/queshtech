import { useMemo } from 'react'
import { useStorage } from '@/hooks/use-storage'
import type { Product, WishlistItem } from '@/types'

function nowIso() {
  return new Date().toISOString()
}

export function useWishlist() {
  const [items, setItems] = useStorage<WishlistItem[]>('wishlist', [])

  const productIds = useMemo(() => new Set(items.map((i) => i.product.id)), [items])

  const add = (product: Product) => {
    setItems((prev) => {
      if (prev.some((i) => i.product.id === product.id)) return prev
      const next: WishlistItem = {
        id: `${product.id}-${Date.now()}`,
        product,
        addedDate: nowIso(),
      }
      return [next, ...prev]
    })
  }

  const remove = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }

  const toggle = (product: Product) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.product.id === product.id)
      return exists
        ? prev.filter((i) => i.product.id !== product.id)
        : [
            {
              id: `${product.id}-${Date.now()}`,
              product,
              addedDate: nowIso(),
            },
            ...prev,
          ]
    })
  }

  const isInWishlist = (productId: string) => productIds.has(productId)

  return { items, add, remove, toggle, isInWishlist }
}

