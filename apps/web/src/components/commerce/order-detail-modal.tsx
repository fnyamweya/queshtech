import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { GamerButton } from '@/components/ui/gamer-button'
import { 
  Package, 
  Truck, 
  MapPin, 
  CreditCard,
  Calendar,
  CheckCircle,
  Clock,
  X
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { Order } from '@/types'

interface OrderDetailModalProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
}

const statusColors = {
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  processing: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  shipped: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
  delivered: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
}

const statusIcons = {
  pending: Clock,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: X,
}

export function OrderDetailModal({ order, isOpen, onClose }: OrderDetailModalProps) {
  if (!order) return null

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const StatusIcon = statusIcons[order.status]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="p-2 rounded-lg bg-primary/10"
              >
                <Package size={24} weight="bold" className="text-primary" />
              </motion.div>
              <div>
                <div className="text-xl font-bold">Order Details</div>
                <div className="text-sm font-mono text-muted-foreground">{order.orderNumber}</div>
              </div>
            </div>
            <Badge className={cn('gap-2 px-3 py-1.5 border', statusColors[order.status])}>
              <StatusIcon size={16} weight="bold" />
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="p-4 rounded-xl bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={18} weight="bold" className="text-primary" />
                <span className="text-sm font-medium">Order Date</span>
              </div>
              <div className="text-base">
                {new Date(order.date).toLocaleDateString('en-KE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <Package size={18} weight="bold" className="text-primary" />
                <span className="text-sm font-medium">Items</span>
              </div>
              <div className="text-base">{order.items?.length || 0} item(s)</div>
            </div>
          </motion.div>

          <Separator />

          {order.items && order.items.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Package size={20} weight="bold" className="text-primary" />
                Order Items
              </h3>
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                    className="flex gap-4 p-3 rounded-lg border bg-card"
                  >
                    {item.product.images && item.product.images.length > 0 && (
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img 
                          src={item.product.images[0].url} 
                          alt={item.product.name} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium mb-1 line-clamp-2">{item.product.name}</div>
                      {Object.keys(item.selectedVariants).length > 0 && (
                        <div className="text-xs text-muted-foreground mb-1">
                          {Object.entries(item.selectedVariants).map(([key, value]) => `${key}: ${value}`).join(' • ')}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-sm text-muted-foreground">Qty: {item.quantity}</span>
                        <span className="font-semibold">{formatPrice(item.price)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          <Separator />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid md:grid-cols-2 gap-4"
          >
            <div className="p-4 rounded-xl border bg-card">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin size={18} weight="bold" className="text-primary" />
                Shipping Address
              </h3>
              {order.shippingAddress && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="font-medium text-foreground">
                    {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                  </div>
                  <div>{order.shippingAddress.address1}</div>
                  {order.shippingAddress.address2 && <div>{order.shippingAddress.address2}</div>}
                  <div>
                    {order.shippingAddress.city}, {order.shippingAddress.state}
                  </div>
                  <div>{order.shippingAddress.postalCode}</div>
                  {order.shippingAddress.phone && <div className="pt-1">{order.shippingAddress.phone}</div>}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border bg-card">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CreditCard size={18} weight="bold" className="text-primary" />
                Payment Method
              </h3>
              {order.paymentMethod && (
                <div className="text-sm text-muted-foreground">
                  <div className="font-medium text-foreground capitalize">{order.paymentMethod.type}</div>
                  <div className="mt-1">{order.paymentMethod.label}</div>
                </div>
              )}
            </div>
          </motion.div>

          <Separator />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-5 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20"
          >
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">-{formatPrice(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span>{order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatPrice(order.tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatPrice(order.total)}</span>
              </div>
            </div>
          </motion.div>

          <div className="flex gap-3 pt-2">
            <GamerButton variant="primary" className="flex-1" onClick={() => window.open(`/track-order?order=${order.orderNumber}`, '_blank')}>
              <Truck size={18} weight="bold" />
              Track Order
            </GamerButton>
            <GamerButton variant="secondary" className="flex-1" onClick={onClose}>
              Close
            </GamerButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
