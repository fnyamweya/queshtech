import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { GamerButton } from '@/components/ui/gamer-button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Clock,
  Phone,
  Envelope,
  MagnifyingGlass,
  ArrowRight,
  WarningCircle,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface OrderStatus {
  status: 'processing' | 'shipped' | 'in-transit' | 'out-for-delivery' | 'delivered'
  timestamp: string
  location?: string
  description: string
}

const mockOrderData = {
  orderNumber: 'QT-2024-00A1B2C3',
  estimatedDelivery: '25th Jan, 2024',
  carrier: 'DHL Express',
  trackingNumber: 'DHL-KE-789456123',
  customer: {
    name: 'Alex Kamau',
    email: 'alex@example.com',
    phone: '+254 712 345 678',
  },
  deliveryAddress: {
    street: '123 Kimathi Street',
    city: 'Nairobi',
    county: 'Nairobi',
    postalCode: '00100',
  },
  items: [
    {
      id: '1',
      name: 'Galaxy Pro X1 Smartphone',
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80',
    },
  ],
  statusHistory: [
    {
      status: 'processing' as const,
      timestamp: '20th Jan, 2024 - 10:30 AM',
      description: 'Order received and being prepared',
    },
    {
      status: 'shipped' as const,
      timestamp: '21st Jan, 2024 - 02:15 PM',
      location: 'QueshTech Warehouse, Nairobi',
      description: 'Package handed over to carrier',
    },
    {
      status: 'in-transit' as const,
      timestamp: '22nd Jan, 2024 - 09:45 AM',
      location: 'DHL Sorting Facility, Nairobi',
      description: 'In transit to delivery hub',
    },
    {
      status: 'out-for-delivery' as const,
      timestamp: '23rd Jan, 2024 - 08:00 AM',
      location: 'Out for delivery - Nairobi Central',
      description: 'Package is on the delivery vehicle',
    },
  ],
}

const statusConfig = {
  processing: { icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Processing' },
  shipped: { icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Shipped' },
  'in-transit': { icon: Truck, color: 'text-cyan-500', bg: 'bg-cyan-500/10', label: 'In Transit' },
  'out-for-delivery': { icon: Truck, color: 'text-primary', bg: 'bg-primary/10', label: 'Out for Delivery' },
  delivered: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: 'Delivered' },
}

export function TrackOrderPage() {
  const [trackingInput, setTrackingInput] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = () => {
    setHasSearched(true)
  }

  const currentStatus = mockOrderData.statusHistory[mockOrderData.statusHistory.length - 1].status
  const StatusIcon = statusConfig[currentStatus].icon

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-cyber-cyan/5 border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-primary/10">
                <Package size={32} weight="bold" className="text-primary" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Track Your Order
            </h1>
            <p className="text-muted-foreground text-lg mb-8">
              Enter your order number or tracking ID to get real-time updates
            </p>

            <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
              <Input
                placeholder="Order number or tracking ID"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                className="h-12 text-base"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <GamerButton size="lg" className="h-12 px-6" onClick={handleSearch} variant="primary">
                <MagnifyingGlass size={20} weight="bold" />
                Track Order
              </GamerButton>
            </div>
          </motion.div>
        </div>
      </div>

      {hasSearched && (
        <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-8 sm:py-12">
          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Order Number</div>
                      <div className="font-mono font-bold text-lg">{mockOrderData.orderNumber}</div>
                    </div>
                    <Badge className={cn('gap-2 px-4 py-2 text-base', statusConfig[currentStatus].bg, statusConfig[currentStatus].color)}>
                      <StatusIcon size={20} weight="bold" />
                      {statusConfig[currentStatus].label}
                    </Badge>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mb-8">
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                      <Clock size={20} weight="bold" className="text-primary mt-0.5" />
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Estimated Delivery</div>
                        <div className="font-semibold">{mockOrderData.estimatedDelivery}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                      <Truck size={20} weight="bold" className="text-primary mt-0.5" />
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Carrier</div>
                        <div className="font-semibold">{mockOrderData.carrier}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{mockOrderData.trackingNumber}</div>
                      </div>
                    </div>
                  </div>

                  <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
                    <MapPin size={20} weight="bold" className="text-primary" />
                    Tracking Timeline
                  </h3>

                  <div className="relative space-y-6 pl-8">
                    {mockOrderData.statusHistory.map((status, index) => {
                      const StatusIconComponent = statusConfig[status.status].icon
                      const isLast = index === mockOrderData.statusHistory.length - 1
                      const isFuture = false

                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.1 }}
                          className="relative"
                        >
                          {!isLast && (
                            <div className="absolute left-[-1.75rem] top-8 w-0.5 h-full bg-gradient-to-b from-primary/50 to-border" />
                          )}
                          
                          <div className="absolute left-[-2.25rem] top-1">
                            <div className={cn(
                              'w-4 h-4 rounded-full border-4 border-background',
                              isLast ? 'bg-primary shadow-lg shadow-primary/50 animate-pulse' : 'bg-primary/50'
                            )} />
                          </div>

                          <div className={cn(
                            'p-5 rounded-xl border-2 transition-all duration-300',
                            isLast ? 'bg-primary/5 border-primary/30 shadow-xl shadow-primary/20' : 'bg-card border-border'
                          )}>
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex items-start gap-3">
                                <motion.div 
                                  className={cn('p-2 rounded-lg', statusConfig[status.status].bg)}
                                  animate={isLast ? { 
                                    scale: [1, 1.05, 1],
                                  } : {}}
                                  transition={{ 
                                    duration: 2,
                                    repeat: isLast ? Infinity : 0,
                                    ease: 'easeInOut'
                                  }}
                                >
                                  <StatusIconComponent 
                                    size={20} 
                                    weight="bold" 
                                    className={statusConfig[status.status].color}
                                  />
                                </motion.div>
                                <div>
                                  <div className="font-semibold text-base mb-1">
                                    {statusConfig[status.status].label}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {status.description}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pl-11">
                              <div className="flex items-center gap-1.5">
                                <Clock size={14} />
                                {status.timestamp}
                              </div>
                              {status.location && (
                                <div className="flex items-center gap-1.5">
                                  <MapPin size={14} />
                                  {status.location}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="p-6 bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20">
                  <div className="flex gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/10 h-fit">
                      <WarningCircle size={24} weight="bold" className="text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Need Help?</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        If you have questions about your delivery, our support team is here to help.
                      </p>
                      <GamerButton variant="accent" size="sm" className="gap-2">
                        Contact Support
                        <ArrowRight size={16} weight="bold" />
                      </GamerButton>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>

            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <MapPin size={20} weight="bold" className="text-primary" />
                    Delivery Address
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium">{mockOrderData.customer.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {mockOrderData.deliveryAddress.street}<br />
                        {mockOrderData.deliveryAddress.city}, {mockOrderData.deliveryAddress.county}<br />
                        {mockOrderData.deliveryAddress.postalCode}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone size={16} weight="bold" className="text-muted-foreground" />
                        <span>{mockOrderData.customer.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Envelope size={16} weight="bold" className="text-muted-foreground" />
                        <span className="truncate">{mockOrderData.customer.email}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Package size={20} weight="bold" className="text-primary" />
                    Order Items
                  </h3>
                  <div className="space-y-3">
                    {mockOrderData.items.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm line-clamp-2">{item.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">Qty: {item.quantity}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
