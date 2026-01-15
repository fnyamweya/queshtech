import { useMemo, useState } from 'react'
import { useRoute, useLocation } from 'wouter'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, CheckCircle2, Truck, Clock, ReceiptText, Pencil, Plus, Trash2, CreditCard, RefreshCw, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GoogleMapDemo } from '@/components/admin/google-map-demo'

const statusColors = {
  completed: 'bg-neon-green/10 text-neon-green border-neon-green/20',
  processing: 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/20',
  pending: 'bg-vibrant-orange/10 text-vibrant-orange border-vibrant-orange/20',
  shipped: 'bg-electric-blue/10 text-electric-blue border-electric-blue/20',
  cancelled: 'bg-vivid-red/10 text-vivid-red border-vivid-red/20',
}

const statusProgress = {
  completed: 100,
  shipped: 80,
  processing: 60,
  pending: 35,
  cancelled: 0,
}

const statusAccent = {
  completed: 'bg-neon-green',
  shipped: 'bg-electric-blue',
  processing: 'bg-cyber-cyan',
  pending: 'bg-vibrant-orange',
  cancelled: 'bg-vivid-red',
}

type OrderItem = { name: string; qty: number; price: string }
type OrderDetail = {
  id: string
  customer: string
  email: string
  phone: string
  address: string
  shippingMethod: string
  date: string
  total: string
  status: string
  items: OrderItem[]
  shipping: string
  payment: string
  timeline?: { label: string; time: string; done: boolean }[]
}

