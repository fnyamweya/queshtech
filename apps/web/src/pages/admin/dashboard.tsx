import { Fragment, useState } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Filter, PlusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ShoppingCart,
  CurrencyDollar,
  Users,
  Package,
  TrendUp,
  TrendDown,
} from '@phosphor-icons/react'

const stats = [
  {
    title: 'Gross revenue',
    value: 'KES 18.4M',
    change: '+12.5%',
    trend: 'up' as const,
    icon: CurrencyDollar,
  },
  {
    title: 'Open orders',
    value: '326',
    change: '-4.2%',
    trend: 'down' as const,
    icon: ShoppingCart,
  },
  {
    title: 'Avg. order value',
    value: 'KES 12.9K',
    change: '+3.1%',
    trend: 'up' as const,
    icon: Package,
  },
  {
    title: 'Conversion rate',
    value: '3.24%',
    change: '+0.4%',
    trend: 'up' as const,
    icon: Users,
  },
]

const fulfillmentMetrics = [
  { label: 'Orders fulfilled', value: 92, tone: 'success' as const },
  { label: 'Orders delayed', value: 6, tone: 'warn' as const },
  { label: 'Orders cancelled', value: 2, tone: 'alert' as const },
]

const funnelSteps = [
  { label: 'Product views', value: 13842, conversion: '100%' },
  { label: 'Add to cart', value: 5129, conversion: '37%' },
  { label: 'Checkout started', value: 2127, conversion: '15%' },
  { label: 'Orders completed', value: 1428, conversion: '10%' },
]

const timeline = [
  { time: '09:12', title: 'Priority order shipped', detail: 'ORD-1278 • Nairobi', badge: 'Fulfillment' },
  { time: '08:47', title: 'New customer signup', detail: 'Sarah W. • sarah.w@email.com', badge: 'Customers' },
  { time: '08:10', title: 'Low stock alert', detail: 'AirPods Pro 2 • 6 left', badge: 'Inventory' },
  { time: 'Yesterday', title: 'Payout initiated', detail: 'KES 824,500 to bank **** 3412', badge: 'Finance' },
]

const taskCards = [
  { title: 'Reconcile refunds', due: 'Today 2:00 PM', priority: 'critical', tag: 'Finance' },
  { title: 'Launch accessories push', due: 'Tomorrow 9:00 AM', priority: 'high', tag: 'Growth' },
  { title: 'QA mobile checkout', due: 'Oct 12', priority: 'medium', tag: 'Quality' },
]

const channelPerformance = [
  { channel: 'Organic', revenue: 'KES 6.2M', change: '+9%', share: 34 },
  { channel: 'Paid', revenue: 'KES 4.8M', change: '+12%', share: 26 },
  { channel: 'Email/CRM', revenue: 'KES 3.1M', change: '+4%', share: 18 },
  { channel: 'Social', revenue: 'KES 2.7M', change: '+6%', share: 15 },
]


const priorityStyles: Record<string, string> = {
  critical: 'bg-vivid-red/10 text-vivid-red border-vivid-red/30',
  high: 'bg-vibrant-orange/10 text-vibrant-orange border-vibrant-orange/30',
  medium: 'bg-electric-blue/10 text-electric-blue border-electric-blue/30',
}

const recentOrders = [
  {
    id: 'ORD-001',
    customer: 'John Kamau',
    product: 'iPhone 15 Pro',
    amount: 'KES 149,999',
    status: 'completed',
    channel: 'Web',
    placed: '09:12 • Today',
    payment: 'M-Pesa • Paid',
  },
  {
    id: 'ORD-002',
    customer: 'Mary Wanjiku',
    product: 'MacBook Air M2',
    amount: 'KES 189,999',
    status: 'processing',
    channel: 'Mobile',
    placed: '08:47 • Today',
    payment: 'Card • Authorized',
  },
  {
    id: 'ORD-003',
    customer: 'David Ochieng',
    product: 'Samsung Galaxy S24',
    amount: 'KES 119,999',
    status: 'pending',
    channel: 'Storefront',
    placed: '08:10 • Today',
    payment: 'M-Pesa • Pending',
  },
  {
    id: 'ORD-004',
    customer: 'Grace Njeri',
    product: 'Sony WH-1000XM5',
    amount: 'KES 44,999',
    status: 'completed',
    channel: 'Web',
    placed: 'Yesterday',
    payment: 'Card • Paid',
  },
]

