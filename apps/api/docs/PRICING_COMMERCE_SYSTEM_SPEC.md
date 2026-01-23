# E2E Commerce System Technical Specification

**Version:** 1.0.0  
**Status:** Audit & Stabilization  
**Last Updated:** 2026-01-22

---

## Table of Contents

1. [Current State Architecture (AS-IS)](#1-current-state-architecture-as-is)
2. [End-to-End Flow (Authoritative)](#2-end-to-end-flow-authoritative)
3. [Pricing Pipeline (Deep Dive)](#3-pricing-pipeline-deep-dive)
4. [Data Model (Authoritative)](#4-data-model-authoritative)
5. [Ledger Integration Contract](#5-ledger-integration-contract)
6. [Invariants & Safety Guarantees](#6-invariants--safety-guarantees)
7. [Operational Model](#7-operational-model)
8. [Gap Analysis](#8-gap-analysis)

---

## 1. Current State Architecture (AS-IS)

### 1.1 Order Lifecycle

**Status:** ✅ Implemented

```
                                    ┌─────────────────────┐
                                    │       DRAFT         │
                                    │   (editable cart)   │
                                    └──────────┬──────────┘
                                               │ reprice / apply shipping quote
                                               ▼
                                    ┌─────────────────────┐
                                    │  AWAITING_SHIPPING  │
                                    │       _QUOTE        │
                                    └──────────┬──────────┘
                                               │ shipping quote applied
                                               ▼
                                    ┌─────────────────────┐
                                    │  READY_FOR_PAYMENT  │
                                    │   (pricing locked)  │
                                    └──────────┬──────────┘
                                               │ payment captured
                                               ▼
                                    ┌─────────────────────┐
                                    │      CONFIRMED      │
                                    └─────────┬───────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                    ┌─────────────┐   ┌─────────────┐  ┌─────────────┐
                    │  COMPLETED  │   │  CANCELLED  │  │  (refunds)  │
                    └─────────────┘   └─────────────┘  └─────────────┘
```

**Order Statuses (enum):**
- `PENDING` — Initial draft state
- `AWAITING_SHIPPING_QUOTE` — Requires shipping negotiation
- `READY_FOR_PAYMENT` — Pricing finalized
- `CONFIRMED` — Payment captured, ready for fulfillment
- `CANCELLED` — Terminated
- `COMPLETED` — All items fulfilled

**Financial Statuses:**
- `UNPAID` | `AUTHORIZED` | `PAID` | `REFUNDED`

**Fulfillment Statuses:**
- `UNFULFILLED` | `PARTIAL` | `FULFILLED` | `RETURNED`

### 1.2 Order Entities

| Entity | Purpose | Status |
|--------|---------|--------|
| `order` | Core order header with totals | ✅ Implemented |
| `order_item` | Line items with per-item pricing | ✅ Implemented |
| `order_item_charge` | Per-item charges (discount, tax, fee) | ✅ Implemented |
| `order_level_charge` | Order-level charges (shipping, discount) | ✅ Implemented |
| `order_shipping_address` | Immutable shipping snapshot | ✅ Implemented |

### 1.3 Pricebook Domain

**Status:** ✅ Implemented with Seeder

**Architecture:**

```
┌─────────────┐      ┌───────────────────┐      ┌────────────────────────┐
│  Pricebook  │──1:N─│ PricebookRevision │──1:N─│ PricebookAssignment    │
│  (regime)   │      │   (immutable)     │      │  (routing rules)       │
└─────────────┘      └───────────────────┘      └────────────────────────┘
       │                     │
       │                     │ binds to
       │                     ▼
       │             ┌───────────────────┐
       └─────────────│ OrderPricing      │
                     │ Snapshot          │
                     └───────────────────┘
```

**Entities:**

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| `pricebook` | Named pricing regime | `code`, `name`, `tenantId`, `isActive` |
| `pricebook_revision` | Immutable config version | `revisionNumber`, `status`, `effectiveFrom`, `effectiveTo`, `currencyCode`, `configSnapshot` |
| `pricebook_assignment` | Routes order context → pricebook | `priority`, routing dimensions (channel, customerGroup, country, salesChannel, merchant) |

**Routing Logic (`PricebookRoutingService`):**
1. Fetch all active assignments for tenant
2. Score each assignment against order context
3. Select by priority → match score → specificity score
4. Find effective published revision for pricebook + currency + timestamp

**Config Snapshot Schema:**
```typescript
interface PricebookConfigSnapshot {
  version: string;
  currency: string;
  catalogPricing?: { priceListRef, fallbackStrategy };
  promotions?: { promoSetRef, stacking };
  tax?: { profileRef, mode, vatRate, rounding, shippingIsTaxable };
  shipping?: { profileRef, grouping, ratingStrategy, fallbackStrategy, freeShippingThreshold };
  fees?: { profileRef };
  allocation?: { rules, residual };
}
```

**Seeder (`PricebookSeeder`):** ✅ Implemented
- Creates DEFAULT pricebook
- Creates published revision (KES, effective 2020-01-01)
- Creates wildcard assignment (priority=0)
- Optional: WEB channel assignment (priority=10), RETAIL group assignment (priority=20)

### 1.4 Order Pricing Pipeline

**Status:** ✅ Implemented with Draft Replace + Reconciliation

**Service:** `OrderPricingPipelineService`

**Core Methods:**
- `repriceDraftOrder(orderId, dto)` — Main repricing entrypoint
- `getCurrentPricing(orderId)` — Retrieve pricing artifacts

**Pipeline Steps:**
1. Resolve effective pricebook revision via routing service
2. Upsert `OrderPricingSnapshot` (binds order → revision)
3. Ensure idempotent `PricingRun` (SHA-256 of inputs)
4. **DRAFT CLEANUP:** Delete previous artifacts (`deletePreviousArtifactsTx`)
5. Execute pricing stages
6. **RECONCILIATION:** Validate invariants (`validateReconciliationTx`)
7. Mark run as SUCCEEDED or FAILED

**Pricing Artifacts Generated:**
| Artifact | Scope | Purpose |
|----------|-------|---------|
| `ChargeComponent` | ITEM/ORDER | Individual charges (BASE, DISCOUNT, TAX, SHIPPING) |
| `ChargeAllocation` | ITEM | Allocates order-level charges to items |
| `PricingAppliedRule` | ITEM/ORDER | Audit trail of rule decisions |

### 1.5 Shipping Matrix Service

**Status:** ✅ Implemented with Tests

**Service:** `ShippingMatrixService`

**Quote Resolution:**
1. Resolve zone IDs by location (locationId → zones, fallback to global)
2. Find active methods attached to zones
3. Filter by allowed/excluded method codes
4. For each method, evaluate rates:
   - Currency targeting
   - Channel targeting  
   - Weight/subtotal thresholds
   - Calculation types: `flat`, `per_weight`, `per_item`, `table_rate`, `formula`
5. Sort by effective priority → amount
6. Return sorted candidates

**Rate Calculation Types:**
- `flat` — Fixed price
- `per_weight` — `pricePerUnit × totalWeight`
- `per_item` — `pricePerUnit × itemCount`
- `table_rate` — Lookup by subtotal/weight tiers
- `formula` — Expression evaluation (`subtotal`, `totalWeight`, `itemCount`)

**Caching:** 60s TTL via `AppCacheService`

### 1.6 Tax Service

**Status:** ✅ Implemented (Simplified)

**Service:** `TaxService`

**Logic:**
- Check if tax enabled via `SettingService`
- Apply configured VAT rate to taxable amount
- Return `{ amount, rate, meta }`

**Limitations:**
- Single flat rate (no per-item or jurisdiction-based)
- No tax profiles or complex rules

### 1.7 Checkout Flow

**Status:** ✅ Implemented

**Service:** `CheckoutService`

**Session Lifecycle:**
1. `createSession` — Initialize with order items, cache state (30min TTL)
2. `setDelivery` — Save shipping address, resolve locationId
3. `getShippingMethods` — Fetch quotes from matrix service
4. `setShippingMethod` — Validate and lock shipping choice
5. `review` — Aggregate session state for confirmation UI
6. `confirm` — Create order, mark session completed

**State Storage:** Redis cache (`checkout:session:{id}`)

**Session Expiry:** Background job via `QueueService`

### 1.8 Payment Domain

**Status:** ✅ Implemented

**Entities:**
- `order_payment` — Payment record (type, status, provider, method, amount)
- `payment_allocation` — Allocates payment to order or specific items

**Payment Types:**
- `CAPTURE` — Inbound funds
- `REVERSAL` — Void/cancel before settlement
- `REFUND` — Return funds
- `ADJUSTMENT` — Manual correction (positive or negative)

**Payment Statuses:**
- `PENDING` | `SUCCEEDED` | `FAILED` | `CANCELLED`

**Derived Order Payment Status:**
```
netPaidTotal = capturedTotal + adjustedTotal - reversedTotal - refundedTotal

if refundedTotal > 0:
  if netPaidTotal <= 0 → REFUNDED
  else → PARTIALLY_REFUNDED
if netPaidTotal <= 0 → PENDING
if netPaidTotal < grandTotal → PARTIALLY_PAID
if netPaidTotal == grandTotal → PAID
else → OVERPAID
```

**Ledger Integration:** Only `SUCCEEDED` payments trigger journal entries

### 1.9 Fulfillment Domain

**Status:** ✅ Implemented

**Entities:**
- `order_fulfillment` — Fulfillment record
- `fulfillment_package` — Physical packages
- `package_item` — Items per package
- `fulfillment_item` — Aggregate quantities per order item

**Fulfillment Statuses:**
- `PACKED` | `SHIPPED` | `DELIVERED` | `CANCELLED`

**Order Fulfillment Aggregation:**
```
for each shippable item:
  fulfilledQty = SUM(fulfillment_item.quantity) where status != CANCELLED
  if fulfilledQty == 0 → unfulfilled
  if fulfilledQty < item.quantity → partial
  else → fulfilled

if all fulfilled → order.fulfillmentStatus = FULFILLED
if any fulfilled → PARTIAL
else → UNFULFILLED
```

**Revenue Recognition:**
- When fulfillment transitions to `DELIVERED`:
- Calculate delivered value = `Σ (item.total / item.quantity) × fulfillmentItem.quantity`
- Post journal entry: Dr OrderLiability, Cr SalesRevenue

### 1.10 Double-Entry Ledger

**Status:** ✅ Implemented

**Entities:**
- `accounting_account` — Chart of accounts
- `journal_entry` — Balanced entries with idempotency key
- `journal_entry_line` — Individual debit/credit lines

**Default Accounts:**
| Code | Name | Type |
|------|------|------|
| `1000:CASH_CLEARING` | Cash / Payment Processor Clearing | ASSET |
| `2100:ORDER_LIABILITY` | Order Liability (Unrecognized Revenue) | LIABILITY |
| `4000:SALES_REVENUE` | Sales Revenue | REVENUE |
| `6900:PAYMENT_ADJUSTMENTS` | Payment Adjustments | EXPENSE |

**Posting Events:**
| Event | Dr | Cr |
|-------|----|----|
| Payment CAPTURE | CashClearing | OrderLiability |
| Payment REFUND/REVERSAL | OrderLiability | CashClearing |
| Adjustment (positive) | CashClearing | OrderLiability |
| Adjustment (negative) | OrderLiability | CashClearing |
| Internal Adjustment (positive) | Adjustments | OrderLiability |
| Internal Adjustment (negative) | OrderLiability | Adjustments |
| Fulfillment DELIVERED | OrderLiability | SalesRevenue |

**Idempotency:**
- Each entry has unique `idempotencyKey`
- Format: `order_payment:{paymentId}`, `revenue_recognition:fulfillment:{fulfillmentId}`

---

## 2. End-to-End Flow (Authoritative)

### 2.1 Add to Cart

**Status:** ✅ Implemented (via Checkout Session)

```
POST /checkout/sessions
  Body: { orderItems: [{ productSkuId, quantity }], priceListId?, currencyCode? }

Flow:
  1. Validate order items
  2. Create CheckoutSession record (status=active, expiresAt=now+30min)
  3. Cache state in Redis
  4. Enqueue expiry job

Response: { id, status, expiresAt }
```

### 2.2 Create Order

**Status:** ✅ Implemented

```
POST /orders
  Body: CreateOrderDto { customerId, orderItems, priceListId?, shippingLocationId?, shippingMethodCode?, shippingAddress? }

Flow:
  1. Resolve customer (email, name)
  2. Resolve/upsert customer shipping address
  3. Resolve price list (explicit or default)
  4. Create order header (status=PENDING)
  5. For each item:
     a. Resolve SKU
     b. Resolve price via PriceService
     c. Create OrderItem
  6. Calculate shipping via ShippingMatrixService
  7. Persist shipping charge (OrderLevelCharge)
  8. Evaluate promotions via PromotionService
  9. Allocate discounts to items (proportional by baseSubtotal)
  10. Persist discount charges (OrderItemCharge + OrderLevelCharge)
  11. Calculate tax via TaxService
  12. Persist tax charges
  13. Rollup totals on order

DB Writes:
  - order (1)
  - order_shipping_address (1)
  - order_item (N)
  - order_item_charge (N × charges)
  - order_level_charge (shipping + discounts)

State: order.status = PENDING | AWAITING_SHIPPING_QUOTE
```

### 2.3 Resolve Delivery Groups

**Status:** 🟡 Partial (Single-group only)

**Current:** All items treated as single delivery group

**Target:**
```
1. Group items by warehouse (from inventory service)
2. Create DeliveryGroup records
3. Calculate shipping per group
4. Store group assignments on OrderItem
```

### 2.4 Reprice (Draft Order)

**Status:** ✅ Implemented

```
POST /orders/:id/reprice
  Body: RepriceOrderDto { currency?, at?, channelId?, customerGroupId?, countryCode?, salesChannelId?, merchantId?, pricingEngineVersion?, runtimeContext? }

Flow:
  1. Assert order status == DRAFT
  2. Resolve pricebook via PricebookRoutingService
  3. Begin transaction:
     a. Upsert OrderPricingSnapshot
     b. Ensure PricingRun (idempotent)
     c. If run already SUCCEEDED → return cached
     d. Delete previous artifacts (DRAFT REPLACE semantics)
     e. Execute pricing stages:
        - BASE charges (item subtotals)
        - DISCOUNT charges (promotions)
        - SHIPPING charges
        - TAX charges
        - Allocations
     f. Validate reconciliation invariants
     g. Mark run SUCCEEDED
     h. Rollup to order

Idempotency Key: SHA-256({ orderId, currency, revisionId, orderItems, shippingSubtotal, runtimeContext, address })

Failure Mode: Run marked FAILED with error payload
```

### 2.5 View Quote

**Status:** ✅ Implemented

```
GET /orders/:id/pricing

Response:
  {
    snapshot: OrderPricingSnapshot,
    pricingRun: PricingRun | null,
    charges: ChargeComponent[],
    allocations: ChargeAllocation[],
    appliedRules: PricingAppliedRule[]
  }
```

### 2.6 Checkout (Lock Pricing)

**Status:** 🟡 Partial

**Current:** No explicit lock mechanism. Snapshot exists but `lockedAt` never set.

**Required Implementation:**
```
POST /orders/:id/lock-pricing

Flow:
  1. Assert order.status == AWAITING_SHIPPING_QUOTE | READY_FOR_PAYMENT
  2. Assert snapshot exists
  3. Set snapshot.lockedAt = now()
  4. Set order.status = READY_FOR_PAYMENT
  5. Subsequent reprice calls MUST fail with SNAPSHOT_LOCKED
```

### 2.7 Payment

**Status:** ✅ Implemented

```
POST /orders/:orderId/payments
  Body: CreateOrderPaymentDto { type, status, provider, method, amount, currency, externalRef?, allocations?, metaJson? }

Flow:
  1. Validate order exists
  2. Assert currency matches
  3. Create OrderPayment
  4. Create PaymentAllocations (default: full amount to ORDER)
  5. If status == SUCCEEDED:
     a. Post journal entry (CashClearing ↔ OrderLiability)
  6. Update order.financialStatus (derived)

State Transitions:
  - If netPaidTotal >= grandTotal → order.status = CONFIRMED (TODO)
```

### 2.8 Fulfillment

**Status:** ✅ Implemented

```
POST /orders/:orderId/fulfillments
  Body: CreateOrderFulfillmentDto { status, packages: [{ items, weight?, dimensions?, trackingNumber? }], shippingMethodId?, tracking?, origin?, destination?, cost?, timestamps? }

Flow:
  1. Validate order exists
  2. Derive quantities from packages
  3. Prevent over-fulfillment
  4. Create OrderFulfillment
  5. Create FulfillmentPackages
  6. Create PackageItems (join table)
  7. Create FulfillmentItems
  8. Log events (fulfillment.created, order_item.allocated, etc.)
  9. Recompute order.fulfillmentStatus

PATCH /orders/:orderId/fulfillments/:id
  Body: UpdateOrderFulfillmentDto { status?, tracking?, timestamps?, shippingMethodId?, metaJson? }

Flow:
  1. Update fulfillment
  2. If status → DELIVERED:
     a. Calculate delivered value
     b. Post revenue recognition entry
  3. Log status event
  4. Recompute order.fulfillmentStatus
```

### 2.9 Revenue Recognition

**Status:** ✅ Implemented

**Trigger:** Fulfillment status → DELIVERED

**Calculation:**
```
deliveredAmount = Σ (item.total / item.quantity) × fulfillmentItem.quantity
```

**Journal Entry:**
```
Dr 2100:ORDER_LIABILITY   deliveredAmount
Cr 4000:SALES_REVENUE     deliveredAmount
```

**Idempotency Key:** `revenue_recognition:fulfillment:{fulfillmentId}`

### 2.10 Refunds (Partial + Full)

**Status:** ✅ Implemented

```
POST /orders/:orderId/payments
  Body: { type: 'REFUND', status: 'SUCCEEDED', amount: X, ... }

Journal Entry:
  Dr 2100:ORDER_LIABILITY   X
  Cr 1000:CASH_CLEARING     X
```

**Item-Level Refunds:**
```
allocations: [
  { appliesTo: 'ORDER_ITEM', orderItemId: '...', amount: X }
]
```

---

## 3. Pricing Pipeline (Deep Dive)

### 3.1 Pricebook Resolution

```typescript
resolvePricebook(dto: ResolvePricebookDto): Promise<PricebookResolutionResponse>

Input:
  - currency (required)
  - at (optional, default: now)
  - channelId, customerGroupId, countryCode, salesChannelId, merchantId (routing dimensions)

Algorithm:
  1. Fetch all active assignments for tenant
  2. For each assignment:
     a. Compute matchScore against context (-1 = mismatch, 0+ = match)
     b. Compute specificityScore (sum of populated dimensions)
  3. Sort by: priority DESC → matchScore DESC → specificityScore DESC
  4. Select first matching assignment
  5. Find effective revision:
     WHERE pricebook_id = X
       AND status = 'PUBLISHED'
       AND currency_code = Y
       AND effective_from <= at
       AND (effective_to IS NULL OR at < effective_to)
     ORDER BY effective_from DESC, revision_number DESC
     LIMIT 1

Output:
  {
    pricebookId,
    pricebookCode,
    pricebookRevisionId,
    revisionNumber,
    currency,
    effectiveFrom,
    effectiveTo,
    routing: { assignmentId, priority, specificityScore }
  }
```

### 3.2 Snapshot Binding

```typescript
upsertSnapshotTx(manager, orderId, dto)

Behavior:
  1. Validate revision exists and is PUBLISHED + effective
  2. Check existing snapshot:
     a. If exists AND locked → throw SNAPSHOT_LOCKED
     b. If exists AND not locked → update (revision, currency, engineVersion, runtimeContext)
     c. If not exists → create

Snapshot Fields:
  - orderId (unique)
  - pricebookRevisionId
  - currencyCode
  - pricingEngineVersion
  - runtimeContext (JSONB)
  - lockedAt (null until checkout)
```

### 3.3 Pricing Run Idempotency

```typescript
ensurePricingRunTx(manager, order, shippingAddress, snapshot, dto)

Idempotency Key Computation:
  SHA-256({
    orderId,
    currency,
    revisionId,
    orderItems: [{ id, productId, productSkuId, sku, quantity, unitPrice, baseSubtotal, requiresShipping }],
    shippingSubtotal,
    runtimeContext,
    address: { countryCode, locationId, fields }
  })

Behavior:
  - If run with same key exists → return existing
  - Else create new run (status=STARTED)
```

### 3.4 Artifact Generation Order

```
┌──────────────────────────────────────────────────────────────────────┐
│ Stage B: BASE Charges                                                │
│   For each item: ChargeComponent(scope=ITEM, type=BASE)             │
│   amount = item.baseSubtotal                                         │
│   PricingAppliedRule(ruleType=PRICING, ruleId=BASE_PRICE)           │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage C: DISCOUNT Charges (Promotions)                              │
│   1. Evaluate promotions via PromotionService                        │
│   2. Create ChargeComponent(scope=ORDER, type=DISCOUNT)              │
│      amount = -totalDiscount                                         │
│   3. If shippingDiscount > 0:                                        │
│      Create ChargeComponent(scope=ORDER, type=DISCOUNT, appliesToShipping=true) │
│   4. PricingAppliedRule(ruleType=PROMO) for each applied promotion  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage D: DISCOUNT Allocations                                        │
│   Allocate order-level discount to items proportionally              │
│   basis = item.baseSubtotal                                          │
│   For each item: ChargeAllocation(chargeComponentId, amount)         │
│   PricingAppliedRule(ruleType=ALLOCATION, ruleId=DISCOUNT)          │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage E: SHIPPING Charge                                             │
│   ChargeComponent(scope=ORDER, type=SHIPPING)                        │
│   amount = order.shippingSubtotal                                    │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage F: TAX Charges                                                 │
│   1. Calculate taxable = itemsSubtotal - totalDiscount + shippingNet │
│   2. Get tax amount via TaxService                                   │
│   3. Allocate tax to items + shipping proportionally                 │
│   4. For each item: ChargeComponent(scope=ITEM, type=TAX)           │
│   5. If shippingTax > 0: ChargeComponent(scope=ORDER, type=TAX)     │
│   6. PricingAppliedRule(ruleType=TAX) for each                      │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage G: Rollup Cache                                                │
│   Update order:                                                      │
│     discountTotal, shippingDiscount, taxTotal, shippingTax,         │
│     shippingTotal, grandTotal                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.5 Allocation Logic

```typescript
allocateProportionally(total, bases[], decimals=4): number[]

Algorithm:
  1. Normalize bases (max 0)
  2. Compute sum of bases
  3. If sum <= 0 → return zeros
  4. For each base: raw = (total × base) / sum
  5. Round to decimals
  6. Compute drift = total - Σ rounded
  7. Adjust first element by drift (absorb rounding error)

Example:
  total = 100
  bases = [60, 40]
  → [60.0000, 40.0000]

  total = 100
  bases = [33.33, 33.33, 33.34]
  → [33.3300, 33.3300, 33.3400] (drift adjusted)
```

### 3.6 Reconciliation Invariants

**Invariant 1: Discount Allocation Sum Consistency**
```
For each discount charge (scope=ORDER, appliesToShipping=false):
  Σ allocation.amount == charge.amount

Tolerance: 0.0001
```

**Invariant 2: Base Charge Sum Consistency**
```
Σ baseCharges (type=BASE, scope=ITEM) == order.itemsSubtotal

Tolerance: 0.0001
```

**Invariant 3: Discount Charge Sum Consistency**
```
Σ discountCharges (type=DISCOUNT) negated == discountTotal + shippingDiscount

Tolerance: 0.0001
```

**Invariant 4: Grand Total Consistency**
```
grandTotal == itemsSubtotal - discountTotal + shippingTotal + taxTotal

Tolerance: 0.0001
```

### 3.7 Locked vs Draft Behavior

| Aspect | DRAFT (unlocked) | LOCKED (post-checkout) |
|--------|------------------|------------------------|
| Snapshot.lockedAt | NULL | timestamp |
| Reprice | ✅ Allowed | ❌ Rejected (SNAPSHOT_LOCKED) |
| Artifact Handling | DELETE previous → CREATE new | APPEND-ONLY (TODO) |
| Snapshot Update | ✅ Allowed | ❌ Immutable |

### 3.8 Post-Checkout Adjustments

**Status:** 🟡 Not Implemented

**Required Behavior:**
- Locked snapshots cannot be modified
- Pricing adjustments must create NEW charges with:
  - `chargeType = 'ADJUSTMENT'`
  - Reference to original charge
  - Linked to adjustment PricingRun

---

## 4. Data Model (Authoritative)

### 4.1 Order Tables

#### `order`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| order_number | TEXT UNIQUE | Human-readable |
| external_id | TEXT | External system ref |
| customer_id | UUID | |
| customer_email | TEXT | Snapshot |
| customer_name | TEXT | Snapshot |
| price_list_id | UUID FK | |
| currency_code | CHAR(3) FK | |
| status | TEXT | Order status enum |
| financial_status | TEXT | Payment status |
| fulfillment_status | TEXT | Fulfillment status |
| items_subtotal | NUMERIC(18,4) | Σ item.baseSubtotal |
| discount_total | NUMERIC(18,4) | Item discounts |
| fee_total | NUMERIC(18,4) | |
| tax_total | NUMERIC(18,4) | Item taxes |
| shipping_subtotal | NUMERIC(18,4) | Before discount |
| shipping_discount | NUMERIC(18,4) | |
| shipping_tax | NUMERIC(18,4) | |
| shipping_total | NUMERIC(18,4) | Net shipping |
| grand_total | NUMERIC(18,4) | Final total |
| item_count | INT | |
| shipping_quote_pending | BOOL | |
| meta_json | JSONB | Extensible |
| placed_at, confirmed_at, cancelled_at, completed_at | TIMESTAMPTZ | |
| created_at, updated_at | TIMESTAMPTZ | |

**Immutability:** Mutable during DRAFT, soft-frozen after checkout

#### `order_item`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| order_id | UUID FK CASCADE | |
| product_id | UUID | |
| product_sku_id | UUID | |
| sku | TEXT | SKU code |
| product_name | TEXT | Snapshot |
| quantity | INT | |
| price_list_id | UUID | Resolved at creation |
| unit_price | NUMERIC(18,4) | |
| compare_at_price | NUMERIC(18,4) | |
| base_subtotal | NUMERIC(18,4) | unit_price × quantity |
| discount_total | NUMERIC(18,4) | |
| fee_total | NUMERIC(18,4) | |
| tax_total | NUMERIC(18,4) | |
| total | NUMERIC(18,4) | Net line total |
| requires_shipping | BOOL | |
| fulfillment_status | TEXT | |
| pricing_snapshot_json | JSONB | Price resolution |
| meta_json | JSONB | Includes weight |

**Immutability:** Created at order creation, not directly editable

#### `order_item_charge`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| order_item_id | UUID FK CASCADE | |
| charge_kind | TEXT | discount/tax/fee |
| code | TEXT | Promotion code |
| display_name | TEXT | |
| calculation_type | TEXT | |
| rate | NUMERIC(9,6) | Tax rate |
| base_amount | NUMERIC(18,4) | |
| quantity_basis | INT | |
| amount | NUMERIC(18,4) | Signed |
| is_included_in_price | BOOL | |
| source_type | TEXT | promotion/tax/fee |
| source_reference | TEXT | |
| meta_json | JSONB | |

#### `order_level_charge`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| order_id | UUID FK CASCADE | |
| charge_kind | TEXT | shipping/discount |
| display_name | TEXT | |
| calculation_type | TEXT | |
| rate | NUMERIC(9,6) | |
| base_amount | NUMERIC(18,4) | |
| amount | NUMERIC(18,4) | |
| is_included_in_price | BOOL | |
| applies_to_shipping | BOOL | |
| source_type | TEXT | |
| source_reference | TEXT | |
| meta_json | JSONB | |

### 4.2 Pricebook Tables

#### `pricebook`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| tenant_id | UUID | Multi-tenant |
| code | TEXT UNIQUE | |
| name | TEXT | |
| description | TEXT | |
| is_active | BOOL | |

**Immutability:** Soft delete via is_active

#### `pricebook_revision`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| tenant_id | UUID | |
| pricebook_id | UUID FK CASCADE | |
| revision_number | INT | Per-pricebook sequence |
| status | TEXT | DRAFT/PUBLISHED/DEPRECATED |
| effective_from | TIMESTAMPTZ | |
| effective_to | TIMESTAMPTZ | |
| currency_code | CHAR(3) | |
| config_snapshot | JSONB | Pricing constitution |
| published_at | TIMESTAMPTZ | |

**Immutability:** Once PUBLISHED, no modifications allowed

#### `pricebook_assignment`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| tenant_id | UUID | |
| pricebook_id | UUID FK CASCADE | |
| channel_id | UUID FK NULL | |
| customer_group_id | UUID FK NULL | |
| country_code | CHAR(2) | |
| sales_channel_id | UUID FK NULL | |
| merchant_id | UUID NULL | |
| priority | INT | Higher = preferred |
| is_active | BOOL | |
| conditions_json | JSONB | Future extensibility |

### 4.3 Pricing Artifact Tables

#### `order_pricing_snapshot`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| tenant_id | UUID | |
| order_id | UUID FK CASCADE UNIQUE | |
| pricebook_revision_id | UUID FK RESTRICT | |
| currency_code | CHAR(3) | |
| pricing_engine_version | TEXT | |
| locked_at | TIMESTAMPTZ NULL | Checkout boundary |
| runtime_context | JSONB | |
| created_at | TIMESTAMPTZ | |

**Immutability:** locked_at makes it immutable

#### `pricing_run`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| order_id | UUID FK CASCADE | |
| snapshot_id | UUID FK CASCADE | |
| idempotency_key | TEXT UNIQUE | SHA-256 |
| status | TEXT | STARTED/SUCCEEDED/FAILED |
| engine_version | TEXT | |
| error | JSONB NULL | Failure details |
| created_at | TIMESTAMPTZ | |
| finished_at | TIMESTAMPTZ NULL | |

#### `charge_component`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| order_id | UUID FK CASCADE | |
| order_item_id | UUID FK SET NULL | NULL for order-level |
| snapshot_id | UUID FK CASCADE | |
| pricing_run_id | UUID FK CASCADE | |
| scope | TEXT | ORDER/ITEM |
| charge_type | TEXT | BASE/DISCOUNT/TAX/SHIPPING |
| currency_code | CHAR(3) | |
| code | TEXT | |
| display_name | TEXT | |
| amount | NUMERIC(18,4) | Signed |
| meta_json | JSONB | |

#### `charge_allocation`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| order_id | UUID FK CASCADE | |
| order_item_id | UUID FK SET NULL | |
| snapshot_id | UUID FK CASCADE | |
| pricing_run_id | UUID FK CASCADE | |
| charge_component_id | UUID FK CASCADE | Parent charge |
| amount | NUMERIC(18,4) | Allocated portion |
| meta_json | JSONB | |

#### `pricing_applied_rule`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| order_id | UUID FK CASCADE | |
| order_item_id | UUID FK SET NULL | |
| snapshot_id | UUID FK CASCADE | |
| pricing_run_id | UUID FK CASCADE | |
| rule_type | TEXT | PRICING/PROMO/TAX/ALLOCATION |
| rule_id | TEXT | External ref |
| rule_version | TEXT | |
| decision | TEXT | APPLIED/SKIPPED/REJECTED |
| trace | JSONB | Debug info |

### 4.4 Ledger Tables

#### `accounting_account`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| code | TEXT UNIQUE | e.g., 1000:CASH_CLEARING |
| name | TEXT | |
| type | TEXT | ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE |
| is_active | BOOL | |
| meta_json | JSONB | |

#### `journal_entry`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| source_type | TEXT | ORDER_PAYMENT, ORDER_FULFILLMENT |
| source_id | TEXT | Payment/Fulfillment ID |
| idempotency_key | TEXT UNIQUE | |
| currency_code | CHAR(3) | |
| posted_at | TIMESTAMPTZ | |
| memo | TEXT | |
| meta_json | JSONB | |

**Immutability:** Journal entries are append-only, never updated

#### `journal_entry_line`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| entry_id | UUID FK CASCADE | |
| account_id | UUID FK RESTRICT | |
| debit | NUMERIC(18,4) | |
| credit | NUMERIC(18,4) | |
| currency_code | CHAR(3) | |
| memo | TEXT | |
| meta_json | JSONB | |

---

## 5. Ledger Integration Contract

### 5.1 When Ledger Is Posted

| Event | Trigger | Condition |
|-------|---------|-----------|
| Payment | `createForOrder()` | status == SUCCEEDED |
| Revenue Recognition | `updateForOrder()` | status transitions to DELIVERED |

### 5.2 Events → Journal Entries

#### Payment CAPTURE
```
Idempotency: order_payment:{paymentId}
Dr 1000:CASH_CLEARING     amount
Cr 2100:ORDER_LIABILITY   amount
```

#### Payment REFUND
```
Idempotency: order_payment:{paymentId}
Dr 2100:ORDER_LIABILITY   amount
Cr 1000:CASH_CLEARING     amount
```

#### Payment REVERSAL
```
Idempotency: order_payment:{paymentId}
Dr 2100:ORDER_LIABILITY   amount
Cr 1000:CASH_CLEARING     amount
```

#### Payment ADJUSTMENT (Positive)
```
Idempotency: order_payment:{paymentId}
Dr 1000:CASH_CLEARING     |amount|
Cr 2100:ORDER_LIABILITY   |amount|
```

#### Payment ADJUSTMENT (Negative)
```
Idempotency: order_payment:{paymentId}
Dr 2100:ORDER_LIABILITY   |amount|
Cr 1000:CASH_CLEARING     |amount|
```

#### Internal ADJUSTMENT (Manual)
```
// Positive
Dr 6900:PAYMENT_ADJUSTMENTS  |amount|
Cr 2100:ORDER_LIABILITY      |amount|

// Negative
Dr 2100:ORDER_LIABILITY      |amount|
Cr 6900:PAYMENT_ADJUSTMENTS  |amount|
```

#### Fulfillment DELIVERED
```
Idempotency: revenue_recognition:fulfillment:{fulfillmentId}
Dr 2100:ORDER_LIABILITY   deliveredAmount
Cr 4000:SALES_REVENUE     deliveredAmount
```

### 5.3 Idempotency Strategy

1. All entries have unique `idempotencyKey`
2. `postEntry()` checks for existing entry before insert
3. If exists → return existing (no-op)
4. If not exists → insert atomically

### 5.4 Refund Reversal

**Full Refund:**
```
// Original Capture
Dr CASH_CLEARING 100    Cr ORDER_LIABILITY 100

// Refund
Dr ORDER_LIABILITY 100  Cr CASH_CLEARING 100

// Net on ORDER_LIABILITY: 0 (cleared)
// Net on CASH_CLEARING: 0 (returned)
```

**Partial Refund:**
```
// Original Capture
Dr CASH_CLEARING 100    Cr ORDER_LIABILITY 100

// Partial Refund (40)
Dr ORDER_LIABILITY 40   Cr CASH_CLEARING 40

// Net on ORDER_LIABILITY: 60 (outstanding)
// Net on CASH_CLEARING: 60 (retained)
```

---

## 6. Invariants & Safety Guarantees

### 6.1 Allocation Sum Invariants

| Invariant | Location | Violation Handling |
|-----------|----------|-------------------|
| Discount allocation sum == charge amount | `validateReconciliationTx` | RECONCILIATION_FAILED |
| Payment allocation sum == payment amount | `createForOrder` | BadRequestException |

### 6.2 Total Consistency Invariants

| Invariant | Location | Violation Handling |
|-----------|----------|-------------------|
| BASE charge sum == itemsSubtotal | `validateReconciliationTx` | RECONCILIATION_FAILED |
| DISCOUNT charge sum == discountTotal + shippingDiscount | `validateReconciliationTx` | RECONCILIATION_FAILED |
| grandTotal == itemsSubtotal - discountTotal + shippingTotal + taxTotal | `validateReconciliationTx` | RECONCILIATION_FAILED |

### 6.3 Ledger Balance Invariant

| Invariant | Location | Violation Handling |
|-----------|----------|-------------------|
| Entry Σdebit == Σcredit | `postEntry` | BadRequestException |

### 6.4 Snapshot Immutability

| Invariant | Location | Violation Handling |
|-----------|----------|-------------------|
| Locked snapshot cannot be modified | `upsertSnapshotTx` | SNAPSHOT_LOCKED |
| Locked snapshot cannot be repriced | `repriceDraftOrder` | SNAPSHOT_LOCKED |

### 6.5 Pricing Reproducibility

| Invariant | Description |
|-----------|-------------|
| Same idempotency key → same result | `ensurePricingRunTx` returns existing run |
| Revision immutability | PUBLISHED revisions cannot change |

### 6.6 Fulfillment Quantity Invariant

| Invariant | Location | Violation Handling |
|-----------|----------|-------------------|
| Cannot fulfill > remaining quantity | `createForOrder` | BadRequestException |

---

## 7. Operational Model

### 7.1 Idempotency Keys

| Operation | Key Format | Purpose |
|-----------|------------|---------|
| Pricing Run | SHA-256(inputs) | Dedup repricing |
| Journal Entry | `order_payment:{id}`, `revenue_recognition:fulfillment:{id}` | Dedup posting |
| Order Event | `{target}:{id}:{action}` | Dedup event logging |

### 7.2 Concurrency Behavior

| Resource | Lock Type | Scope |
|----------|-----------|-------|
| Order (payment) | Pessimistic write | Transaction |
| Order (fulfillment) | Pessimistic write | Transaction |
| Pricing snapshot | Application-level | Via `lockedAt` |

### 7.3 Retry Safety

| Operation | Safe to Retry | Notes |
|-----------|---------------|-------|
| Reprice | ✅ | Idempotent via run key |
| Payment create | ⚠️ | Use client idempotency key |
| Fulfillment create | ⚠️ | Use client idempotency key |
| Journal post | ✅ | Idempotent via entry key |

### 7.4 Observability Events

| Event | Emitter | Payload |
|-------|---------|---------|
| `order.created` | OrderService | orderId, orderNumber |
| `order.fulfillment.created` | OrderFulfillmentService | orderId, fulfillmentId |
| `order.fulfillment.status.*` | OrderFulfillmentService | orderId, fulfillmentId, status |
| `order_item.fulfillment.allocated` | OrderFulfillmentService | orderItemId, fulfillmentId, quantity |
| `package.*` | OrderFulfillmentService | packageId, fulfillmentId |

### 7.5 Failure Recovery

| Failure | Recovery Strategy |
|---------|-------------------|
| Pricing run failure | Run marked FAILED with error, can retry |
| Payment failure | Payment status = FAILED, no ledger entry |
| Ledger posting failure | Transaction rolled back, can retry |

### 7.6 Repricing Policies

| Policy | Implementation |
|--------|----------------|
| Draft orders | Full replace (delete + recreate) |
| Locked orders | Reject (SNAPSHOT_LOCKED) |
| Shipping quote update | Via `applyShippingQuote` (TODO: trigger reprice) |

---

## 8. Gap Analysis

### 8.1 Production-Ready ✅

| Component | Status | Notes |
|-----------|--------|-------|
| Order entity model | ✅ | Complete |
| Order item charges | ✅ | Complete |
| Pricebook domain | ✅ | Seeder + routing |
| Pricing snapshot binding | ✅ | Complete |
| Pricing run idempotency | ✅ | SHA-256 keying |
| Draft replace semantics | ✅ | `deletePreviousArtifactsTx` |
| Reconciliation invariants | ✅ | 4 invariants enforced |
| Shipping matrix service | ✅ | With tests |
| Payment domain | ✅ | Complete |
| Fulfillment domain | ✅ | Complete |
| Double-entry ledger | ✅ | Complete |
| Revenue recognition | ✅ | On fulfillment delivery |

### 8.2 Missing / Incomplete 🟡

| Component | Status | Priority | Effort |
|-----------|--------|----------|--------|
| **Checkout lock mechanism** | 🟡 Missing | P0 | Low |
| `lockedAt` never set on snapshot | | | |
| **Locked append-only semantics** | 🟡 Missing | P1 | Medium |
| Post-checkout adjustments create new charges vs replace | | | |
| **Delivery groups** | 🟡 Partial | P2 | Medium |
| Single-group only, no warehouse grouping | | | |
| **Tax profiles** | 🟡 Basic | P2 | Medium |
| Single flat rate, no jurisdiction support | | | |
| **Rounding configuration** | 🟡 Partial | P2 | Low |
| Config exists but not wired to pipeline | | | |
| **Order status transitions** | 🟡 Missing | P1 | Low |
| No automatic CONFIRMED on payment | | | |
| **Shipping allocation to items** | 🟡 Missing | P2 | Medium |
| Shipping not allocated to items for item-level reporting | | | |

### 8.3 Risks ⚠️

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Unlocked repricing post-checkout** | Financial discrepancy | Implement `lockedAt` check immediately |
| **Single delivery group** | Incorrect shipping for multi-warehouse | Implement delivery group resolution |
| **No payment → order status sync** | Orders stuck in wrong status | Auto-transition on netPaidTotal >= grandTotal |
| **Tax calculation simplistic** | Incorrect taxes for different jurisdictions | Implement tax profiles |

### 8.4 Next Steps (Prioritized)

**P0 (Immediate):**
1. Implement `lockPricing()` endpoint
2. Set `snapshot.lockedAt` on checkout
3. Reject reprice attempts on locked snapshots

**P1 (Short-term):**
4. Implement locked append-only semantics for adjustments
5. Auto-transition order status on payment success
6. Add comprehensive E2E tests for locked order flows

**P2 (Medium-term):**
7. Implement delivery group resolution
8. Implement tax profiles with jurisdiction support
9. Wire rounding configuration to pipeline
10. Implement shipping allocation to items

**P3 (Long-term):**
11. Multi-currency order support
12. Complex promotion stacking rules
13. Deferred revenue recognition policies
14. Audit log for all financial operations

---

## Appendix A: API Reference

### Pricing Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/orders/:id/reprice` | Reprice a DRAFT order |
| GET | `/orders/:id/pricing` | Get pricing artifacts |

### Payment Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/orders/:id/payments` | List payments |
| POST | `/orders/:id/payments` | Create payment |
| GET | `/orders/:id/payments/summary` | Get payment summary |

### Fulfillment Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/orders/:id/fulfillments` | List fulfillments |
| POST | `/orders/:id/fulfillments` | Create fulfillment |
| PATCH | `/orders/:id/fulfillments/:fid` | Update fulfillment |

### Ledger Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/accounting/journal-entries` | List entries |
| GET | `/accounting/trial-balance` | Get trial balance |
| GET | `/accounting/revenue` | Periodic revenue |
| GET | `/accounting/cash-receipts` | Periodic cash flow |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Pricebook** | Named pricing regime with configuration |
| **Revision** | Immutable snapshot of pricebook configuration |
| **Assignment** | Routing rule that maps order context to pricebook |
| **Snapshot** | Binding of order to specific pricebook revision |
| **Pricing Run** | Single execution of pricing pipeline |
| **Charge Component** | Individual charge (BASE, DISCOUNT, TAX, SHIPPING) |
| **Charge Allocation** | Distribution of order-level charge to items |
| **Applied Rule** | Audit record of rule evaluation |
| **Idempotency Key** | Unique identifier for deduplication |

---

*Document generated from codebase audit. For questions, contact the platform engineering team.*
