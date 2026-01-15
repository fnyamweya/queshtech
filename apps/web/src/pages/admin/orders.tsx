import { useState } from 'react'
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
import { MagnifyingGlass, Eye } from '@phosphor-icons/react'
import { ChevronDown } from 'lucide-react'
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

const orders = [
  {
    id: 'ORD-001',
    customer: 'John Kamau',
    email: 'john.kamau@example.com',
    phone: '+254 712 345 678',
    address: 'Brookside Grove, Westlands, Nairobi',
    shippingMethod: 'Express',
    date: '2024-02-15',
    total: 'KES 149,999',
    status: 'completed',
    items: [
      { name: 'iPhone 15 Pro', qty: 1, price: 'KES 144,999' },
      { name: 'AppleCare+', qty: 1, price: 'KES 5,000' },
    ],
    shipping: 'Nairobi • Express',
    payment: 'M-Pesa • Paid',
  },
  {
    id: 'ORD-002',
    customer: 'Mary Wanjiku',
    email: 'mary.wanjiku@example.com',
    phone: '+254 723 456 789',
    address: 'Riat Estate, Nakuru',
    shippingMethod: 'Standard',
    date: '2024-02-14',
    total: 'KES 189,999',
    status: 'processing',
    items: [{ name: 'MacBook Air M2', qty: 1, price: 'KES 189,999' }],
    shipping: 'Nakuru • Standard',
    payment: 'Card • Authorized',
  },
  {
    id: 'ORD-003',
    customer: 'David Ochieng',
    email: 'david.ochieng@example.com',
    phone: '+254 734 567 890',
    address: 'Mega City, Kisumu',
    shippingMethod: 'Standard',
    date: '2024-02-14',
    total: 'KES 119,999',
    status: 'pending',
    items: [{ name: 'Samsung Galaxy S24', qty: 1, price: 'KES 119,999' }],
    shipping: 'Kisumu • Standard',
    payment: 'M-Pesa • Pending',
  },
  {
    id: 'ORD-004',
    customer: 'Grace Njeri',
    email: 'grace.njeri@example.com',
    phone: '+254 745 678 901',
    address: 'Kileleshwa, Nairobi',
    shippingMethod: 'Express',
    date: '2024-02-13',
    total: 'KES 44,999',
    status: 'completed',
    items: [{ name: 'Sony WH-1000XM5', qty: 1, price: 'KES 44,999' }],
    shipping: 'Nairobi • Express',
    payment: 'Card • Paid',
  },
  {
    id: 'ORD-005',
    customer: 'Peter Mwangi',
    email: 'peter.mwangi@example.com',
    phone: '+254 756 789 012',
    address: 'Nyali, Mombasa',
    shippingMethod: 'Overnight',
    date: '2024-02-13',
    total: 'KES 299,999',
    status: 'shipped',
    items: [
      { name: 'MacBook Pro M3', qty: 1, price: 'KES 295,000' },
      { name: 'USB-C Hub', qty: 1, price: 'KES 4,999' },
    ],
    shipping: 'Mombasa • Overnight',
    payment: 'M-Pesa • Paid',
  },
  {
    id: 'ORD-006',
    customer: 'Sarah Akinyi',
    email: 'sarah.akinyi@example.com',
    phone: '+254 798 123 456',
    address: 'Parklands, Nairobi',
    shippingMethod: 'Pickup',
    date: '2024-02-12',
    total: 'KES 79,999',
    status: 'cancelled',
    items: [{ name: 'Nintendo Switch OLED', qty: 1, price: 'KES 79,999' }],
    shipping: 'Nairobi • Pickup',
    payment: 'Refunded',
  },
]