const baseOrders: OrderDetail[] = [
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

const buildTimeline = (status: string, date: string) => {
  const base = [
    { label: 'Placed', time: date, done: true },
    { label: 'Paid', time: status !== 'pending' ? 'Paid' : 'Pending', done: status !== 'pending' && status !== 'cancelled' },
    { label: 'Packed', time: status === 'completed' || status === 'shipped' || status === 'processing' ? 'In progress' : 'Pending', done: status === 'completed' || status === 'shipped' || status === 'processing' },
    { label: 'Shipped', time: status === 'completed' || status === 'shipped' ? 'In transit' : 'Pending', done: status === 'completed' || status === 'shipped' },
    { label: 'Delivered', time: status === 'completed' ? 'Delivered' : 'Pending', done: status === 'completed' },
  ]
  return base
}

const orderData: OrderDetail[] = baseOrders.map((order) => ({
  ...order,
  timeline: order.timeline ?? buildTimeline(order.status, order.date),
}))

const transactionData = [
  { id: 'TRX-87421', amount: 'KES 149,999', method: 'M-Pesa', type: 'Charge', status: 'Captured', time: 'Feb 15, 09:13' },
  { id: 'TRX-87422', amount: 'KES 5,000', method: 'AppleCare+ Add-on', type: 'Charge', status: 'Captured', time: 'Feb 15, 09:14' },
  { id: 'TRX-87489', amount: 'KES 4,500', method: 'Partial Refund', type: 'Refund', status: 'Settled', time: 'Feb 16, 11:02' },
]

export function AdminOrderDetailPage() {
  const [, params] = useRoute('/axis/orders/:id')
  const [, setLocation] = useLocation()
  const order = useMemo(() => orderData.find((o) => o.id === params?.id), [params])
  const [items, setItems] = useState<OrderItem[]>(order ? order.items : [])
  const [shipping, setShipping] = useState({
    address: order?.address ?? '',
    phone: order?.phone ?? '',
    method: order?.shippingMethod ?? '',
    notes: '',
  })
  const [transactions, setTransactions] = useState(transactionData)
  const [paymentDraft, setPaymentDraft] = useState({ amount: '', method: '', reference: '' })
  const parsedOrderTotal = Number(order?.total.replace(/[^\d.]/g, '') || 0)
  const transactionTotal = transactions.reduce((sum, txn) => sum + Number(String(txn.amount).replace(/[^\d.]/g, '') || 0), 0)
  const isBalanced = parsedOrderTotal > 0 && Math.abs(parsedOrderTotal - transactionTotal) < 0.01

  if (!order) {
    return (
      <AdminLayout title="Order not found">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">No order matches this ID.</p>
          <Button className="mt-4" onClick={() => setLocation('/axis/orders')}>Back to orders</Button>
        </div>
      </AdminLayout>
    )
  }

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

  return (
    <AdminLayout
      title={`Order ${order.id}`}
      description="Full order context, fulfillment state, and actions."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setLocation('/axis/orders')} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Button>
        <Button size="sm" className="gap-1">
          <Truck className="h-4 w-4" />
          Mark shipped
        </Button>
        <Button variant="outline" size="sm" className="gap-1">
          <ReceiptText className="h-4 w-4" />
          Send invoice
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLocation(`/axis/customers/${order.id}`)}>
          View customer
        </Button>
        <Button size="sm" variant="outline">
          Create return
        </Button>
        {isBalanced && (
          <Badge className="bg-neon-green/15 text-neon-green border-neon-green/30">Paid in full</Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{order.customer}</CardTitle>
              <CardDescription>{order.email} • {order.phone}</CardDescription>
            </div>
            <Badge variant="outline" className={statusColors[order.status as keyof typeof statusColors]}>
              {order.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Order total</p>
                <p className="text-lg font-semibold">{order.total}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Payment</p>
                <p className="text-sm font-medium">{order.payment}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Shipping</p>
                <p className="text-sm font-medium">{order.shipping}</p>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Shipping address</p>
                  <p className="text-sm font-medium">{order.customer}</p>
                  <p className="text-sm text-muted-foreground">{shipping.address}</p>
                  <p className="text-sm text-muted-foreground">{shipping.phone}</p>
                  <p className="text-sm text-muted-foreground">Method: {shipping.method}</p>
                </div>
                <Badge variant="secondary" className="bg-amber-50 text-amber-800 border-amber-200">Warm route</Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Input
                  value={shipping.address}
                  onChange={(e) => setShipping((s) => ({ ...s, address: e.target.value }))}
                  placeholder="Update address"
                />
                <Input
                  value={shipping.phone}
                  onChange={(e) => setShipping((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="Update phone"
                />
                <Input
                  value={shipping.method}
                  onChange={(e) => setShipping((s) => ({ ...s, method: e.target.value }))}
                  placeholder="Shipping method"
                />
                <Input
                  value={shipping.notes}
                  onChange={(e) => setShipping((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Delivery notes"
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">Save address</Button>
                <Button size="sm" variant="outline">Send update to customer</Button>
              </div>
            </div>

            <div className="rounded-lg border bg-card/70 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="w-24">
                        <Input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => {
                            const qty = Number(e.target.value) || 1
                            setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty } : it)))
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-semibold">{item.price}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center gap-2 p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-amber-700"
                  onClick={() => setItems((prev) => [...prev, { name: 'Custom item', qty: 1, price: 'KES 0' }])}
                >
                  <Plus className="h-4 w-4" />
                  Add item
                </Button>
                <Button size="sm" variant="outline" className="gap-1">
                  <Pencil className="h-4 w-4" />
                  Recalculate total
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <GoogleMapDemo address={order.address} method={shipping.method} eta="3-5 PM" note="Driver contact shared after dispatch." />

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Fulfillment trail</CardTitle>
            <CardDescription>Track progression from checkout to delivery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress
              value={statusProgress[order.status as keyof typeof statusProgress]}
              className="h-2 rounded-none bg-transparent"
              indicatorClassName={statusAccent[order.status as keyof typeof statusAccent]}
            />
            <ul className="space-y-4">
              {order.timeline.map((event, idx) => (
                <li key={`${event.label}-${idx}`} className="relative flex gap-3">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border/80" />
                  <div className="mt-1 flex h-3 w-3 flex-none items-center justify-center rounded-full bg-muted-foreground/40 ring-2 ring-background" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        {event.done ? <CheckCircle2 className="h-4 w-4 text-neon-green" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                        {event.label}
                      </p>
                      <time className="text-[11px] text-muted-foreground">{event.time}</time>
                    </div>
                    {!event.done && (
                      <p className="text-xs text-muted-foreground">
                        Pending action to move to next step.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline">Add note</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Payments & transactions</CardTitle>
              <CardDescription>Charges, refunds, and risk review.</CardDescription>
            </div>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
              <Shield className="h-4 w-4 mr-1" />
              Risk clear
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-card/70 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="w-28"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="font-mono text-xs">{txn.id}</TableCell>
                      <TableCell>{txn.type}</TableCell>
                      <TableCell>{txn.method}</TableCell>
                      <TableCell className="font-semibold">{txn.amount}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">{txn.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{txn.time}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          {txn.type === 'Charge' && (
                            <Button variant="ghost" size="icon">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white gap-2">
                <RefreshCw className="h-4 w-4" />
                Issue refund
              </Button>
              <Button size="sm" variant="outline" className="gap-2">
                <ReceiptText className="h-4 w-4" />
                Resend receipt
              </Button>
            </div>
            <div className="rounded-lg border bg-amber-50/70 p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-900">Record a payment</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Amount (e.g. KES 5,000)"
                  value={paymentDraft.amount}
                  onChange={(e) => setPaymentDraft((p) => ({ ...p, amount: e.target.value }))}
                  className="bg-white"
                />
                <Input
                  placeholder="Method (e.g. M-Pesa, Card)"
                  value={paymentDraft.method}
                  onChange={(e) => setPaymentDraft((p) => ({ ...p, method: e.target.value }))}
                  className="bg-white"
                />
                <Input
                  placeholder="Reference"
                  value={paymentDraft.reference}
                  onChange={(e) => setPaymentDraft((p) => ({ ...p, reference: e.target.value }))}
                  className="bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => {
                    if (!paymentDraft.amount || !paymentDraft.method) return
                    setTransactions((prev) => [
                      {
                        id: `TRX-${Math.floor(Math.random() * 100000)}`,
                        amount: paymentDraft.amount,
                        method: paymentDraft.method,
                        type: 'Charge',
                        status: 'Captured',
                        time: 'Just now',
                      },
                      ...prev,
                    ])
                    setPaymentDraft({ amount: '', method: '', reference: '' })
                  }}
                >
                  <CreditCard className="h-4 w-4 mr-1" />
                  Record payment
                </Button>
                <p className="text-xs text-amber-900">Captured payments update totals automatically.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Notes & internal trail</CardTitle>
              <CardDescription>Keep teammates aligned on next actions.</CardDescription>
            </div>
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">Warm</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Add internal notes, call outcomes, or customer requests..."
              className="min-h-[120px]"
            />
            <div className="flex items-center gap-2">
              <Button size="sm">Save note</Button>
              <Button size="sm" variant="outline">Share with support</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
