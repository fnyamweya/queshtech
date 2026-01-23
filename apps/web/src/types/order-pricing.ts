/**
 * Order Pricing Types
 *
 * TypeScript types for the order pricing lifecycle including snapshots,
 * pricing runs, charges, allocations, rules, and delivery groups.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Snapshot
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderPricingSnapshot {
  id: string
  orderId: string
  currencyCode: string
  pricebookRevisionId: string
  pricingEngineVersion: string
  runtimeContext: Record<string, unknown>
  lockedAt: string | null
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Run
// ─────────────────────────────────────────────────────────────────────────────

export type PricingRunKind = 'STANDARD' | 'ADJUSTMENT'
export type PricingRunStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED'

export interface PricingRun {
  id: string
  snapshotId: string
  kind: PricingRunKind
  status: PricingRunStatus
  idempotencyKey: string
  errorJson: Record<string, unknown> | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Charge Component
// ─────────────────────────────────────────────────────────────────────────────

export type ChargeComponentCategory =
  | 'LINE_ITEM'
  | 'SHIPPING'
  | 'TAX'
  | 'DISCOUNT'
  | 'FEE'
  | 'ADJUSTMENT'

export interface ChargeComponent {
  id: string
  pricingRunId: string
  category: ChargeComponentCategory
  code: string
  displayName: string
  amount: string
  currencyCode: string
  isCredit: boolean
  originatingRuleId: string | null
  meta: Record<string, unknown>
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Charge Allocation
// ─────────────────────────────────────────────────────────────────────────────

export type ChargeAllocationTarget = 'ORDER' | 'ORDER_ITEM' | 'DELIVERY_GROUP'

export interface ChargeAllocation {
  id: string
  chargeComponentId: string
  targetType: ChargeAllocationTarget
  targetId: string | null
  amount: string
  currencyCode: string
  meta: Record<string, unknown>
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Applied Rule
// ─────────────────────────────────────────────────────────────────────────────

export type RuleOutcome = 'APPLIED' | 'SKIPPED' | 'ERROR'

export interface PricingAppliedRule {
  id: string
  pricingRunId: string
  ruleType: string
  ruleId: string | null
  ruleName: string
  outcome: RuleOutcome
  conditionsSnapshot: Record<string, unknown>
  meta: Record<string, unknown>
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch (formerly Delivery Group)
// ─────────────────────────────────────────────────────────────────────────────

export type BatchType = 'SHIP' | 'PICKUP' | 'DIGITAL' | 'UNKNOWN'
export type BatchStatus = 'PENDING' | 'RESOLVED' | 'SHIPPED' | 'DELIVERED'

export interface BatchItem {
  id: string
  batchId: string
  orderItemId: string
  quantity: number
  createdAt: string
}

export interface Batch {
  id: string
  orderId: string
  type: BatchType
  status: BatchStatus
  shippingMethodCode: string | null
  shippingMethodName: string | null
  shippingCost: string | null
  currencyCode: string | null
  estimatedDeliveryAt: string | null
  meta: Record<string, unknown>
  createdAt: string
  updatedAt: string
  items?: BatchItem[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregated Read Model
// ─────────────────────────────────────────────────────────────────────────────

export interface PricingReadModel {
  snapshot: OrderPricingSnapshot | null
  runs: PricingRun[]
  charges: ChargeComponent[]
  allocations: ChargeAllocation[]
  appliedRules: PricingAppliedRule[]
  totals: PricingTotals
  isLocked: boolean
  latestRunStatus: PricingRunStatus | null
  latestRunKind: PricingRunKind | null
}

export interface PricingTotals {
  subtotal: string
  shipping: string
  tax: string
  discount: string
  fees: string
  adjustments: string
  grandTotal: string
  currencyCode: string
}

// ─────────────────────────────────────────────────────────────────────────────
// API Request/Response DTOs
// ─────────────────────────────────────────────────────────────────────────────

export interface RepriceOrderRequest {
  currency?: string
  at?: string
  channelId?: string
  customerGroupId?: string
  countryCode?: string
  salesChannelId?: string
  merchantId?: string
  pricingEngineVersion?: string
  runtimeContext?: Record<string, unknown>
}

export interface LockPricingRequest {
  quoteFingerprint?: string
}

export interface PricingAdjustmentLine {
  amount: number
  displayName?: string
  reason?: string
  meta?: Record<string, unknown>
}

export interface ApplyPricingAdjustmentsRequest {
  clientIdempotencyKey?: string
  adjustments: PricingAdjustmentLine[]
}

export interface ResolveBatchesRequest {
  strategy?: 'BY_SHIPPING_METHOD' | 'SINGLE_GROUP' | 'BY_FULFILLMENT_CENTER'
}

// ─────────────────────────────────────────────────────────────────────────────
// API Response Envelopes
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true
  statusCode: number
  message: string
  data: T
  meta?: Record<string, unknown>
  timestamp: string
}

export interface ApiErrorResponse {
  success: false
  statusCode: number
  message: string
  error: string
  details: {
    code?: string
    message?: string
    [key: string]: unknown
  }
  timestamp: string
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Error Codes
// ─────────────────────────────────────────────────────────────────────────────

export const PRICING_ERROR_CODES = {
  SNAPSHOT_LOCKED: 'SNAPSHOT_LOCKED',
  SNAPSHOT_NOT_LOCKED: 'SNAPSHOT_NOT_LOCKED',
  ORDER_NOT_DRAFT: 'ORDER_NOT_DRAFT',
  PRICING_NOT_COMPUTED: 'PRICING_NOT_COMPUTED',
  PRICING_RUN_FAILED: 'PRICING_RUN_FAILED',
  QUOTE_STALE_REPRICE_REQUIRED: 'QUOTE_STALE_REPRICE_REQUIRED',
  QUOTE_NOT_LOCKED: 'QUOTE_NOT_LOCKED',
  NOOP_ADJUSTMENT: 'NOOP_ADJUSTMENT',
  IDEMPOTENCY_KEY_REUSE_FAILED: 'IDEMPOTENCY_KEY_REUSE_FAILED',
} as const

export type PricingErrorCode = (typeof PRICING_ERROR_CODES)[keyof typeof PRICING_ERROR_CODES]

// ─────────────────────────────────────────────────────────────────────────────
// UI Helper Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PricingAction {
  type: 'reprice' | 'lock' | 'adjustment'
  label: string
  description: string
  enabled: boolean
  disabledReason?: string
}

export interface ChargeDisplayItem {
  id: string
  category: ChargeComponentCategory
  label: string
  amount: number
  currencyCode: string
  isCredit: boolean
  allocations: Array<{
    targetType: ChargeAllocationTarget
    targetLabel: string
    amount: number
  }>
  rule?: {
    name: string
    outcome: RuleOutcome
  }
}
