import { useEffect, useState } from 'react'
import { useRoute, Link } from 'wouter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Package,
  CreditCard,
  Truck,
  Receipt,
  User,
  Phone,
  MapPin,
  Tag,
  Percent,
  CurrencyCircleDollar,
  Info,
  CheckCircle,
  Clock,
  XCircle,
  ShoppingCart,
  CaretRight,
  Warehouse,
  ListBullets,
} from '@phosphor-icons/react'
import { useAuth } from '@/hooks/use-auth'
import { useCustomerOrders } from '@/hooks/use-customer-orders'
import type { CustomerOrderDetail, CustomerOrderLineItem, OrderBatch } from '@/types/customer-orders'
import { cn } from '@/lib/utils'

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  pending: { color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200', icon: Clock, label: 'Pending' },
  processing: { color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200', icon: Clock, label: 'Processing' },
  ready_for_payment: { color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200', icon: CreditCard, label: 'Ready for Payment' },
  shipped: { color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200', icon: Truck, label: 'Shipped' },
  delivered: { color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200', icon: CheckCircle, label: 'Delivered' },
  completed: { color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200', icon: CheckCircle, label: 'Completed' },
  cancelled: { color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200', icon: XCircle, label: 'Cancelled' },
}

const paymentStatusConfig: Record<string, { color: string; label: string }> = {
  unpaid: { color: 'text-red-600 bg-red-50 border-red-200', label: 'Unpaid' },
  pending: { color: 'text-yellow-600 bg-yellow-50 border-yellow-200', label: 'Payment Pending' },
  paid: { color: 'text-green-600 bg-green-50 border-green-200', label: 'Paid' },
  partial: { color: 'text-orange-600 bg-orange-50 border-orange-200', label: 'Partially Paid' },
  refunded: { color: 'text-purple-600 bg-purple-50 border-purple-200', label: 'Refunded' },
}

const fulfillmentStatusConfig: Record<string, { color: string; label: string }> = {
  unfulfilled: { color: 'text-gray-600 bg-gray-50 border-gray-200', label: 'Unfulfilled' },
  partial: { color: 'text-orange-600 bg-orange-50 border-orange-200', label: 'Partially Fulfilled' },
  fulfilled: { color: 'text-green-600 bg-green-50 border-green-200', label: 'Fulfilled' },
  shipped: { color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Shipped' },
  delivered: { color: 'text-green-600 bg-green-50 border-green-200', label: 'Delivered' },
}

const formatPrice = (price: number, currency?: string | null) => {
  const hasCurrency = typeof currency === 'string' && currency.trim().length > 0
  return new Intl.NumberFormat('en-KE', {
    style: hasCurrency ? 'currency' : 'decimal',
    currency: hasCurrency ? currency : undefined,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function OrderStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.pending
  const Icon = config.icon
  return (
    <Badge className={cn('px-3 py-1.5 border gap-1.5 font-medium', config.color)}>
      <Icon size={14} weight="bold" />
      {config.label}
    </Badge>
  )
}

function StatusCard({ label, value, config }: { label: string; value?: string; config: Record<string, { color: string; label: string }> }) {
  const normalizedValue = (value || '').toLowerCase()
  const statusInfo = config[normalizedValue] || { color: 'text-gray-600 bg-gray-50 border-gray-200', label: value || '—' }
  return (
    <div className={cn('rounded-lg border p-3', statusInfo.color)}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="font-semibold capitalize">{statusInfo.label}</div>
    </div>
  )
}

function PriceBreakdown({ label, amount, currency, type = 'normal', rate }: {
  label: string
  amount: number
  currency?: string
  type?: 'normal' | 'discount' | 'tax' | 'total'
  rate?: number
}) {
  const colorClass = {
    normal: 'text-foreground',
    discount: 'text-green-600',
    tax: 'text-muted-foreground',
    total: 'text-foreground font-bold text-lg',
  }[type]

  return (
    <div className={cn('flex justify-between items-center', colorClass)}>
      <span className="flex items-center gap-2">
        {label}
        {rate != null && <span className="text-xs text-muted-foreground">({(rate * 100).toFixed(0)}%)</span>}
      </span>
      <span>{type === 'discount' && amount > 0 ? '-' : ''}{formatPrice(amount, currency)}</span>
    </div>
  )
}

function ItemCard({ item, currency }: { item: CustomerOrderLineItem; currency?: string }) {
  const pricing = item.pricing
  const hasComponents = pricing?.components && pricing.components.length > 0

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4">
        <div className="flex gap-4">
          {/* Product Image */}
          <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.productTitle || 'Product'} className="w-full h-full object-cover" />
            ) : (
              <Package size={32} className="text-muted-foreground" />
            )}
          </div>

          {/* Product Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="flex-1">
                <h4 className="font-semibold text-base leading-tight">
                  {item.productTitle || item.name}
                </h4>
                {item.skuTitle && item.skuTitle !== item.productTitle && (
                  <p className="text-sm text-muted-foreground mt-0.5">{item.skuTitle}</p>
                )}
                {item.productShortDescription && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.productShortDescription}</p>
                )}
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{formatPrice(pricing?.total ?? item.total ?? item.price, currency)}</div>
                {pricing && pricing.unitPrice !== pricing.total && (
                  <div className="text-xs text-muted-foreground">
                    {formatPrice(pricing.unitPrice, currency)} × {item.quantity}
                  </div>
                )}
              </div>
            </div>

            {/* SKU & Quantity Info */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
              {item.sku && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted">
                  <Tag size={12} />
                  SKU: {item.sku}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted">
                <ShoppingCart size={12} />
                Qty: {item.quantity}
              </span>
            </div>

            {/* Options/Variants */}
            {item.options && Object.keys(item.options).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(item.options).map(([key, value]) => (
                  <span key={key} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {key}: {value}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Components Breakdown */}
      {hasComponents && (
        <>
          <Separator />
          <div className="p-4 bg-muted/30">
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Receipt size={12} />
              Price Breakdown
            </div>
            <div className="space-y-1.5 text-sm">
              {pricing.components.map((component, idx) => {
                let type: 'normal' | 'discount' | 'tax' = 'normal'
                let Icon = CurrencyCircleDollar
                if (component.type === 'DISCOUNT') {
                  type = 'discount'
                  Icon = Percent
                } else if (component.type === 'TAX') {
                  type = 'tax'
                  Icon = Receipt
                }
                return (
                  <div key={idx} className={cn('flex justify-between items-center', {
                    'text-green-600': type === 'discount',
                    'text-muted-foreground': type === 'tax',
                  })}>
                    <span className="flex items-center gap-1.5">
                      <Icon size={12} />
                      {component.name}
                      {component.rate != null && (
                        <span className="text-xs opacity-70">({(component.rate * 100).toFixed(0)}%)</span>
                      )}
                    </span>
                    <span>
                      {type === 'discount' ? '-' : ''}
                      {formatPrice(component.amount, currency)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const batchStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-500/10 text-yellow-700 border-yellow-200', label: 'Pending' },
  processing: { color: 'bg-blue-500/10 text-blue-700 border-blue-200', label: 'Processing' },
  ready: { color: 'bg-purple-500/10 text-purple-700 border-purple-200', label: 'Ready for Pickup' },
  shipped: { color: 'bg-indigo-500/10 text-indigo-700 border-indigo-200', label: 'Shipped' },
  delivered: { color: 'bg-green-500/10 text-green-700 border-green-200', label: 'Delivered' },
  cancelled: { color: 'bg-red-500/10 text-red-700 border-red-200', label: 'Cancelled' },
}

function BatchCard({ batch, batchNumber, orderItems, currency }: {
  batch: OrderBatch
  batchNumber: number
  orderItems: CustomerOrderLineItem[]
  currency?: string
}) {
  const statusInfo = batchStatusConfig[(batch.status || 'pending').toLowerCase()] || batchStatusConfig.pending

  // Map batch items to order items for display
  const batchItemsWithDetails = batch.items.map((batchItem) => {
    const orderItem = orderItems.find((item) => item.id === batchItem.orderItemId)
    return {
      ...batchItem,
      orderItem,
    }
  })

  return (
    <div className="rounded-lg border">
      <div className="p-4 bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Package size={16} className="text-primary" />
          </div>
          <div>
            <h4 className="font-medium">Shipment {batchNumber}</h4>
            <p className="text-xs text-muted-foreground">
              {batch.items.length} item{batch.items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Badge className={cn('px-2 py-1 border', statusInfo.color)}>
          {statusInfo.label}
        </Badge>
      </div>
      <div className="p-4 space-y-3">
        {batchItemsWithDetails.map((batchItem) => (
          <div key={batchItem.id} className="flex items-center gap-3">
            {/* Item Thumbnail */}
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {batchItem.orderItem?.imageUrl ? (
                <img src={batchItem.orderItem.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Package size={16} className="text-muted-foreground" />
              )}
            </div>
            {/* Item Details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {batchItem.orderItem?.productTitle || batchItem.orderItem?.name || 'Unknown Item'}
              </p>
              {batchItem.orderItem?.sku && (
                <p className="text-xs text-muted-foreground">SKU: {batchItem.orderItem.sku}</p>
              )}
            </div>
            {/* Quantity */}
            <div className="text-right">
              <span className="text-sm font-medium">×{batchItem.quantity}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CustomerOrderDetailPage() {
  const [, params] = useRoute('/orders/:id')
  const orderId = params?.id
  const { accessToken, isAuthenticated } = useAuth()
  const { getOrderDetail } = useCustomerOrders({ token: accessToken, enabled: isAuthenticated })

  const [order, setOrder] = useState<CustomerOrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId || !isAuthenticated) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)
    setError(null)

    ;(async () => {
      try {
        const detail = await getOrderDetail(orderId)
        if (!isMounted) return
        setOrder(detail)
      } catch (e: any) {
        if (!isMounted) return
        setError(e?.message || 'Unable to load order')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [getOrderDetail, isAuthenticated, orderId])

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Sign in to view your order.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" className="gap-2">
          <Link href="/profile/orders">
            <ArrowLeft size={16} weight="bold" />
            Back to orders
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading order details...
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : order ? (
        <div className="space-y-6">
          {/* Order Header */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-bold">Order {order.orderNumber}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{formatDate(order.date)}</p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Cards */}
              <div className="grid gap-3 sm:grid-cols-3">
                <StatusCard label="Payment Status" value={order.financialStatus} config={paymentStatusConfig} />
                <StatusCard label="Fulfillment" value={order.fulfillmentStatus} config={fulfillmentStatusConfig} />
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Items</div>
                  <div className="font-semibold">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package size={20} weight="bold" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item) => (
                <ItemCard key={item.id} item={item} currency={order.currencyCode} />
              ))}
            </CardContent>
          </Card>

          {/* Order Summary & Contact Info */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt size={20} weight="bold" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <PriceBreakdown label="Subtotal" amount={order.subtotal || 0} currency={order.currencyCode} />
                {(order.discount ?? 0) > 0 && (
                  <PriceBreakdown label="Discount" amount={order.discount || 0} currency={order.currencyCode} type="discount" />
                )}
                <PriceBreakdown label="Shipping" amount={order.shipping || 0} currency={order.currencyCode} />
                <PriceBreakdown label="Tax" amount={order.tax || 0} currency={order.currencyCode} type="tax" />
                <Separator className="my-2" />
                <PriceBreakdown label="Total" amount={order.total || 0} currency={order.currencyCode} type="total" />

                {order.paymentSummary && order.paymentSummary.netPaidTotal != null && order.paymentSummary.netPaidTotal > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center text-green-600">
                      <span className="flex items-center gap-2">
                        <CheckCircle size={16} />
                        Amount Paid
                      </span>
                      <span>{formatPrice(order.paymentSummary.netPaidTotal, order.currencyCode)}</span>
                    </div>
                    {order.total && order.paymentSummary.netPaidTotal < order.total && (
                      <div className="flex justify-between items-center text-orange-600 font-medium">
                        <span>Balance Due</span>
                        <span>{formatPrice(order.total - order.paymentSummary.netPaidTotal, order.currencyCode)}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Contact & Delivery Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck size={20} weight="bold" />
                  Delivery Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Contact Name */}
                {(order.shippingAddress?.firstName || order.shippingAddress?.lastName || order.shippingName) && (
                  <div className="flex items-start gap-3">
                    <User size={18} className="text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Contact Name</div>
                      <div className="font-medium">
                        {order.shippingAddress?.firstName || order.shippingAddress?.lastName
                          ? `${order.shippingAddress.firstName || ''} ${order.shippingAddress.lastName || ''}`.trim()
                          : order.shippingName}
                      </div>
                    </div>
                  </div>
                )}

                {/* Phone */}
                {(order.shippingAddress?.phone || order.shippingPhone) && (
                  <div className="flex items-start gap-3">
                    <Phone size={18} className="text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Phone</div>
                      <div className="font-medium">{order.shippingAddress?.phone || order.shippingPhone}</div>
                    </div>
                  </div>
                )}

                {/* Location Hierarchy - Country to most specific location */}
                {order.shippingAddress?.locationHierarchy && order.shippingAddress.locationHierarchy.length > 0 ? (
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1.5">Delivery Location</div>
                      {/* Country */}
                      {order.shippingAddress.countryName && (
                        <div className="font-medium text-sm mb-1">{order.shippingAddress.countryName}</div>
                      )}
                      {/* Location Breadcrumb */}
                      <div className="flex flex-wrap items-center gap-1 text-sm">
                        {order.shippingAddress.locationHierarchy.map((loc, idx) => (
                          <span key={loc.id} className="flex items-center gap-1">
                            {idx > 0 && <CaretRight size={12} className="text-muted-foreground" />}
                            <span className={idx === order.shippingAddress!.locationHierarchy.length - 1 ? 'font-medium text-primary' : 'text-muted-foreground'}>
                              {loc.name}
                            </span>
                          </span>
                        ))}
                      </div>
                      {/* Location Types with display names */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {order.shippingAddress.locationHierarchy.map((loc) => (
                          <span key={loc.id} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {loc.typeDisplay || loc.type.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : order.shippingAddressSummary ? (
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Delivery Address</div>
                      <div className="font-medium">{order.shippingAddressSummary}</div>
                    </div>
                  </div>
                ) : null}

                {/* Additional Fields from shipping address */}
                {order.shippingAddress?.fields && Object.keys(order.shippingAddress.fields).length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 mt-2">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Additional Details</div>
                    <div className="grid gap-2 text-sm">
                      {Object.entries(order.shippingAddress.fields).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!order.shippingAddress && !order.shippingName && !order.shippingPhone && !order.shippingAddressSummary && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Info size={16} />
                    No delivery information available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Shipment Batches */}
          {order.batches && order.batches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Warehouse size={20} weight="bold" />
                  Shipments ({order.batches.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.batches.map((batch, batchIdx) => (
                  <BatchCard
                    key={batch.id}
                    batch={batch}
                    batchNumber={batchIdx + 1}
                    orderItems={order.items}
                    currency={order.currencyCode}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Customer Notes */}
          {order.notesCustomer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info size={20} weight="bold" />
                  Order Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notesCustomer}</p>
              </CardContent>
            </Card>
          )}

          {/* Payment CTA for unpaid orders */}
          {order.status === 'ready_for_payment' && order.financialStatus === 'unpaid' && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CreditCard size={24} className="text-primary" />
                    <div>
                      <h3 className="font-semibold">Complete Your Payment</h3>
                      <p className="text-sm text-muted-foreground">Your order is ready. Pay now to proceed with fulfillment.</p>
                    </div>
                  </div>
                  <Button asChild size="lg">
                    <Link href={`/pay/${order.id}`}>
                      Pay {formatPrice(order.total || 0, order.currencyCode)}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">Order not found.</CardContent>
        </Card>
      )}
    </div>
  )
}
