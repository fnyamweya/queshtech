import { motion } from 'framer-motion'
import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
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
import type { CustomerOrderDetail } from '@/types/customer-orders'

interface OrderDetailModalProps {
  order: CustomerOrderDetail | null
  isOpen: boolean
  onClose: () => void
}

const statusColors = {
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  shipped: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  delivered: 'bg-green-500/10 text-green-700 dark:text-green-400',
  cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400',
  completed: 'bg-green-500/10 text-green-700 dark:text-green-400',
} as const

const statusIcons = {
  pending: Clock,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: X,
  completed: CheckCircle,
} as const

export function OrderDetailModal({ order, isOpen, onClose }: OrderDetailModalProps) {
  if (!order) return null

  const orderCurrency = order.currencyCode || order.items?.[0]?.currencyCode || ''

  const formatPrice = (price: number, currency?: string | null) => {
    const hasCurrency = typeof currency === 'string' && currency.trim().length > 0
    return new Intl.NumberFormat('en-KE', {
      style: hasCurrency ? 'currency' : 'decimal',
      currency: hasCurrency ? currency : undefined,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const StatusIcon = statusIcons[order.status as keyof typeof statusIcons] || Package
  const statusClass = statusColors[order.status as keyof typeof statusColors] || statusColors.pending
  const hasShipping =
    Boolean(order.shippingAddress?.address1) ||
    Boolean(order.shippingAddress?.city) ||
    Boolean(order.shippingAddress?.phone) ||
    Boolean(order.shippingAddressSummary)
  const hasPayment =
    Boolean(order.paymentMethod?.label) ||
    Boolean(order.paymentMethod?.type) ||
    Boolean(order.paymentSummary?.status)

  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof order.items>()
    for (const item of order.items || []) {
      const key = item.productName || 'Item'
      const list = groups.get(key) || []
      list.push(item)
      groups.set(key, list)
    }
    return Array.from(groups.entries())
  }, [order.items])

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
            <Badge className={cn('gap-2 px-3 py-1.5 border-0', statusClass)}>
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
            <div className="p-4 rounded-xl bg-muted/40">
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
            <div className="p-4 rounded-xl bg-muted/40">
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
                {groupedItems.map(([productName, items], index) => (
                  <motion.div
                    key={productName}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                    className="rounded-lg border bg-muted/20"
                  >
                    <div className="flex items-start gap-4 p-4">
                      {items[0]?.imageUrl ? (
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          <img
                            src={items[0].imageUrl}
                            alt={productName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-base">{productName}</div>
                        {items.length > 1 ? (
                          <div className="text-xs text-muted-foreground mt-1">{items.length} variants</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="border-t">
                      {items.map((item) => (
                        <div key={item.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium">
                                {item.productName || productName}
                              </div>
                              {item.skuTitle || item.sku ? (
                                <div className="text-xs text-muted-foreground">
                                  {item.skuTitle || item.sku}
                                </div>
                              ) : null}
                              {item.options && Object.keys(item.options).length > 0 ? (
                                <div className="text-xs text-muted-foreground">
                                  {Object.entries(item.options).map(([key, value]) => `${key}: ${value}`).join(' • ')}
                                </div>
                              ) : null}
                              {item.sku ? (
                                <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                              <span className="font-semibold">
                                {formatPrice(item.price, item.currencyCode || orderCurrency)}
                              </span>
                            </div>
                          </div>
                          {item.options && Object.keys(item.options).length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {Object.entries(item.options).map(([key, value]) => `${key}: ${value}`).join(' • ')}
                            </div>
                          )}
                        </div>
                      ))}
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
            <div className="p-4 rounded-xl bg-muted/30">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin size={18} weight="bold" className="text-primary" />
                Shipping Address
              </h3>
              {hasShipping ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  {(order.shippingName || order.shippingAddress?.firstName || order.shippingAddress?.lastName) && (
                    <div className="font-medium text-foreground">
                      {order.shippingName || `${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}`.trim()}
                    </div>
                  )}
                  {order.shippingAddressSummary ? <div>{order.shippingAddressSummary}</div> : null}
                  {order.shippingAddress?.address1 ? <div>{order.shippingAddress.address1}</div> : null}
                  {order.shippingAddress?.address2 ? <div>{order.shippingAddress.address2}</div> : null}
                  {order.shippingAddress?.city || order.shippingAddress?.state ? (
                    <div>
                      {order.shippingAddress?.city || '—'}
                      {order.shippingAddress?.state ? `, ${order.shippingAddress.state}` : ''}
                    </div>
                  ) : null}
                  {order.shippingAddress?.postalCode ? <div>{order.shippingAddress.postalCode}</div> : null}
                  {order.shippingPhone ? <div className="pt-1">{order.shippingPhone}</div> : null}
                  {order.shippingAddress?.phone && !order.shippingPhone ? <div className="pt-1">{order.shippingAddress.phone}</div> : null}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Not available yet.</div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-muted/30">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CreditCard size={18} weight="bold" className="text-primary" />
                Payment Method
              </h3>
              {hasPayment ? (
                <div className="text-sm text-muted-foreground">
                  {order.paymentMethod?.type ? (
                    <div className="font-medium text-foreground capitalize">{order.paymentMethod.type}</div>
                  ) : null}
                  {order.paymentMethod?.label ? <div className="mt-1">{order.paymentMethod.label}</div> : null}
                  {order.paymentSummary?.status ? (
                    <div className="mt-1">{order.paymentSummary.status}</div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Not available yet.</div>
              )}
            </div>
          </motion.div>

          <Separator />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-5 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5"
          >
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(order.subtotal, orderCurrency)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">-{formatPrice(order.discount, orderCurrency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span>{order.shipping === 0 ? 'Free' : formatPrice(order.shipping, orderCurrency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatPrice(order.tax, orderCurrency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatPrice(order.total, orderCurrency)}</span>
              </div>
            </div>
          </motion.div>

          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={() => window.open(`/track-order?order=${order.orderNumber}`, '_blank')}>
              <Truck size={18} weight="bold" />
              Track Order
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
