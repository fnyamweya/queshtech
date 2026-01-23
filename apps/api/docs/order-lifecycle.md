# Order Lifecycle (Frontend + Stakeholders)

This document describes the **current implemented** order lifecycle in this codebase (NestJS + TypeORM), using **business language** but staying **technically exact**.

**API base**: `/api/v1` (global prefix `api` + URI versioning `v1`).

**Auth**: Most endpoints require `Authorization: Bearer <JWT>`.

---

## 1) User Journeys (what the user does)

### Journey A — Standard checkout (customer)

**Goal:** Customer builds a cart, chooses delivery, sees totals, confirms, then pays.

**Typical endpoint sequence**

1) Create checkout session
- `POST /api/v1/checkout/sessions`
- Body:
  ```json
  {
    "orderItems": [{ "productSkuId": "<uuid>", "quantity": 2 }],
    "priceListId": "<uuid>",
    "currencyCode": "KES"
  }
  ```
- Result: a checkout session draft (Redis-backed; TTL is implemented in service code).

2) Set delivery address
- `PUT /api/v1/checkout/sessions/:id/delivery`
- Body:
  ```json
  {
    "shippingAddress": {
      "firstName": "Jane",
      "lastName": "Doe",
      "phone": "+254700000000",
      "address1": "123 Main St",
      "city": "Nairobi",
      "countryCode": "KE",
      "locationId": "<uuid>"
    }
  }
  ```
  (Exact address fields are validated by the Address module’s DTO; the shape above is representative.)

3) List shipping methods for that checkout session
- `GET /api/v1/checkout/sessions/:id/shipping-methods`
- Result: list of methods (internally based on shipping quotes).

4) Choose shipping method
- `PUT /api/v1/checkout/sessions/:id/shipping-method`
- Body:
  ```json
  { "shippingMethodCode": "standard" }
  ```

5) Review (totals preview)
- `GET /api/v1/checkout/sessions/:id/review`
- Result: review summary for the draft session.

6) Confirm checkout (creates the Order)
- `POST /api/v1/checkout/sessions/:id/confirm`
- Result: `{ orderId, ... }` (created order).

7) Reprice the order to produce canonical pricing artifacts
- `POST /api/v1/orders/:orderId/reprice`
- Body: optional overrides (currency, routing hints, runtime context)
  ```json
  {
    "currency": "KES",
    "runtimeContext": {
      "promoCodes": ["PROMO10"]
    }
  }
  ```

8) Lock pricing at the checkout boundary (immutability)
- `POST /api/v1/orders/:orderId/lock-pricing`
- Body:
  ```json
  { "clientIdempotencyKey": "ck_01JXYZ..." }
  ```
- Result: pricing snapshot gets `lockedAt`, and order status becomes `ready_for_payment`.

9) Capture payment
- `POST /api/v1/orders/:orderId/payments`
- Body:
  ```json
  {
    "type": "CAPTURE",
    "status": "SUCCEEDED",
    "provider": "MNO",
    "method": "MOBILE_MONEY",
    "amount": 150000,
    "currency": "KES",
    "externalRef": "mno_txn_123",
    "allocations": [
      { "appliesTo": "ORDER", "amount": 150000, "currency": "KES" }
    ]
  }
  ```

**Frontend rule of thumb:** You can treat `POST /orders/:id/lock-pricing` as the “Place order / commit totals” boundary; you can treat `POST /orders/:id/payments (CAPTURE)` as “Paid”.

---

### Journey B — Shipping quotes before checkout (cart page)

**Goal:** show shipping options *before* creating a checkout session.

- `POST /api/v1/shipping/quotes`
- Body:
  ```json
  {
    "shippingLocationId": "<uuid>",
    "orderItems": [{ "productSkuId": "<uuid>", "quantity": 2 }],
    "priceListId": "<uuid>",
    "currencyCode": "KES",
    "salesChannelCode": "default"
  }
  ```

The returned methods are compatible with `shippingMethodCode` in checkout sessions.

---

### Journey C — Negotiated shipping quote (ops/admin)

