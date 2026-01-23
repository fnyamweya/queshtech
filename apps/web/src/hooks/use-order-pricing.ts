/**
 * Order Pricing Hooks
 *
 * React hooks for fetching and mutating order pricing data with
 * optimistic updates and proper error handling.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { endpoints } from '@/lib/endpoints'
import type {
  PricingReadModel,
  RepriceOrderRequest,
  LockPricingRequest,
  ApplyPricingAdjustmentsRequest,
  ResolveBatchesRequest,
  Batch,
  PricingTotals,
  ChargeComponent,
  ChargeAllocation,
  PricingAppliedRule,
  PricingRun,
  OrderPricingSnapshot,
  PRICING_ERROR_CODES,
  PricingErrorCode,
} from '@/types/order-pricing'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UsePricingOptions {
  /** Auto-fetch on mount */
  enabled?: boolean
  /** Refetch interval in ms (0 = disabled) */
  refetchInterval?: number
  /** Callback on successful fetch */
  onSuccess?: (data: PricingReadModel) => void
  /** Callback on fetch error */
  onError?: (error: Error) => void
}

interface PricingState {
  data: PricingReadModel | null
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  lastFetchedAt: number | null
}

interface MutationState {
  isLoading: boolean
  error: Error | null
}

type PricingMutationResult<T = unknown> = {
  success: boolean
  data?: T
  error?: {
    code?: PricingErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function extractErrorDetails(err: unknown): { code?: string; message: string } {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    // Handle API error response shape
    if (e.body && typeof e.body === 'object') {
      const body = e.body as Record<string, unknown>
      const details = body.details as Record<string, unknown> | undefined
      return {
        code: (details?.code as string) || undefined,
        message: (body.message as string) || (e.message as string) || 'Unknown error',
      }
    }
    return {
      code: undefined,
      message: (e.message as string) || 'Unknown error',
    }
  }
  return { message: String(err) }
}

const emptyTotals: PricingTotals = {
  subtotal: '0',
  shipping: '0',
  tax: '0',
  discount: '0',
  fees: '0',
  adjustments: '0',
  grandTotal: '0',
  currencyCode: 'KES',
}

function computeTotals(charges: ChargeComponent[]): PricingTotals {
  const byCategory: Record<string, number> = {
    LINE_ITEM: 0,
    SHIPPING: 0,
    TAX: 0,
    DISCOUNT: 0,
    FEE: 0,
    ADJUSTMENT: 0,
  }

  let currency = 'KES'

  for (const charge of charges) {
    const amount = parseFloat(charge.amount) || 0
    const signed = charge.isCredit ? -amount : amount
    byCategory[charge.category] = (byCategory[charge.category] || 0) + signed
    currency = charge.currencyCode || currency
  }

  const grandTotal =
    byCategory.LINE_ITEM +
    byCategory.SHIPPING +
    byCategory.TAX +
    byCategory.DISCOUNT +
    byCategory.FEE +
    byCategory.ADJUSTMENT

  return {
    subtotal: byCategory.LINE_ITEM.toFixed(2),
    shipping: byCategory.SHIPPING.toFixed(2),
    tax: byCategory.TAX.toFixed(2),
    discount: byCategory.DISCOUNT.toFixed(2),
    fees: byCategory.FEE.toFixed(2),
    adjustments: byCategory.ADJUSTMENT.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
    currencyCode: currency,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// useOrderPricing Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useOrderPricing(orderId: string | undefined, options: UsePricingOptions = {}) {
  const { enabled = true, refetchInterval = 0, onSuccess, onError } = options
  const { authorizedRequest } = useAdminAuth()

  const [state, setState] = useState<PricingState>({
    data: null,
    isLoading: false,
    isFetching: false,
    error: null,
    lastFetchedAt: null,
  })

  const [repriceState, setRepriceState] = useState<MutationState>({ isLoading: false, error: null })
  const [lockState, setLockState] = useState<MutationState>({ isLoading: false, error: null })
  const [adjustmentState, setAdjustmentState] = useState<MutationState>({ isLoading: false, error: null })

  const mountedRef = useRef(true)
  const fetchControllerRef = useRef<AbortController | null>(null)

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch pricing data
  // ───────────────────────────────────────────────────────────────────────────

  const fetchPricing = useCallback(
    async (silent = false) => {
      if (!orderId) return

      // Abort any in-flight request
      fetchControllerRef.current?.abort()
      const controller = new AbortController()
      fetchControllerRef.current = controller

      if (!silent) {
        setState((s) => ({ ...s, isLoading: !s.data, isFetching: true, error: null }))
      } else {
        setState((s) => ({ ...s, isFetching: true }))
      }

      try {
        const response = await authorizedRequest<{
          success: boolean
          data: PricingReadModel
        }>(endpoints.orders.pricing(orderId), {
          method: 'GET',
          signal: controller.signal,
        })

        if (!mountedRef.current) return

        const data = response?.data || (response as unknown as PricingReadModel)

        // Compute totals if not provided
        const totals = data.totals || computeTotals(data.charges || [])

        const enrichedData: PricingReadModel = {
          ...data,
          totals,
          isLocked: !!data.snapshot?.lockedAt,
          latestRunStatus: data.runs?.[0]?.status || null,
          latestRunKind: data.runs?.[0]?.kind || null,
        }

        setState({
          data: enrichedData,
          isLoading: false,
          isFetching: false,
          error: null,
          lastFetchedAt: Date.now(),
        })

        onSuccess?.(enrichedData)
      } catch (err) {
        if (!mountedRef.current) return
        if ((err as Error).name === 'AbortError') return

        const error = err instanceof Error ? err : new Error(String(err))
        setState((s) => ({
          ...s,
          isLoading: false,
          isFetching: false,
          error,
        }))
        onError?.(error)
      }
    },
    [orderId, authorizedRequest, onSuccess, onError]
  )

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true
    if (enabled && orderId) {
      fetchPricing()
    }
    return () => {
      mountedRef.current = false
      fetchControllerRef.current?.abort()
    }
  }, [enabled, orderId, fetchPricing])

  // Refetch interval
  useEffect(() => {
    if (!enabled || !refetchInterval || refetchInterval <= 0) return

    const interval = setInterval(() => {
      fetchPricing(true)
    }, refetchInterval)

    return () => clearInterval(interval)
  }, [enabled, refetchInterval, fetchPricing])

  // ───────────────────────────────────────────────────────────────────────────
  // Reprice mutation
  // ───────────────────────────────────────────────────────────────────────────

  const reprice = useCallback(
    async (request: RepriceOrderRequest = {}): Promise<PricingMutationResult> => {
      if (!orderId) return { success: false, error: { message: 'No order ID' } }

      setRepriceState({ isLoading: true, error: null })

      try {
        const response = await authorizedRequest<{ success: boolean; data: unknown }>(
          endpoints.orders.reprice(orderId),
          {
            method: 'POST',
            body: request,
          }
        )

        setRepriceState({ isLoading: false, error: null })

        // Refetch pricing data
        await fetchPricing()

        return { success: true, data: response?.data || response }
      } catch (err) {
        const details = extractErrorDetails(err)
        const error = new Error(details.message)
        setRepriceState({ isLoading: false, error })
        return {
          success: false,
          error: {
            code: details.code as PricingErrorCode,
            message: details.message,
          },
        }
      }
    },
    [orderId, authorizedRequest, fetchPricing]
  )

  // ───────────────────────────────────────────────────────────────────────────
  // Lock pricing mutation
  // ───────────────────────────────────────────────────────────────────────────

  const lockPricing = useCallback(
    async (request: LockPricingRequest = {}): Promise<PricingMutationResult> => {
      if (!orderId) return { success: false, error: { message: 'No order ID' } }

      setLockState({ isLoading: true, error: null })

      try {
        const response = await authorizedRequest<{ success: boolean; data: unknown }>(
          endpoints.orders.lockPricing(orderId),
          {
            method: 'POST',
            body: request,
          }
        )

        setLockState({ isLoading: false, error: null })

        // Refetch pricing data
        await fetchPricing()

        return { success: true, data: response?.data || response }
      } catch (err) {
        const details = extractErrorDetails(err)
        const error = new Error(details.message)
        setLockState({ isLoading: false, error })
        return {
          success: false,
          error: {
            code: details.code as PricingErrorCode,
            message: details.message,
          },
        }
      }
    },
    [orderId, authorizedRequest, fetchPricing]
  )

  // ───────────────────────────────────────────────────────────────────────────
  // Apply adjustments mutation
  // ───────────────────────────────────────────────────────────────────────────

  const applyAdjustments = useCallback(
    async (request: ApplyPricingAdjustmentsRequest): Promise<PricingMutationResult> => {
      if (!orderId) return { success: false, error: { message: 'No order ID' } }

      setAdjustmentState({ isLoading: true, error: null })

      try {
        const response = await authorizedRequest<{ success: boolean; data: unknown }>(
          endpoints.orders.pricingAdjustments(orderId),
          {
            method: 'POST',
            body: request,
          }
        )

        setAdjustmentState({ isLoading: false, error: null })

        // Refetch pricing data
        await fetchPricing()

        return { success: true, data: response?.data || response }
      } catch (err) {
        const details = extractErrorDetails(err)
        const error = new Error(details.message)
        setAdjustmentState({ isLoading: false, error })
        return {
          success: false,
          error: {
            code: details.code as PricingErrorCode,
            message: details.message,
          },
        }
      }
    },
    [orderId, authorizedRequest, fetchPricing]
  )

  // ───────────────────────────────────────────────────────────────────────────
  // Computed values
  // ───────────────────────────────────────────────────────────────────────────

  const availableActions = useMemo(() => {
    const { data } = state
    const isLocked = data?.isLocked || false
    const hasPricing = (data?.runs?.length || 0) > 0
    const latestRunSucceeded = data?.latestRunStatus === 'SUCCEEDED'

    return {
      canReprice: !isLocked,
      canLock: hasPricing && latestRunSucceeded && !isLocked,
      canAdjust: isLocked && hasPricing,
      repriceDisabledReason: isLocked ? 'Pricing is locked and cannot be repriced' : undefined,
      lockDisabledReason: !hasPricing
        ? 'No pricing computed yet'
        : !latestRunSucceeded
          ? 'Latest pricing run did not succeed'
          : isLocked
            ? 'Pricing is already locked'
            : undefined,
      adjustDisabledReason: !isLocked
        ? 'Pricing must be locked before adjustments'
        : !hasPricing
          ? 'No base pricing to adjust'
          : undefined,
    }
  }, [state])

  return {
    // State
    pricing: state.data,
    isLoading: state.isLoading,
    isFetching: state.isFetching,
    error: state.error,
    lastFetchedAt: state.lastFetchedAt,

    // Mutations
    reprice,
    isRepricing: repriceState.isLoading,
    repriceError: repriceState.error,

    lockPricing,
    isLocking: lockState.isLoading,
    lockError: lockState.error,

    applyAdjustments,
    isApplyingAdjustments: adjustmentState.isLoading,
    adjustmentError: adjustmentState.error,

    // Actions
    refetch: fetchPricing,
    availableActions,

    // Convenience
    isLocked: state.data?.isLocked || false,
    totals: state.data?.totals || emptyTotals,
    charges: state.data?.charges || [],
    runs: state.data?.runs || [],
    appliedRules: state.data?.appliedRules || [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// useBatches Hook
// ─────────────────────────────────────────────────────────────────────────────

interface BatchesState {
  data: Batch[] | null
  isLoading: boolean
  error: Error | null
}

export function useBatches(orderId: string | undefined, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options
  const { authorizedRequest } = useAdminAuth()

  const [state, setState] = useState<BatchesState>({
    data: null,
    isLoading: false,
    error: null,
  })

  const [resolveState, setResolveState] = useState<MutationState>({ isLoading: false, error: null })

  const fetchBatches = useCallback(async () => {
    if (!orderId) return

    setState((s) => ({ ...s, isLoading: true, error: null }))

    try {
      const response = await authorizedRequest<{ success: boolean; data: Batch[] }>(
        endpoints.orders.batches(orderId),
        { method: 'GET' }
      )

      setState({
        data: response?.data || (response as unknown as Batch[]) || [],
        isLoading: false,
        error: null,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      }))
    }
  }, [orderId, authorizedRequest])

  const resolveBatches = useCallback(
    async (request: ResolveBatchesRequest = {}): Promise<PricingMutationResult<Batch[]>> => {
      if (!orderId) return { success: false, error: { message: 'No order ID' } }

      setResolveState({ isLoading: true, error: null })

      try {
        const response = await authorizedRequest<{ success: boolean; data: Batch[] }>(
          endpoints.orders.resolveBatches(orderId),
          {
            method: 'POST',
            body: request,
          }
        )

        setResolveState({ isLoading: false, error: null })

        // Refetch
        await fetchBatches()

        return { success: true, data: response?.data || [] }
      } catch (err) {
        const details = extractErrorDetails(err)
        const error = new Error(details.message)
        setResolveState({ isLoading: false, error })
        return {
          success: false,
          error: {
            code: details.code as PricingErrorCode,
            message: details.message,
          },
        }
      }
    },
    [orderId, authorizedRequest, fetchBatches]
  )

  useEffect(() => {
    if (enabled && orderId) {
      fetchBatches()
    }
  }, [enabled, orderId, fetchBatches])

  return {
    batches: state.data,
    isLoading: state.isLoading,
    error: state.error,
    refetch: fetchBatches,
    resolveBatches,
    isResolving: resolveState.isLoading,
    resolveError: resolveState.error,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// useOrderPayments Hook (for admin payment view)
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderPayment {
  id: string
  orderId: string
  type: 'CAPTURE' | 'REFUND' | 'REVERSAL' | 'ADJUSTMENT'
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  provider: string
  method: string
  amount: string
  currencyCode: string
  externalRef?: string
  initiatedAt?: string
  confirmedAt?: string
  metaJson: Record<string, unknown>
  createdAt: string
  allocations?: PaymentAllocation[]
}

export interface PaymentAllocation {
  id: string
  paymentId: string
  orderId: string
  appliesTo: 'ORDER' | 'ORDER_ITEM'
  orderItemId?: string
  amount: string
  currencyCode: string
  metaJson: Record<string, unknown>
}

export interface PaymentSummary {
  grandTotal: string
  capturedTotal: string
  refundedTotal: string
  netPaidTotal: string
  balanceDue: string
  currencyCode: string
  derivedStatus: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERPAID' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
}

export function useOrderPayments(orderId: string | undefined, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options
  const { authorizedRequest } = useAdminAuth()

  const [payments, setPayments] = useState<OrderPayment[] | null>(null)
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchPayments = useCallback(async () => {
    if (!orderId) return

    setIsLoading(true)
    setError(null)

    try {
      const [paymentsRes, summaryRes] = await Promise.all([
        authorizedRequest<{ success: boolean; data: OrderPayment[] }>(
          endpoints.orders.payments(orderId),
          { method: 'GET' }
        ),
        authorizedRequest<{ success: boolean; data: PaymentSummary }>(
          endpoints.orders.paymentsSummary(orderId),
          { method: 'GET' }
        ),
      ])

      setPayments(paymentsRes?.data || [])
      setSummary(summaryRes?.data || null)
      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setIsLoading(false)
    }
  }, [orderId, authorizedRequest])

  useEffect(() => {
    if (enabled && orderId) {
      fetchPayments()
    }
  }, [enabled, orderId, fetchPayments])

  return {
    payments,
    summary,
    isLoading,
    error,
    refetch: fetchPayments,
  }
}
