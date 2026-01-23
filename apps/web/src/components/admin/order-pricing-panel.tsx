/**
 * Order Pricing Panel
 *
 * A comprehensive read-only view of order pricing with charges, allocations,
 * applied rules, and totals breakdown. Optimized for admin use with visual hierarchy.
 */

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  Calculator,
  Receipt,
  Tag,
  Truck,
  Percent,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  PricingReadModel,
  PricingTotals,
  ChargeComponent,
  ChargeAllocation,
  PricingAppliedRule,
  PricingRun,
  ChargeComponentCategory,
  RuleOutcome,
} from '@/types/order-pricing'

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function formatCurrency(amount: string | number, currency = 'KES'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (!Number.isFinite(num)) return `${currency} 0.00`

  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

const categoryIcons: Record<ChargeComponentCategory, typeof Receipt> = {
  LINE_ITEM: Receipt,
  SHIPPING: Truck,
  TAX: Percent,
  DISCOUNT: Tag,
  FEE: Calculator,
  ADJUSTMENT: RefreshCw,
}

const categoryLabels: Record<ChargeComponentCategory, string> = {
  LINE_ITEM: 'Line Items',
  SHIPPING: 'Shipping',
  TAX: 'Tax',
  DISCOUNT: 'Discounts',
  FEE: 'Fees',
  ADJUSTMENT: 'Adjustments',
}

const categoryColors: Record<ChargeComponentCategory, string> = {
  LINE_ITEM: 'text-foreground',
  SHIPPING: 'text-blue-600 dark:text-blue-400',
  TAX: 'text-amber-600 dark:text-amber-400',
  DISCOUNT: 'text-green-600 dark:text-green-400',
  FEE: 'text-orange-600 dark:text-orange-400',
  ADJUSTMENT: 'text-purple-600 dark:text-purple-400',
}

const outcomeConfig: Record<RuleOutcome, { color: string; icon: typeof CheckCircle2; label: string }> = {
  APPLIED: { color: 'text-green-600', icon: CheckCircle2, label: 'Applied' },
  SKIPPED: { color: 'text-muted-foreground', icon: XCircle, label: 'Skipped' },
  ERROR: { color: 'text-red-600', icon: AlertCircle, label: 'Error' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface TotalsSummaryProps {
  totals: PricingTotals
  isLocked: boolean
}

function TotalsSummary({ totals, isLocked }: TotalsSummaryProps) {
  const rows = [
    { label: 'Subtotal', value: totals.subtotal, category: 'LINE_ITEM' as const },
    { label: 'Shipping', value: totals.shipping, category: 'SHIPPING' as const },
    { label: 'Tax', value: totals.tax, category: 'TAX' as const },
    { label: 'Discounts', value: totals.discount, category: 'DISCOUNT' as const, isCredit: true },
    { label: 'Fees', value: totals.fees, category: 'FEE' as const },
    { label: 'Adjustments', value: totals.adjustments, category: 'ADJUSTMENT' as const },
  ].filter((r) => parseFloat(r.value) !== 0)

  const grandTotal = parseFloat(totals.grandTotal)

  return (
    <div className="rounded-lg border bg-gradient-to-br from-muted/30 to-muted/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Pricing Summary
        </h4>
        <Badge
          variant="outline"
          className={cn(
            'gap-1',
            isLocked
              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
          )}
        >
          {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          {isLocked ? 'Locked' : 'Draft'}
        </Badge>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const Icon = categoryIcons[row.category]
          const amount = parseFloat(row.value)
          const isNegative = amount < 0 || row.isCredit

          return (
            <div
              key={row.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <Icon className={cn('h-4 w-4', categoryColors[row.category])} />
                {row.label}
              </span>
              <span className={cn('font-medium tabular-nums', isNegative && 'text-green-600')}>
                {isNegative && '−'}
                {formatCurrency(Math.abs(amount), totals.currencyCode)}
              </span>
            </div>
          )
        })}
      </div>

      <Separator className="my-3" />

      <div className="flex items-center justify-between">
        <span className="font-semibold">Grand Total</span>
        <span className="text-lg font-bold tabular-nums">
          {formatCurrency(grandTotal, totals.currencyCode)}
        </span>
      </div>
    </div>
  )
}

interface ChargeItemProps {
  charge: ChargeComponent
  allocations: ChargeAllocation[]
}

function ChargeItem({ charge, allocations }: ChargeItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const Icon = categoryIcons[charge.category]
  const amount = parseFloat(charge.amount)
  const hasAllocations = allocations.length > 0

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between p-2 rounded-md text-sm',
            'hover:bg-muted/50 transition-colors text-left',
            hasAllocations && 'cursor-pointer'
          )}
          disabled={!hasAllocations}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasAllocations && (
              <span className="text-muted-foreground">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
            )}
            <Icon className={cn('h-4 w-4 flex-shrink-0', categoryColors[charge.category])} />
            <span className="truncate">{charge.displayName || charge.code}</span>
            {charge.isCredit && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                Credit
              </Badge>
            )}
          </div>
          <span
            className={cn(
              'font-medium tabular-nums ml-2',
              charge.isCredit && 'text-green-600'
            )}
          >
            {charge.isCredit && '−'}
            {formatCurrency(Math.abs(amount), charge.currencyCode)}
          </span>
        </button>
      </CollapsibleTrigger>

      {hasAllocations && (
        <CollapsibleContent>
          <div className="ml-8 pl-2 border-l-2 border-muted space-y-1 py-1">
            {allocations.map((alloc) => (
              <div
                key={alloc.id}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  {alloc.targetType === 'ORDER' ? 'Order-level' : `Item: ${alloc.targetId?.slice(0, 8)}...`}
                </span>
                <span className="tabular-nums">
                  {formatCurrency(alloc.amount, alloc.currencyCode)}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

interface RulesListProps {
  rules: PricingAppliedRule[]
}

function RulesList({ rules }: RulesListProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (rules.length === 0) return null

  const appliedCount = rules.filter((r) => r.outcome === 'APPLIED').length
  const skippedCount = rules.filter((r) => r.outcome === 'SKIPPED').length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between p-2 rounded-md text-sm hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Pricing Rules</span>
          </div>
          <div className="flex items-center gap-2">
            {appliedCount > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                {appliedCount} applied
              </Badge>
            )}
            {skippedCount > 0 && (
              <Badge variant="secondary" className="text-muted-foreground">
                {skippedCount} skipped
              </Badge>
            )}
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-1 p-2">
          {rules.map((rule) => {
            const config = outcomeConfig[rule.outcome]
            const Icon = config.icon

            return (
              <div
                key={rule.id}
                className="flex items-center justify-between text-sm p-2 rounded bg-muted/30"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Icon className={cn('h-4 w-4 flex-shrink-0', config.color)} />
                  <span className="truncate">{rule.ruleName}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                    {rule.ruleType}
                  </Badge>
                </div>
                <Badge
                  variant="secondary"
                  className={cn('text-xs', config.color)}
                >
                  {config.label}
                </Badge>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface RunHistoryProps {
  runs: PricingRun[]
}

function RunHistory({ runs }: RunHistoryProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (runs.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between p-2 rounded-md text-sm hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Run History</span>
          </div>
          <Badge variant="secondary">{runs.length} runs</Badge>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-1 p-2">
          {runs.map((run, idx) => (
            <div
              key={run.id}
              className="flex items-center justify-between text-sm p-2 rounded bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    run.kind === 'ADJUSTMENT' && 'border-purple-300 text-purple-700'
                  )}
                >
                  {run.kind}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(run.completedAt || run.startedAt)}
                </span>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs',
                  run.status === 'SUCCEEDED' && 'bg-green-100 text-green-700',
                  run.status === 'FAILED' && 'bg-red-100 text-red-700',
                  run.status === 'PENDING' && 'bg-amber-100 text-amber-700'
                )}
              >
                {run.status}
              </Badge>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function PricingPanelSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-4 w-48 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────

function PricingEmptyState({ onReprice }: { onReprice?: () => void }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Order Pricing
        </CardTitle>
        <CardDescription>No pricing data computed yet</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Calculator className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            This order hasn't been priced yet. Run the pricing engine to calculate totals,
            apply promotions, and compute taxes.
          </p>
          {onReprice && (
            <Button onClick={onReprice} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Compute Pricing
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

export interface OrderPricingPanelProps {
  pricing: PricingReadModel | null
  isLoading?: boolean
  error?: Error | null
  onReprice?: () => void
  onRefresh?: () => void
  className?: string
}

export function OrderPricingPanel({
  pricing,
  isLoading,
  error,
  onReprice,
  onRefresh,
  className,
}: OrderPricingPanelProps) {
  // Group charges by category for display
  const chargesByCategory = useMemo(() => {
    if (!pricing?.charges) return new Map<ChargeComponentCategory, ChargeComponent[]>()

    const grouped = new Map<ChargeComponentCategory, ChargeComponent[]>()
    for (const charge of pricing.charges) {
      const existing = grouped.get(charge.category) || []
      grouped.set(charge.category, [...existing, charge])
    }
    return grouped
  }, [pricing?.charges])

  // Index allocations by charge ID
  const allocationsByCharge = useMemo(() => {
    if (!pricing?.allocations) return new Map<string, ChargeAllocation[]>()

    const indexed = new Map<string, ChargeAllocation[]>()
    for (const alloc of pricing.allocations) {
      const existing = indexed.get(alloc.chargeComponentId) || []
      indexed.set(alloc.chargeComponentId, [...existing, alloc])
    }
    return indexed
  }, [pricing?.allocations])

  if (isLoading) {
    return <PricingPanelSkeleton />
  }

  if (error) {
    return (
      <Card className={cn('shadow-sm', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Error Loading Pricing
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

  if (!pricing || !pricing.runs || pricing.runs.length === 0) {
    return <PricingEmptyState onReprice={onReprice} />
  }

  const isLocked = pricing.isLocked
  const totals = pricing.totals

  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Order Pricing
          </CardTitle>
          {onRefresh && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh pricing data</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <CardDescription className="flex items-center gap-2">
          {pricing.snapshot?.pricingEngineVersion && (
            <span className="text-xs font-mono">
              {pricing.snapshot.pricingEngineVersion}
            </span>
          )}
          {pricing.snapshot?.lockedAt && (
            <span className="text-xs">
              Locked {formatDateTime(pricing.snapshot.lockedAt)}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Totals Summary */}
        <TotalsSummary totals={totals} isLocked={isLocked} />

        {/* Charge Breakdown */}
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Charge Breakdown</h4>
          {Array.from(chargesByCategory.entries()).map(([category, charges]) => (
            <div key={category} className="space-y-0.5">
              {charges.map((charge) => (
                <ChargeItem
                  key={charge.id}
                  charge={charge}
                  allocations={allocationsByCharge.get(charge.id) || []}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Rules */}
        {pricing.appliedRules && pricing.appliedRules.length > 0 && (
          <RulesList rules={pricing.appliedRules} />
        )}

        {/* Run History */}
        {pricing.runs && pricing.runs.length > 0 && (
          <RunHistory runs={pricing.runs} />
        )}

        {/* Runtime Context Info */}
        {pricing.snapshot?.runtimeContext && Object.keys(pricing.snapshot.runtimeContext).length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                  <Info className="h-3 w-3" />
                  Runtime context available
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm">
                <pre className="text-xs">
                  {JSON.stringify(pricing.snapshot.runtimeContext, null, 2)}
                </pre>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  )
}

export default OrderPricingPanel
