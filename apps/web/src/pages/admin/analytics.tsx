import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartBar, TrendUp, Eye, ShoppingCart } from '@phosphor-icons/react'

export function AdminAnalyticsPage() {
  return (
    <AdminLayout
      title="Analytics"
      description="Performance KPIs and engagement insights across your funnels."
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Page Views', value: '45,231', icon: Eye, change: '+12.5%' },
            { title: 'Conversion Rate', value: '3.24%', icon: TrendUp, change: '+0.4%' },
            { title: 'Cart Adds', value: '1,847', icon: ShoppingCart, change: '+8.2%' },
            { title: 'Avg. Order Value', value: 'KES 172K', icon: ChartBar, change: '+15.3%' },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" weight="duotone" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-neon-green mt-1">{stat.change} from last month</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Analytics Overview</CardTitle>
            <CardDescription>Detailed analytics and insights coming soon</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
            <ChartBar className="h-16 w-16 mb-4" weight="duotone" />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
