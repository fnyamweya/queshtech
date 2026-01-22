import { useState } from 'react'
import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { X } from '@phosphor-icons/react'
import { QuantityInput } from './quantity-input'
import { Price } from './price'
import { ConfirmDialog } from './confirm-dialog'
import { CartItem as CartItemType } from '@/types'
import { cn } from '@/lib/utils'

interface CartItemProps {
  item: CartItemType
  onQuantityChange: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  variant?: 'default' | 'compact'
  className?: string
}

export function CartItem({
  item,
  onQuantityChange,
  onRemove,
  variant = 'default',
  className,
}: CartItemProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const image = item.product.images[0]
  const variantText = Object.entries(item.selectedVariants)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
  const skuLabel = item.skuCode || item.productSkuId

  const handleRemoveClick = () => {
    setShowConfirmDialog(true)
  }

  const handleConfirmRemove = () => {
    onRemove(item.id)
    setShowConfirmDialog(false)
  }

  if (variant === 'compact') {
    return (
      <>
        <div className={cn('flex gap-3', className)}>
          <Link href={`/product/${item.product.slug}`}>
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              <img
                src={image?.url}
                alt={image?.alt || item.product.name}
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <Link href={`/product/${item.product.slug}`}>
              <h4 className="font-medium text-sm line-clamp-1 hover:underline">
                {item.product.name}
              </h4>
            </Link>
            {skuLabel ? <p className="text-xs text-muted-foreground mt-0.5">SKU: {skuLabel}</p> : null}
            {variantText && (
              <p className="text-xs text-muted-foreground mt-0.5">{variantText}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
              <Price price={item.subtotal} currency={item.product.currency} size="sm" />
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveClick}
            className="h-8 w-8 p-0 flex-shrink-0"
          >
            <X size={16} />
          </Button>
        </div>
        
        <ConfirmDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          title="Remove item from cart?"
          description={`Are you sure you want to remove "${item.product.name}" from your cart?`}
          confirmText="Remove"
          variant="destructive"
          onConfirm={handleConfirmRemove}
        />
      </>
    )
  }

  return (
    <>
      <div className={cn('flex gap-4', className)}>
        <Link href={`/product/${item.product.slug}`}>
          <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            <img
              src={image?.url}
              alt={image?.alt || item.product.name}
              className="w-full h-full object-cover"
            />
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <Link href={`/product/${item.product.slug}`}>
                <h4 className="font-medium line-clamp-2 hover:underline mb-1">
                  {item.product.name}
                </h4>
              </Link>
              <p className="text-xs text-muted-foreground uppercase mb-1">
                {item.product.brand}
              </p>
              {skuLabel ? <p className="text-xs text-muted-foreground">SKU: {skuLabel}</p> : null}
              {variantText && (
                <p className="text-sm text-muted-foreground">{variantText}</p>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveClick}
              className="h-8 w-8 p-0"
            >
              <X size={18} />
            </Button>
          </div>

          <div className="flex items-center justify-between mt-4">
            <QuantityInput
              value={item.quantity}
              onChange={(qty) => onQuantityChange(item.id, qty)}
              className="w-32"
            />
            <Price
              price={item.subtotal}
              currency={item.product.currency}
              size="md"
              className="font-semibold"
            />
          </div>

          <div className="mt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0 text-xs text-muted-foreground"
              onClick={() => setShowDetails((prev) => !prev)}
            >
              {showDetails ? 'Hide details' : 'View details'}
            </Button>

            {showDetails ? (
              <div className="mt-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                {skuLabel ? <div>SKU: <span className="font-medium text-foreground">{skuLabel}</span></div> : null}
                {variantText ? <div>Options: <span className="font-medium text-foreground">{variantText}</span></div> : null}
                <div className="flex items-center justify-between">
                  <span>Unit price</span>
                  <Price price={item.price} currency={item.product.currency} size="sm" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Quantity</span>
                  <span className="font-medium text-foreground">{item.quantity}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <Price price={item.subtotal} currency={item.product.currency} size="sm" />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Remove item from cart?"
        description={`Are you sure you want to remove "${item.product.name}" from your cart?`}
        confirmText="Remove"
        variant="destructive"
        onConfirm={handleConfirmRemove}
      />
    </>
  )
}