**Goal:** set a custom shipping cost after an order is created (e.g., courier negotiation).

- `POST /api/v1/orders/:orderId/shipping/quote`
- Body:
  ```json
  {
    "amount": 750,
    "currencyCode": "KES",
    "note": "Negotiated via courier",
    "sendNotifications": true
  }
  ```

This updates order shipping totals and is often used to move an order from “awaiting quote” to “ready for payment” (exact state transition depends on order service logic).

---

### Journey D — Post-checkout goodwill adjustment (append-only)

**Goal:** apply a manual correction *after* pricing has been locked (e.g., goodwill, small correction).

- `POST /api/v1/orders/:orderId/pricing-adjustments`
- Preconditions (enforced): pricing snapshot must be locked; base pricing run must exist.
- Body:
  ```json
  {
    "clientIdempotencyKey": "adj_01JXYZ...",
    "adjustments": [
      { "amount": -50, "displayName": "Goodwill", "reason": "manual_adjustment", "meta": { "note": "Promo goodwill" } }
    ]
  }
  ```
- Result: creates a `pricing_run` with `kind=ADJUSTMENT`, appends adjustment charge components, and updates `order.feeTotal` and `order.grandTotal`.

---

### Journey E — Partial fulfillment and completion

**Goal:** ship items in parts, update fulfillment status, and eventually complete the order.

- Create fulfillment: `POST /api/v1/orders/:orderId/fulfillments`
- Update fulfillment: `PATCH /api/v1/orders/:orderId/fulfillments/:fulfillmentId`

The fulfillment service recomputes item and order fulfillment statuses based on fulfilled quantities.

---

### Journey F — Refunds / reversals

Refunds are recorded via the same payments endpoint:
- `POST /api/v1/orders/:orderId/payments` with `type=REFUND` (and a negative/positive allocation policy enforced by the payment service).

---

## 2) Canonical Workflow (system view)

This is the “happy path” lifecycle in implementation terms:

1) **Draft cart** exists as a checkout session (`/checkout/sessions/*`).
2) **Order is created** by confirming the checkout session (`POST /checkout/sessions/:id/confirm`) or via admin order creation (`POST /orders`).
3) **Pricing run (STANDARD)** is produced by `POST /orders/:id/reprice`.
   - This resolves an effective pricebook revision.
   - It upserts an **unlocked** `order_pricing_snapshot`.
   - It produces immutable pricing artifacts (`charge_component`, `charge_allocation`, `pricing_applied_rule`).
4) **Checkout boundary**: lock pricing via `POST /orders/:id/lock-pricing`.
   - After this point repricing is forbidden (`SNAPSHOT_LOCKED`).
5) **Payment capture** via `POST /orders/:id/payments` with `type=CAPTURE`.
   - Guard: CAPTURE requires locked pricing (`QUOTE_NOT_LOCKED`).
   - Successful capture updates derived payment status and may transition order status to `confirmed` (per payment service).
6) **Fulfillment** via `POST/PATCH /orders/:id/fulfillments/*`.
   - Partial fulfillment supported.
7) **Post-lock adjustments** (optional) via `POST /orders/:id/pricing-adjustments`.
   - Append-only pricing changes; does not mutate previous artifacts.

---

## 3) Backend → Frontend Contract (what FE can rely on)