const statusBadgeVariant = (status: string): NonNullable<Parameters<typeof badgeVariants>[0]>['variant'] => {
  switch (status) {
    case 'completed':
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
  shipped: 80,
  processing: 60,
  pending: 35,
  cancelled: 0,
}

const statusAccent = {
  completed: 'bg-[color:var(--color-status-success-solid)]',
  shipped: 'bg-[color:var(--color-status-info-solid)]',
  processing: 'bg-[color:var(--color-status-info-solid)]',
  pending: 'bg-[color:var(--color-status-warning-solid)]',
  cancelled: 'bg-[color:var(--color-status-danger-solid)]',
} as const

const statusLabel = (status: string) => {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function AdminOrdersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

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
              placeholder="Search orders..."
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
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
              {filteredOrders.flatMap((order) => {
                const isExpanded = expandedOrder === order.id
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
                    <TableCell className="font-mono text-sm">{order.id}</TableCell>
                    <TableCell className="font-medium">{order.customer}</TableCell>
                    <TableCell>{new Date(order.date).toLocaleDateString()}</TableCell>
                    <TableCell>{order.total}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(order.status)}>
                        {statusLabel(order.status)}
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
                  const steps = ['Placed', 'Paid', 'Packed', 'Shipped', 'Delivered']
                  const currentStep =
                    order.status === 'completed'
                      ? 5
                      : order.status === 'shipped'
                        ? 4
                        : order.status === 'processing'
                          ? 3
                          : order.status === 'pending'
                            ? 2
                            : 1

                  rows.push(
                    <TableRow className="bg-muted/40" key={`${order.id}-detail`}>
                      <TableCell colSpan={7}>
                        <div className="relative overflow-hidden rounded-lg border bg-card/70 p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Order</p>
                              <p className="text-sm font-semibold leading-tight">{order.id}</p>
                              <Badge variant={statusBadgeVariant(order.status)}>
                                {statusLabel(order.status)}
                              </Badge>
                            </div>
                            <div className="space-y-1 min-w-[200px]">
                              <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Customer</p>
                              <p className="text-sm font-semibold leading-tight">{order.customer}</p>
                              <p className="text-xs text-muted-foreground">{order.email}</p>
                              <p className="text-xs text-muted-foreground">{order.phone}</p>
                            </div>
                            <div className="space-y-1 min-w-[200px]">
                              <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Shipping</p>
                              <p className="text-sm font-semibold leading-tight">{order.shipping}</p>
                              <p className="text-xs text-muted-foreground">{order.address}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline">
                                Mark shipped
                              </Button>
                              <Button size="sm" variant="ghost">
                                Issue refund
                              </Button>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
                            <div className="rounded-md border bg-muted/30 px-3 py-2">
                              <p className="text-[11px] text-muted-foreground">Payment</p>
                              <p className="font-medium">{order.payment}</p>
                            </div>
                            <div className="rounded-md border bg-muted/30 px-3 py-2">
                              <p className="text-[11px] text-muted-foreground">Shipping method</p>
                              <p className="font-medium">{order.shippingMethod}</p>
                            </div>
                            <div className="rounded-md border bg-muted/30 px-3 py-2">
                              <p className="text-[11px] text-muted-foreground">Order total</p>
                              <p className="font-medium">{order.total}</p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-lg border bg-card/80">
                            <table className="w-full text-sm">
                              <thead className="text-xs text-muted-foreground">
                                <tr className="border-b">
                                  <th className="px-3 py-2 text-left font-medium">Item</th>
                                  <th className="px-3 py-2 text-left font-medium">Qty</th>
                                  <th className="px-3 py-2 text-left font-medium">Price</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map((item) => (
                                  <tr key={item.name} className="border-b last:border-0">
                                    <td className="px-3 py-2">{item.name}</td>
                                    <td className="px-3 py-2">{item.qty}</td>
                                    <td className="px-3 py-2 font-medium">{item.price}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-4">
                            <p className="text-[11px] uppercase text-muted-foreground tracking-wide mb-2">Fulfillment</p>
                            <div className="flex items-center gap-2">
                              {steps.map((step, idx) => {
                                const active = idx + 1 <= currentStep
                                return (
                                  <div key={step} className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        'h-7 min-w-[110px] rounded-full border px-3 text-xs font-semibold',
                                        active
                                          ? 'border-[color:var(--color-status-success-border)] bg-[color:var(--color-status-success-bg)] text-[color:var(--color-status-success-fg)]'
                                          : 'border-muted text-muted-foreground'
                                      )}
                                    >
                                      {step}
                                    </div>
                                    {idx < steps.length - 1 && <div className="h-px w-4 bg-border" />}
                                  </div>
                                )
                              })}
                            </div>
                            <Progress
                              value={statusProgress[order.status as keyof typeof statusProgress]}
                              className="mt-3 h-1.5 rounded-none bg-transparent"
                              indicatorClassName={cn(
                                statusAccent[order.status as keyof typeof statusAccent],
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
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  )
}
