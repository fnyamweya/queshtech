import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge, type badgeVariants } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MagnifyingGlass, Eye, ShoppingCart } from '@phosphor-icons/react'
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Link } from 'wouter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useOrders } from '@/hooks/use-orders'

const statusBadgeVariant = (status: string): NonNullable<Parameters<typeof badgeVariants>[0]>['variant'] => {
  switch (status) {
    case 'completed':
    case 'delivered':
      return 'success'
    case 'processing':
      return 'info'
    case 'shipped':
      return 'info'
    case 'pending':
      return 'warning'
    case 'cancelled':
      return 'destructive'
    default:
      return 'outline'
  }
}

const statusProgress = {
  completed: 100,
  delivered: 100,
  shipped: 80,
  processing: 60,
  pending: 35,
  cancelled: 0,
}

const statusAccent = {
  completed: 'bg-[color:var(--color-status-success-solid)]',
  delivered: 'bg-[color:var(--color-status-success-solid)]',
  shipped: 'bg-[color:var(--color-status-info-solid)]',
  processing: 'bg-[color:var(--color-status-info-solid)]',
  pending: 'bg-[color:var(--color-status-warning-solid)]',
  cancelled: 'bg-[color:var(--color-status-danger-solid)]',
} as const

const statusLabel = (status: string) => {
  if (!status) return 'Unknown'
  const normalized = status.replace(/_/g, ' ')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const normalizeStatus = (status?: string) => (status || '').trim().toLowerCase()

const formatCurrency = (amount?: string, currency?: string) => {
  if (!amount) return '—'
  const value = Number.parseFloat(amount)
  if (Number.isNaN(value)) return currency ? `${amount} ${currency}` : amount

  const hasCurrency = typeof currency === 'string' && currency.trim().length > 0
  return new Intl.NumberFormat('en-KE', {
    style: hasCurrency ? 'currency' : 'decimal',
    currency: hasCurrency ? currency : undefined,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatDate = (value?: string) => {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatCustomer = (name?: string, email?: string) => name || email || 'Guest'

// Simple debounce hook
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

const PAGE_SIZE = 20

export function AdminOrdersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Debounce search for better performance
  const debouncedSearch = useDebouncedValue(searchTerm, 300)

  const { accessToken, isAuthenticated } = useAdminAuth()
  const { orders, pagination, isLoading, error, refresh } = useOrders({
    token: accessToken,
    page: currentPage,
    limit: PAGE_SIZE,
    enabled: isAuthenticated,
  })

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, statusFilter])

  const filteredOrders = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return orders.filter((order) => {
      const status = normalizeStatus(order.status)
      const matchesStatus = statusFilter === 'all' || status === statusFilter

      if (!q) return matchesStatus

      const haystack = [
        order.orderNumber,
        order.id,
        order.customerName,
        order.customerEmail,
        order.shippingName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return matchesStatus && haystack.includes(q)
    })
  }, [orders, debouncedSearch, statusFilter])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage)
      setExpandedOrder(null)
    }
  }

  return (
    <AdminLayout
      title="Orders"
      description="Monitor order status, customer info, and fulfillment health in one place."
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by order #, customer name, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={isLoading || !isAuthenticated}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {!isAuthenticated && (
          <div className="rounded-lg border border-muted bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Sign in as an admin to load orders.
          </div>
        )}

        {error && isAuthenticated && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Failed to load orders</p>
                <p className="text-xs text-destructive/80">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={refresh}>
                Retry
              </Button>
            </div>
          </div>
        )}

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`loading-${idx}`}>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-full bg-muted/50 p-4">
                        <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {searchTerm || statusFilter !== 'all'
                            ? 'No orders match your criteria'
                            : 'No orders yet'}
                        </p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          {searchTerm || statusFilter !== 'all'
                            ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                            : 'When customers place orders, they\'ll appear here for management and fulfillment.'}
                        </p>
                      </div>
                      {(searchTerm || statusFilter !== 'all') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchTerm('')
                            setStatusFilter('all')
                          }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.flatMap((order) => {
                  const isExpanded = expandedOrder === order.id
                  const normalizedStatus = normalizeStatus(order.status)
                  const rows = [
                    <TableRow className="group" key={`${order.id}-main`}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="transition-transform"
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        >
                          <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
                          <span className="sr-only">Toggle details</span>
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{order.orderNumber || order.id}</TableCell>
                      <TableCell className="font-medium">
                        {formatCustomer(order.customerName, order.customerEmail)}
                      </TableCell>
                      <TableCell>{formatDate(order.placedAt || order.createdAt)}</TableCell>
                      <TableCell>{formatCurrency(order.grandTotal, order.currencyCode)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(normalizedStatus)}>
                          {statusLabel(normalizedStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon" aria-label={`View order ${order.id}`}>
                          <Link href={`/axis/orders/${order.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>,
                  ]

                  if (isExpanded) {
                    const progressValue =
                      statusProgress[normalizedStatus as keyof typeof statusProgress] ?? 0

                    rows.push(
                      <TableRow className="bg-muted/40" key={`${order.id}-detail`}>
                        <TableCell colSpan={7}>
                          <div className="relative overflow-hidden rounded-lg border bg-card/70 p-4 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="space-y-1">
                                <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Order</p>
                                <p className="text-sm font-semibold leading-tight">{order.orderNumber || order.id}</p>
                                <Badge variant={statusBadgeVariant(normalizedStatus)}>
                                  {statusLabel(normalizedStatus)}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(order.placedAt || order.createdAt)}
                                </p>
                              </div>
                              <div className="space-y-1 min-w-[200px]">
                                <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Customer</p>
                                <p className="text-sm font-semibold leading-tight">
                                  {formatCustomer(order.customerName, order.customerEmail)}
                                </p>
                                <p className="text-xs text-muted-foreground">{order.customerEmail || '—'}</p>
                                <p className="text-xs text-muted-foreground">{order.shippingPhone || '—'}</p>
                              </div>
                              <div className="space-y-1 min-w-[200px]">
                                <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Shipping</p>
                                <p className="text-sm font-semibold leading-tight">
                                  {order.fulfillmentStatus ? statusLabel(order.fulfillmentStatus) : 'Unfulfilled'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {order.shippingAddressSummary || 'No shipping address'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
                              <div className="rounded-md border bg-muted/30 px-3 py-2">
                                <p className="text-[11px] text-muted-foreground">Payment</p>
                                <p className="font-medium">
                                  {order.paymentSummary?.status || order.financialStatus || '—'}
                                </p>
                              </div>
                              <div className="rounded-md border bg-muted/30 px-3 py-2">
                                <p className="text-[11px] text-muted-foreground">Items</p>
                                <p className="font-medium">{order.itemCount ?? 0} items</p>
                              </div>
                              <div className="rounded-md border bg-muted/30 px-3 py-2">
                                <p className="text-[11px] text-muted-foreground">Order total</p>
                                <p className="font-medium">
                                  {formatCurrency(order.grandTotal, order.currencyCode)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4">
                              <p className="text-[11px] uppercase text-muted-foreground tracking-wide mb-2">Status</p>
                              <Progress
                                value={progressValue}
                                className="mt-3 h-1.5 rounded-none bg-transparent"
                                indicatorClassName={cn(
                                  statusAccent[normalizedStatus as keyof typeof statusAccent] || 'bg-muted',
                                  'h-full'
                                )}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  }

                  return rows
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && !isLoading && (
          <div className="flex items-center justify-between px-2">
            <p className="text-sm text-muted-foreground">
              Showing {filteredOrders.length} of {pagination.total} orders
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{currentPage}</span>
                <span>/</span>
                <span>{pagination.totalPages}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= pagination.totalPages}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Single page info */}
        {pagination.total > 0 && pagination.totalPages === 1 && !isLoading && (
          <div className="flex items-center justify-center px-2">
            <p className="text-sm text-muted-foreground">
              Showing {filteredOrders.length} of {pagination.total} orders
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