const statusColors = {
  completed: 'bg-neon-green/10 text-neon-green border-neon-green/20',
  processing: 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/20',
  pending: 'bg-vibrant-orange/10 text-vibrant-orange border-vibrant-orange/20',
}

export function AdminDashboardPage() {
  const cardHeaderPad = 'px-5 py-4'
  const cardContentPad = 'px-5 pb-5'
  const statsPad = 'px-4 py-4'
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  return (
    <AdminLayout
      title="Dashboard"
      description="Live snapshot of revenue, orders, and catalog performance across the store."
      actions={
        <>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button size="sm" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Create order
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            const TrendIcon = stat.trend === 'up' ? TrendUp : TrendDown
            return (
              <Card key={stat.title} className="shadow-sm border-muted/60">
                <CardHeader className="flex flex-row items-start justify-between pb-1 px-4 pt-3">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold text-foreground">{stat.title}</CardTitle>
                    <p className="text-[11px] text-muted-foreground">Last 30 days</p>
                  </div>
                  <Icon className="h-4 w-4 text-muted-foreground" weight="duotone" />
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-xl font-bold tracking-tight">{stat.value}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="inline-flex items-center gap-1 rounded-full border border-muted/70 bg-muted/60 px-2 py-1">
                      <TrendIcon className={`h-3.5 w-3.5 ${stat.trend === 'up' ? 'text-neon-green' : 'text-vivid-red'}`} weight="bold" />
                      <span className={`text-xs font-semibold ${stat.trend === 'up' ? 'text-neon-green' : 'text-vivid-red'}`}>
                        {stat.change}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">vs last month</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="shadow-sm">
              <CardHeader className={cardHeaderPad}>
                <CardTitle>Recent orders</CardTitle>
                <CardDescription>Latest activity with fulfillment state.</CardDescription>
              </CardHeader>
              <CardContent className={cardContentPad}>
                <div className="rounded-lg border bg-card">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-medium">Order</th>
                        <th className="px-3 py-2 text-left font-medium">Customer</th>
                        <th className="px-3 py-2 text-left font-medium">Item</th>
                        <th className="px-3 py-2 text-left font-medium">Amount</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => {
                        const isExpanded = expandedOrder === order.id
                        return (
                          <Fragment key={order.id}>
                            <tr
                              className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                              onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                            >
                              <td className="px-3 py-2 font-mono text-xs">{order.id}</td>
                              <td className="px-3 py-2">{order.customer}</td>
                              <td className="px-3 py-2">{order.product}</td>
                              <td className="px-3 py-2 font-semibold">{order.amount}</td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className={statusColors[order.status as keyof typeof statusColors]}>
                                  {order.status}
                                </Badge>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="border-b last:border-0 bg-muted/20">
                                <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={5}>
                                  <div className="flex flex-wrap items-center gap-4">
                                    <span>Channel: <strong className="text-foreground">{order.channel}</strong></span>
                                    <span>Placed: <strong className="text-foreground">{order.placed}</strong></span>
                                    <span>Payment: <strong className="text-foreground">{order.payment}</strong></span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className={cardHeaderPad}>
                <CardTitle>Fulfillment health</CardTitle>
                <CardDescription>Where orders are in the pipeline.</CardDescription>
              </CardHeader>
              <CardContent className={cn('space-y-4', cardContentPad)}>
                {fulfillmentMetrics.map((metric) => {
                  const tone =
                    metric.tone === 'success'
                      ? 'text-neon-green'
                      : metric.tone === 'warn'
                        ? 'text-vibrant-orange'
                        : 'text-vivid-red'
                  const bar =
                    metric.tone === 'success'
                      ? 'bg-neon-green'
                      : metric.tone === 'warn'
                        ? 'bg-vibrant-orange'
                        : 'bg-vivid-red'

                  return (
                    <div key={metric.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{metric.label}</span>
                        <span className={tone}>{metric.value}%</span>
                      </div>
                      <Progress value={metric.value} className="h-2" indicatorClassName={bar} />
                    </div>
                  )
                })}
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Avg. delivery</p>
                    <p className="text-base font-semibold">1.8 days</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Return rate</p>
                    <p className="text-base font-semibold">2.4%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className={cardHeaderPad}>
                <CardTitle>Operations timeline</CardTitle>
                <CardDescription>High-signal updates across the last 24 hours.</CardDescription>
              </CardHeader>
              <CardContent className={cn('space-y-2', cardContentPad)}>
                {timeline.map((item, index) => (
                  <div key={item.title} className="grid grid-cols-[70px_1fr] gap-2">
                    <div className="text-[11px] text-muted-foreground pt-1">{item.time}</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="uppercase tracking-wide text-[10px] px-2 py-0.5">
                          {item.badge}
                        </Badge>
                        {index < timeline.length - 1 && <div className="h-full w-px bg-border/80" aria-hidden />}
                      </div>
                      <p className="text-sm font-medium leading-tight">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                      {index < timeline.length - 1 && <Separator className="mt-1" />}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className={cardHeaderPad}>
                <CardTitle>Revenue by channel</CardTitle>
                <CardDescription>Where growth is coming from.</CardDescription>
              </CardHeader>
              <CardContent className={cardContentPad}>
                <div className="rounded-lg border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-medium">Channel</th>
                        <th className="px-3 py-2 text-left font-medium">Revenue</th>
                        <th className="px-3 py-2 text-left font-medium">Change</th>
                        <th className="px-3 py-2 text-left font-medium">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channelPerformance.map((channel) => (
                        <tr key={channel.channel} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{channel.channel}</td>
                          <td className="px-3 py-2 text-muted-foreground">{channel.revenue}</td>
                          <td className="px-3 py-2 text-muted-foreground">{channel.change}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Progress value={channel.share} className="h-1.5 w-24" />
                              <span className="text-xs text-muted-foreground">{channel.share}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className={cardHeaderPad}>
                <CardTitle>Top products</CardTitle>
                <CardDescription>Best selling items this month.</CardDescription>
              </CardHeader>
              <CardContent className={cardContentPad}>
                <div className="rounded-lg border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-medium">Rank</th>
                        <th className="px-3 py-2 text-left font-medium">Product</th>
                        <th className="px-3 py-2 text-left font-medium">Sales</th>
                        <th className="px-3 py-2 text-left font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'iPhone 15 Pro Max', sales: 127, revenue: 'KES 19.0M' },
                        { name: 'MacBook Pro M3', sales: 89, revenue: 'KES 26.7M' },
                        { name: 'AirPods Pro 2', sales: 234, revenue: 'KES 8.2M' },
                        { name: 'Samsung Galaxy S24 Ultra', sales: 156, revenue: 'KES 23.4M' },
                      ].map((product, index) => (
                        <tr key={product.name} className="border-b last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">#{index + 1}</td>
                          <td className="px-3 py-2 font-medium">{product.name}</td>
                          <td className="px-3 py-2">{product.sales}</td>
                          <td className="px-3 py-2 font-semibold">{product.revenue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className={cardHeaderPad}>
                <CardTitle>Tasks at a glance</CardTitle>
                <CardDescription>High-priority admin actions.</CardDescription>
              </CardHeader>
              <CardContent className={cardContentPad}>
                <div className="rounded-lg border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-medium">Task</th>
                        <th className="px-3 py-2 text-left font-medium">Tag</th>
                        <th className="px-3 py-2 text-left font-medium">Priority</th>
                        <th className="px-3 py-2 text-left font-medium">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskCards.map((task) => (
                        <tr key={task.title} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{task.title}</td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary">{task.tag}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={priorityStyles[task.priority] ?? ''}>{task.priority}</Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{task.due}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
