/**
 * Batch Panel
 *
 * Admin view for order batches with ability to resolve/generate batches
 * and view shipping method assignments per batch.
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Package,
  Truck,
  MapPin,
  Download,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Box,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type {
  Batch,
  BatchItem,
  BatchType,
  BatchStatus,
  ResolveBatchesRequest,
} from '@/types/order-pricing'

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function formatCurrency(amount: string | number | null | undefined, currency = 'KES'): string {
  if (amount === null || amount === undefined) return '—'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (!Number.isFinite(num)) return '—'

  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num)
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-KE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

const typeIcons: Record<BatchType, typeof Truck> = {
  SHIP: Truck,
  PICKUP: MapPin,
  DIGITAL: Download,
  UNKNOWN: Box,
}

const typeLabels: Record<BatchType, string> = {
  SHIP: 'Shipping',
  PICKUP: 'In-Store Pickup',
  DIGITAL: 'Digital Delivery',
  UNKNOWN: 'Unknown',
}

const typeColors: Record<BatchType, string> = {
  SHIP: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  PICKUP: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  DIGITAL: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  UNKNOWN: 'text-muted-foreground bg-muted border-muted',
}

const statusConfig: Record<
  BatchStatus,
  { color: string; icon: typeof CheckCircle2; label: string }
> = {
  PENDING: {
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    icon: Clock,
    label: 'Pending',
  },
  RESOLVED: {
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    icon: CheckCircle2,
    label: 'Resolved',
  },
  SHIPPED: {
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    icon: Truck,
    label: 'Shipped',
  },
  DELIVERED: {
    color: 'text-green-600 bg-green-50 border-green-200',
    icon: CheckCircle2,
    label: 'Delivered',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface BatchCardProps {
  batch: Batch
  index: number
}

function BatchCard({ batch, index }: BatchCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const TypeIcon = typeIcons[batch.type]
  const status = statusConfig[batch.status]
  const StatusIcon = status.icon
  const itemCount = batch.items?.length || 0

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', typeColors[batch.type])}>
                <TypeIcon className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Batch {index + 1}</span>
                  <Badge variant="outline" className={cn('text-xs', typeColors[batch.type])}>
                    {typeLabels[batch.type]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                  <Package className="h-3 w-3" />
                  <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                  {batch.shippingMethodName && (
                    <>
                      <span>•</span>
                      <span>{batch.shippingMethodName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {batch.shippingCost && (
                <span className="font-medium tabular-nums">
                  {formatCurrency(batch.shippingCost, batch.currencyCode || 'KES')}
                </span>
              )}
              <Badge
                variant="outline"
                className={cn('gap-1', status.color)}
              >
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator />
          <div className="p-4 space-y-3 bg-muted/20">
            {/* Shipping Details */}
            {(batch.shippingMethodCode || batch.estimatedDeliveryAt) && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {batch.shippingMethodCode && (
                  <div>
                    <span className="text-muted-foreground">Method Code:</span>
                    <span className="ml-2 font-mono text-xs">{batch.shippingMethodCode}</span>
                  </div>
                )}
                {batch.estimatedDeliveryAt && (
                  <div>
                    <span className="text-muted-foreground">Est. Delivery:</span>
                    <span className="ml-2">{formatDateTime(batch.estimatedDeliveryAt)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Items */}
            {batch.items && batch.items.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Items in Batch
                </h5>
                <div className="space-y-1">
                  {batch.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm p-2 rounded bg-background"
                    >
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-xs truncate max-w-[200px]">
                          {item.orderItemId}
                        </span>
                      </div>
                      <Badge variant="secondary">Qty: {item.quantity}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            {batch.meta && Object.keys(batch.meta).length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Metadata
                </h5>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(batch.meta, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function BatchesSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  onResolve?: () => void
  isResolving?: boolean
}

function BatchesEmpty({ onResolve, isResolving }: EmptyStateProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Batches
        </CardTitle>
        <CardDescription>No batches configured</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Batches organize order items for fulfillment. Generate batches to assign
            shipping methods and track delivery separately.
          </p>
          {onResolve && (
            <Button onClick={onResolve} disabled={isResolving} className="gap-2">
              {isResolving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {isResolving ? 'Generating...' : 'Generate Batches'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchPanelProps {
  batches: Batch[] | null
  isLoading?: boolean
  error?: Error | null
  onResolve?: (request?: ResolveBatchesRequest) => Promise<{ success: boolean; error?: { message: string } }>
  onRefresh?: () => void
  isResolving?: boolean
  className?: string
}

type ResolveStrategy = 'BY_SHIPPING_METHOD' | 'SINGLE_GROUP' | 'BY_FULFILLMENT_CENTER'

export function BatchPanel({
  batches,
  isLoading,
  error,
  onResolve,
  onRefresh,
  isResolving = false,
  className,
}: BatchPanelProps) {
  const [strategy, setStrategy] = useState<ResolveStrategy>('BY_SHIPPING_METHOD')

  const handleResolve = async () => {
    if (!onResolve) return

    const result = await onResolve({ strategy })
    if (result.success) {
      toast.success('Batches generated', {
        description: `Batches created using ${strategy.replace(/_/g, ' ').toLowerCase()} strategy.`,
      })
    } else if (result.error) {
      toast.error('Failed to generate batches', { description: result.error.message })
    }
  }

  if (isLoading) {
    return <BatchesSkeleton />
  }

  if (error) {
    return (
      <Card className={cn('shadow-sm', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Error Loading Batches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  if (!batches || batches.length === 0) {
    return <BatchesEmpty onResolve={handleResolve} isResolving={isResolving} />
  }

  const totalItems = batches.reduce((sum, b) => sum + (b.items?.length || 0), 0)
  const totalShipping = batches.reduce((sum, b) => {
    const cost = parseFloat(b.shippingCost || '0')
    return sum + (Number.isFinite(cost) ? cost : 0)
  }, 0)

  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Batches
          </CardTitle>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh batches</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <CardDescription>
          {batches.length} batch{batches.length !== 1 ? 'es' : ''} • {totalItems} total items
          {totalShipping > 0 && ` • ${formatCurrency(totalShipping)} shipping`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Resolve Controls */}
        {onResolve && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Select
              value={strategy}
              onValueChange={(v) => setStrategy(v as ResolveStrategy)}
            >
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BY_SHIPPING_METHOD">By Shipping Method</SelectItem>
                <SelectItem value="SINGLE_GROUP">Single Batch</SelectItem>
                <SelectItem value="BY_FULFILLMENT_CENTER">By Fulfillment Center</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResolve}
              disabled={isResolving}
              className="gap-2"
            >
              {isResolving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {isResolving ? 'Resolving...' : 'Re-resolve'}
            </Button>
          </div>
        )}

        {/* Batch List */}
        <div className="space-y-3">
          {batches.map((batch, idx) => (
            <BatchCard key={batch.id} batch={batch} index={idx} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default BatchPanel