### 3.1 Response envelope (success)
All successful endpoints use a consistent wrapper (see ResponseUtil):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "...",
  "data": {},
  "meta": null,
  "timestamp": "2026-01-06T12:00:00.000Z"
}
```

### 3.2 Error envelope (failure)
All failures use a consistent wrapper (see HttpExceptionFilter):
```json
{
  "success": false,
  "statusCode": 409,
  "message": "...",
  "error": "Error",
  "details": {
    "code": "SNAPSHOT_LOCKED"
  },
  "timestamp": "..."
}
```
Key detail: if backend throws `{ code, message, details? }`, the filter will surface `details.code`.

### 3.3 Order record: key fields
`GET /api/v1/orders/:id` returns an `OrderDto` including:
- `status`: `pending | awaiting_shipping_quote | ready_for_payment | confirmed | cancelled | completed`
- `financialStatus`: `unpaid | partially_paid | paid | refunded | ...` (string enum in entity)
- Totals: `itemsSubtotal`, `discountTotal`, `feeTotal`, `taxTotal`, `shippingTotal`, `grandTotal` (strings with 4dp)
- `paymentSummary`: derived from successful payment allocations

### 3.4 Pricing read model
`GET /api/v1/orders/:id/pricing` returns a pricing “read model”:
```json
{
  "snapshot": { "id": "...", "lockedAt": "...", "runtimeContext": {} },
  "pricingRun": { "id": "...", "kind": "STANDARD", "status": "SUCCEEDED" },
  "adjustmentRuns": [{ "id": "...", "kind": "ADJUSTMENT", "status": "SUCCEEDED" }],
  "charges": [],
  "allocations": [],
  "appliedRules": []
}
```
Important: `charges/allocations/appliedRules` are returned across the base run plus all *subsequent* successful adjustment runs.

### 3.5 Safe retries / idempotency
- Pricing adjustments are idempotent **by design** when `clientIdempotencyKey` is used; the backend hashes it into a run key.
- Pricing lock accepts `clientIdempotencyKey` in DTO but the current implementation does not use it to de-duplicate. Treat lock as “retry-safe” only if the client can tolerate a 409 `SNAPSHOT_ALREADY_LOCKED`.

---

## 4) Deep Dive (how the backend enforces correctness)

### 4.1 Pricing immutability at checkout
- `POST /orders/:id/lock-pricing` sets `order_pricing_snapshot.lockedAt`.
- After `lockedAt` is set, **repricing is forbidden** and `POST /orders/:id/reprice` returns 409 with `details.code = SNAPSHOT_LOCKED`.

### 4.2 Stale quote protection (“quote fingerprint”)
When repricing, the service computes and stores a deterministic `quoteFingerprint` in snapshot `runtimeContext`.

When locking, the service recomputes the fingerprint from current canonical inputs (items, shipping totals, shipping address, runtime context) and compares.

If mismatch: 409 with `details.code = QUOTE_STALE_REPRICE_REQUIRED`.

**Frontend guidance:** if you receive `QUOTE_STALE_REPRICE_REQUIRED`, you should trigger a reprice (or re-run the review step) and ask the customer to confirm updated totals.

### 4.3 Append-only adjustments
Adjustments:
- require locked snapshot (`SNAPSHOT_NOT_LOCKED`)
- require that a base pricing run exists (`PRICING_NOT_COMPUTED`)
- reject all-zero payloads (`NOOP_ADJUSTMENT`)
- may reject reusing an idempotency key if a prior run failed (`IDEMPOTENCY_KEY_REUSE_FAILED`)

Adjustments are implemented by:
- creating `pricing_run(kind=ADJUSTMENT)`
- appending `charge_component(scope=ORDER, chargeType=ADJUSTMENT)`
- appending `pricing_applied_rule(ruleType=ADJUSTMENT)`
- incrementing `order.feeTotal` and `order.grandTotal`

### 4.4 Delivery groups groundwork
`POST /orders/:id/delivery-groups/resolve` currently resolves a **single** group containing all eligible items and persists:
- `delivery_group` rows
- `delivery_group_item` rows
- a summary into pricing snapshot `runtimeContext.deliveryGroups`

This is groundwork for future multi-warehouse allocation.

### 4.5 Payment capture guard
`POST /orders/:id/payments` enforces:
- for `type=CAPTURE`, pricing snapshot must be locked
  - if not locked: 409 with `details.code = QUOTE_NOT_LOCKED`

Payments can include `allocations` to order or order items; allocations must sum to payment amount.

---

## 5) Endpoint Inventory (implemented routes)

### Checkout
- `POST /api/v1/checkout/sessions`
- `PUT /api/v1/checkout/sessions/:id/delivery`
- `GET /api/v1/checkout/sessions/:id/shipping-methods`
- `PUT /api/v1/checkout/sessions/:id/shipping-method`
- `GET /api/v1/checkout/sessions/:id/review`
- `POST /api/v1/checkout/sessions/:id/confirm`

### Shipping
- `POST /api/v1/shipping/quotes`

### Orders (core)
- `POST /api/v1/orders`
- `GET /api/v1/orders/:id`

### Orders (pricing)
- `POST /api/v1/orders/:id/reprice`
- `GET /api/v1/orders/:id/pricing`
- `POST /api/v1/orders/:id/lock-pricing`
- `POST /api/v1/orders/:id/pricing-adjustments`

### Orders (delivery groups / shipping)
- `POST /api/v1/orders/:id/delivery-groups/resolve`
- `POST /api/v1/orders/:id/shipping/quote`

### Payments
- `GET /api/v1/orders/:orderId/payments`
- `GET /api/v1/orders/:orderId/payments/summary`
- `POST /api/v1/orders/:orderId/payments`

### Fulfillment
- `GET /api/v1/orders/:orderId/fulfillments`
- `GET /api/v1/orders/:orderId/fulfillments/:fulfillmentId`
- `POST /api/v1/orders/:orderId/fulfillments`
- `PATCH /api/v1/orders/:orderId/fulfillments/:fulfillmentId`

---

## 6) Error Handling (machine-readable codes + UI recovery)

The FE should branch on `details.code` (when present):

- `SNAPSHOT_LOCKED` (409): order already committed; do not reprice. Refresh order + pricing.
- `SNAPSHOT_ALREADY_LOCKED` (409): treat as success for “lock” UX; move to payment.
- `SNAPSHOT_NOT_LOCKED` (409): must lock pricing before adjustments.
- `QUOTE_STALE_REPRICE_REQUIRED` (409): re-run `POST /orders/:id/reprice`, refresh review, ask user to confirm again.
- `ORDER_NOT_DRAFT` (409): repricing endpoint only supports draft orders.
- `PRICING_RUN_NOT_SUCCEEDED` (409): pricing must finish successfully before lock.
- `PRICING_NOT_COMPUTED` (409): base pricing must exist before adjustments.
- `NOOP_ADJUSTMENT` (400): show “adjustment amount must be non-zero”.
- `IDEMPOTENCY_KEY_REUSE_FAILED` (409): the previous attempt failed; generate a new idempotency key.
- `QUOTE_NOT_LOCKED` (409): payment capture blocked until pricing is locked.

Validation errors from DTOs are returned as `details: string[]` with message “Validation failed”.

---

## 7) “Explain” Read Model Concept (how to build UI screens)

The system stores pricing outcomes as **facts** (artifacts) rather than only mutating totals:

- `charge_component`: the “what” (base price, discount, tax, fees, adjustments)
- `charge_allocation`: the “where” (allocation of charges to order/items/shipping)
- `pricing_applied_rule`: the “why” (which rule/promo/adjustment produced which charge)

`GET /orders/:id/pricing` is the primary read-model endpoint for building:
- a line-by-line receipt UI
- an audit view (“why did this discount apply?”)
- post-lock adjustment audit

A minimal FE view model can:
1) display order-level totals from `GET /orders/:id`
2) show detailed breakdown from `GET /orders/:id/pricing` by grouping `charges` by `scope` and `chargeType`

---

## 8) Known Gaps / Not Yet Implemented (explicit)

These are **intentional gaps** relative to an end-state commerce system:

- Multi-warehouse splitting is not implemented: delivery groups resolver currently creates one group.
- Per-item shipping allocation is not implemented: delivery groups exist, but shipping charges are not split by group.
- Lock idempotency key is not enforced server-side (DTO accepts it, implementation currently ignores it).
- Checkout confirm idempotency is not documented/guaranteed (treat `POST /checkout/sessions/:id/confirm` as potentially non-idempotent).
- There is no dedicated “Explain endpoint” beyond `GET /orders/:id/pricing` (which is sufficient for many UIs but not a tailored audit API).
