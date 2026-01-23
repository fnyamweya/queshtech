export type CustomerOrderSummary = {
  id: string
  orderNumber: string
  status: string
  total: number
  currencyCode?: string
  placedAt?: string
  createdAt?: string
}

export type PricingComponent = {
  type: 'BASE' | 'TAX' | 'DISCOUNT' | 'FEE'
  name: string
  amount: number
  rate?: number
  sourceType?: string
  sourceReference?: string
}

export type ItemPricing = {
  unitPrice: number
  baseSubtotal: number
  discountTotal: number
  feeTotal: number
  taxTotal: number
  total: number
  components: PricingComponent[]
}

export type CustomerOrderLineItem = {
  id: string
  name: string
  productName?: string
  productTitle?: string
  productSlug?: string
  productShortDescription?: string
  skuTitle?: string
  sku?: string
  productId?: string
  quantity: number
  price: number
  unitPrice?: number
  total?: number
  currencyCode?: string
  imageUrl?: string
  options?: Record<string, string>
  pricing?: ItemPricing
  batchId?: string
}

export type LocationInfo = {
  id: string
  name: string
  type: string
  typeDisplay?: string
}

export type ShippingAddress = {
  firstName?: string
  lastName?: string
  phone?: string
  countryCode?: string
  countryName?: string
  locationId?: string
  locationHierarchy: LocationInfo[]
  fields: Record<string, unknown>
}

export type OrderBatchItem = {
  id: string
  orderItemId: string
  quantity: number
}

export type OrderBatch = {
  id: string
  warehouseId?: string
  status?: string
  shippingAddress?: Record<string, unknown>
  items: OrderBatchItem[]
  createdAt: string
}

export type CustomerOrderDetail = {
  id: string
  orderNumber: string
  status: string
  date: string
  currencyCode?: string
  financialStatus?: string
  fulfillmentStatus?: string
  items: CustomerOrderLineItem[]
  subtotal?: number
  tax?: number
  shipping?: number
  discount?: number
  total?: number
  shippingName?: string
  shippingPhone?: string
  shippingAddressSummary?: string
  shippingAddress?: ShippingAddress
  batches?: OrderBatch[]
  notesCustomer?: string
  notesInternal?: string
  paymentMethod?: {
    type?: string
    label?: string
  }
  paymentSummary?: {
    status?: string
    capturedTotal?: number
    netPaidTotal?: number
  }
}
