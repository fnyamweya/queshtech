/**
 * Order Pricing Actions
 *
 * Admin action buttons and dialogs for repricing, locking pricing,
 * and applying adjustments to orders. Includes confirmation dialogs
 * with error handling and recovery guidance.
 */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  RefreshCw,
  Lock,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Calculator,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type {
  RepriceOrderRequest,
  LockPricingRequest,
  ApplyPricingAdjustmentsRequest,
  PricingAdjustmentLine,
  PricingErrorCode,
  PRICING_ERROR_CODES,
} from '@/types/order-pricing'

// ─────────────────────────────────────────────────────────────────────────────
// Error Recovery Guidance
// ─────────────────────────────────────────────────────────────────────────────

const errorRecoveryMap: Record<string, { title: string; guidance: string; action?: string }> = {
  SNAPSHOT_LOCKED: {
    title: 'Pricing Locked',
    guidance: 'The pricing has been locked and cannot be changed. Use adjustments instead.',
    action: 'Add Adjustment',
  },
  SNAPSHOT_NOT_LOCKED: {
    title: 'Pricing Not Locked',
    guidance: 'Pricing must be locked before adding adjustments. Lock the pricing first.',
    action: 'Lock Pricing',
  },
  ORDER_NOT_DRAFT: {
    title: 'Order Not Draft',
    guidance: 'Only draft orders can be repriced. This order has progressed beyond the draft stage.',
  },
  PRICING_NOT_COMPUTED: {
    title: 'No Pricing Data',
    guidance: 'Run the pricing engine first to compute base pricing before adding adjustments.',
    action: 'Compute Pricing',
  },
  PRICING_RUN_FAILED: {
    title: 'Pricing Failed',
    guidance: 'The last pricing run failed. Check the order items and try repricing.',
    action: 'Retry Pricing',
  },
  QUOTE_STALE_REPRICE_REQUIRED: {
    title: 'Quote Stale',
    guidance: 'The quote has become stale. Reprice the order to get fresh pricing before locking.',
    action: 'Reprice',
  },
  QUOTE_NOT_LOCKED: {
    title: 'Quote Not Locked',
    guidance: 'Lock the pricing before capturing payment to ensure price consistency.',
    action: 'Lock Pricing',
  },
  NOOP_ADJUSTMENT: {
    title: 'No-op Adjustment',
    guidance: 'The adjustment had no effect. Check that amounts are non-zero.',
  },
  IDEMPOTENCY_KEY_REUSE_FAILED: {
    title: 'Duplicate Request',
    guidance: 'This adjustment was already processed. Refresh to see the latest state.',
    action: 'Refresh',
  },
}

function getErrorRecovery(code?: string) {
  if (!code) return null
  return errorRecoveryMap[code] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean
  error?: {
    code?: PricingErrorCode
    message: string
  }
}

interface OrderPricingActionsProps {
  orderId: string
  isLocked: boolean
  hasPricing: boolean
  latestRunSucceeded: boolean
  currencyCode?: string

  // Mutation handlers
  onReprice: (request?: RepriceOrderRequest) => Promise<ActionResult>
  onLockPricing: (request?: LockPricingRequest) => Promise<ActionResult>
  onApplyAdjustments: (request: ApplyPricingAdjustmentsRequest) => Promise<ActionResult>
  onRefresh?: () => void

  // Loading states
  isRepricing?: boolean
  isLocking?: boolean
  isApplyingAdjustments?: boolean

  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Reprice Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface RepriceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (request: RepriceOrderRequest) => Promise<void>
  isLoading: boolean
  disabled: boolean
  disabledReason?: string
}

function RepriceDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  disabled,
  disabledReason,
}: RepriceDialogProps) {
  const [error, setError] = useState<{ code?: string; message: string } | null>(null)

  const handleConfirm = async () => {
    setError(null)
    try {
      await onConfirm({})
      onOpenChange(false)
    } catch (err) {
      // Error handled by parent
    }
  }

  const recovery = error ? getErrorRecovery(error.code) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Reprice Order
          </DialogTitle>
          <DialogDescription>
            Recalculate pricing using the current catalog prices, promotions, and tax rules.
            This will replace any existing draft pricing.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{recovery?.title || 'Error'}</AlertTitle>
            <AlertDescription>
              {error.message}
              {recovery?.guidance && (
                <p className="mt-1 text-sm opacity-80">{recovery.guidance}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Repricing will use the latest pricebook, apply current promotions, and recalculate
              taxes. Any previous draft pricing will be replaced.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || disabled} className="gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Repricing...' : 'Reprice Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lock Pricing Confirmation
// ─────────────────────────────────────────────────────────────────────────────

interface LockPricingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (request: LockPricingRequest) => Promise<void>
  isLoading: boolean
  disabled: boolean
  disabledReason?: string
}

function LockPricingDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  disabled,
  disabledReason,
}: LockPricingDialogProps) {
  const [error, setError] = useState<{ code?: string; message: string } | null>(null)

  const handleConfirm = async () => {
    setError(null)
    try {
      await onConfirm({})
      onOpenChange(false)
    } catch (err) {
      // Error handled by parent
    }
  }

  const recovery = error ? getErrorRecovery(error.code) : null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Lock Pricing
          </AlertDialogTitle>
          <AlertDialogDescription>
            Once locked, the base pricing cannot be changed. Only adjustments can be added.
            This is typically done before accepting payment.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{recovery?.title || 'Error'}</AlertTitle>
            <AlertDescription>
              {error.message}
              {recovery?.guidance && (
                <p className="mt-1 text-sm opacity-80">{recovery.guidance}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>This action cannot be undone.</strong> After locking, you can only add
              adjustments (surcharges or credits) but cannot reprice the order.
            </AlertDescription>
          </Alert>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || disabled}
            className="gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Locking...' : 'Lock Pricing'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Adjustment Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface AdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (request: ApplyPricingAdjustmentsRequest) => Promise<void>
  isLoading: boolean
  disabled: boolean
  disabledReason?: string
  currencyCode?: string
}

function AdjustmentDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  disabled,
  disabledReason,
  currencyCode = 'KES',
}: AdjustmentDialogProps) {
  const [adjustments, setAdjustments] = useState<PricingAdjustmentLine[]>([
    { amount: 0, displayName: '', reason: '' },
  ])
  const [error, setError] = useState<{ code?: string; message: string } | null>(null)

  const addLine = () => {
    setAdjustments((prev) => [...prev, { amount: 0, displayName: '', reason: '' }])
  }

  const removeLine = (index: number) => {
    setAdjustments((prev) => prev.filter((_, i) => i !== index))
  }

  const updateLine = (index: number, field: keyof PricingAdjustmentLine, value: string | number) => {
    setAdjustments((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    )
  }

  const handleConfirm = async () => {
    setError(null)

    // Validate
    const validAdjustments = adjustments.filter((a) => a.amount !== 0)
    if (validAdjustments.length === 0) {
      setError({ message: 'At least one non-zero adjustment is required' })
      return
    }

    try {
      await onConfirm({
        adjustments: validAdjustments.map((a) => ({
          amount: a.amount,
          displayName: a.displayName || undefined,
          reason: a.reason || undefined,
        })),
      })
      onOpenChange(false)
      setAdjustments([{ amount: 0, displayName: '', reason: '' }])
    } catch (err) {
      // Error handled by parent
    }
  }

  const totalAdjustment = adjustments.reduce((sum, a) => sum + (a.amount || 0), 0)
  const recovery = error ? getErrorRecovery(error.code) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Add Pricing Adjustment
          </DialogTitle>
          <DialogDescription>
            Add surcharges (positive) or credits (negative) to the locked pricing.
            Adjustments are append-only and fully audited.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{recovery?.title || 'Error'}</AlertTitle>
            <AlertDescription>
              {error.message}
              {recovery?.guidance && (
                <p className="mt-1 text-sm opacity-80">{recovery.guidance}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
          {adjustments.map((adj, idx) => (
            <div key={idx} className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Adjustment {idx + 1}</Label>
                {adjustments.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(idx)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`amount-${idx}`} className="text-xs">
                      Amount ({currencyCode})
                    </Label>
                    <Input
                      id={`amount-${idx}`}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={adj.amount || ''}
                      onChange={(e) => updateLine(idx, 'amount', parseFloat(e.target.value) || 0)}
                      className="h-9"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Negative = credit, Positive = surcharge
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`reason-${idx}`} className="text-xs">
                      Reason Code
                    </Label>
                    <Input
                      id={`reason-${idx}`}
                      placeholder="e.g., goodwill_credit"
                      value={adj.reason || ''}
                      onChange={(e) => updateLine(idx, 'reason', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`name-${idx}`} className="text-xs">
                    Display Name
                  </Label>
                  <Input
                    id={`name-${idx}`}
                    placeholder="e.g., Customer goodwill credit"
                    value={adj.displayName || ''}
                    onChange={(e) => updateLine(idx, 'displayName', e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addLine} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Add Another Line
          </Button>
        </div>

        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted">
          <span className="text-sm font-medium">Total Adjustment</span>
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              totalAdjustment < 0 && 'text-green-600',
              totalAdjustment > 0 && 'text-orange-600'
            )}
          >
            {totalAdjustment < 0 ? '−' : '+'}
            {currencyCode} {Math.abs(totalAdjustment).toFixed(2)}
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || disabled || totalAdjustment === 0}
            className="gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Applying...' : 'Apply Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function OrderPricingActions({
  orderId,
  isLocked,
  hasPricing,
  latestRunSucceeded,
  currencyCode = 'KES',
  onReprice,
  onLockPricing,
  onApplyAdjustments,
  onRefresh,
  isRepricing = false,
  isLocking = false,
  isApplyingAdjustments = false,
  className,
}: OrderPricingActionsProps) {
  const [repriceOpen, setRepriceOpen] = useState(false)
  const [lockOpen, setLockOpen] = useState(false)
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)

  // Determine action availability
  const canReprice = !isLocked
  const canLock = hasPricing && latestRunSucceeded && !isLocked
  const canAdjust = isLocked && hasPricing

  // Handle reprice
  const handleReprice = useCallback(
    async (request: RepriceOrderRequest) => {
      const result = await onReprice(request)
      if (result.success) {
        toast.success('Order repriced', { description: 'Pricing has been recalculated.' })
      } else if (result.error) {
        toast.error(result.error.message, {
          description: getErrorRecovery(result.error.code)?.guidance,
        })
        throw new Error(result.error.message)
      }
    },
    [onReprice]
  )

  // Handle lock
  const handleLock = useCallback(
    async (request: LockPricingRequest) => {
      const result = await onLockPricing(request)
      if (result.success) {
        toast.success('Pricing locked', {
          description: 'Order is ready for payment capture.',
        })
      } else if (result.error) {
        toast.error(result.error.message, {
          description: getErrorRecovery(result.error.code)?.guidance,
        })
        throw new Error(result.error.message)
      }
    },
    [onLockPricing]
  )

  // Handle adjustment
  const handleAdjustment = useCallback(
    async (request: ApplyPricingAdjustmentsRequest) => {
      const result = await onApplyAdjustments(request)
      if (result.success) {
        const total = request.adjustments.reduce((s, a) => s + a.amount, 0)
        toast.success('Adjustment applied', {
          description: `${total >= 0 ? 'Surcharge' : 'Credit'} of ${currencyCode} ${Math.abs(total).toFixed(2)} added.`,
        })
      } else if (result.error) {
        toast.error(result.error.message, {
          description: getErrorRecovery(result.error.code)?.guidance,
        })
        throw new Error(result.error.message)
      }
    },
    [onApplyAdjustments, currencyCode]
  )

  return (
    <TooltipProvider>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {/* Reprice Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRepriceOpen(true)}
                disabled={!canReprice || isRepricing}
                className="gap-2"
              >
                {isRepricing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Reprice
              </Button>
            </span>
          </TooltipTrigger>
          {!canReprice && (
            <TooltipContent>
              {isLocked ? 'Pricing is locked' : 'Cannot reprice'}
            </TooltipContent>
          )}
        </Tooltip>

        {/* Lock Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant={canLock ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLockOpen(true)}
                disabled={!canLock || isLocking}
                className="gap-2"
              >
                {isLocking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Lock Pricing
              </Button>
            </span>
          </TooltipTrigger>
          {!canLock && (
            <TooltipContent>
              {isLocked
                ? 'Already locked'
                : !hasPricing
                  ? 'No pricing computed'
                  : !latestRunSucceeded
                    ? 'Latest run failed'
                    : 'Cannot lock'}
            </TooltipContent>
          )}
        </Tooltip>

        {/* Adjustment Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdjustmentOpen(true)}
                disabled={!canAdjust || isApplyingAdjustments}
                className="gap-2"
              >
                {isApplyingAdjustments ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4" />
                )}
                Add Adjustment
              </Button>
            </span>
          </TooltipTrigger>
          {!canAdjust && (
            <TooltipContent>
              {!isLocked ? 'Lock pricing first' : 'Cannot add adjustment'}
            </TooltipContent>
          )}
        </Tooltip>

        {/* Status Badge */}
        {isLocked && (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Locked
          </Badge>
        )}

        {/* Dialogs */}
        <RepriceDialog
          open={repriceOpen}
          onOpenChange={setRepriceOpen}
          onConfirm={handleReprice}
          isLoading={isRepricing}
          disabled={!canReprice}
        />

        <LockPricingDialog
          open={lockOpen}
          onOpenChange={setLockOpen}
          onConfirm={handleLock}
          isLoading={isLocking}
          disabled={!canLock}
        />

        <AdjustmentDialog
          open={adjustmentOpen}
          onOpenChange={setAdjustmentOpen}
          onConfirm={handleAdjustment}
          isLoading={isApplyingAdjustments}
          disabled={!canAdjust}
          currencyCode={currencyCode}
        />
      </div>
    </TooltipProvider>
  )
}

export default OrderPricingActions
