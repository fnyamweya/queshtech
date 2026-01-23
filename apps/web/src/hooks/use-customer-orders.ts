import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import type {
  CustomerOrderDetail,
  CustomerOrderLineItem,
  CustomerOrderSummary,
  ItemPricing,
  LocationInfo,
  OrderBatch,
  OrderBatchItem,
  PricingComponent,
  ShippingAddress,
} from '@/types/customer-orders'

type ApiLike = any

function extractList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload
  const p: any = payload as any
  if (Array.isArray(p?.data)) return p.data
  if (Array.isArray(p?.items)) return p.items
  if (Array.isArray(p?.results)) return p.results
  if (Array.isArray(p?.data?.items)) return p.data.items
  if (Array.isArray(p?.data?.results)) return p.data.results
  return []
}

const toNumber = (value: any): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

const normalizeDate = (raw: any): string | undefined => {
  if (!raw) return undefined
  if (typeof raw === 'string') return raw
  if (raw instanceof Date) return raw.toISOString()
  return String(raw)
}

const normalizeStatus = (status?: string): string => {
  const value = (status || 'pending').toLowerCase()
  if (value === 'completed') return 'delivered'
  return value
}

const toSummary = (raw: ApiLike): CustomerOrderSummary | null => {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || raw.orderId || '').trim()
  const orderNumber = String(raw.orderNumber || raw.orderNo || id).trim()
  if (!id || !orderNumber) return null

  return {
    id,
    orderNumber,
    status: normalizeStatus(raw.status),
    total: toNumber(raw.grandTotal ?? raw.total),
    currencyCode: typeof raw.currencyCode === 'string' ? raw.currencyCode : undefined,
    placedAt: normalizeDate(raw.placedAt),
    createdAt: normalizeDate(raw.createdAt),
  }
}

const toPricingComponent = (raw: any): PricingComponent | null => {
  if (!raw || typeof raw !== 'object') return null
  return {
    type: raw.type || 'BASE',
    name: raw.name || '',
    amount: toNumber(raw.amount),
    rate: raw.rate != null ? toNumber(raw.rate) : undefined,
    sourceType: raw.sourceType,
    sourceReference: raw.sourceReference,
  }
}

const toItemPricing = (raw: any): ItemPricing | null => {
  if (!raw || typeof raw !== 'object') return null
  return {
    unitPrice: toNumber(raw.unitPrice),
    baseSubtotal: toNumber(raw.baseSubtotal),
    discountTotal: toNumber(raw.discountTotal),
    feeTotal: toNumber(raw.feeTotal),
    taxTotal: toNumber(raw.taxTotal),
    total: toNumber(raw.total),
    components: Array.isArray(raw.components)
      ? raw.components.map(toPricingComponent).filter(Boolean) as PricingComponent[]
      : [],
  }
}

const toLocationInfo = (raw: any): LocationInfo | null => {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: String(raw.id || ''),
    name: String(raw.name || ''),
    type: String(raw.type || ''),
    typeDisplay: typeof raw.typeDisplay === 'string' ? raw.typeDisplay : undefined,
  }
}

const toShippingAddress = (raw: any): ShippingAddress | null => {
  if (!raw || typeof raw !== 'object') return null
  return {
    firstName: typeof raw.firstName === 'string' ? raw.firstName : undefined,
    lastName: typeof raw.lastName === 'string' ? raw.lastName : undefined,
    phone: typeof raw.phone === 'string' ? raw.phone : undefined,
    countryCode: typeof raw.countryCode === 'string' ? raw.countryCode : undefined,
    countryName: typeof raw.countryName === 'string' ? raw.countryName : undefined,
    locationId: typeof raw.locationId === 'string' ? raw.locationId : undefined,
    locationHierarchy: Array.isArray(raw.locationHierarchy)
      ? raw.locationHierarchy.map(toLocationInfo).filter(Boolean) as LocationInfo[]
      : [],
    fields: raw.fields && typeof raw.fields === 'object' ? raw.fields : {},
  }
}

const toBatchItem = (raw: any): OrderBatchItem | null => {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: String(raw.id || ''),
    orderItemId: String(raw.orderItemId || ''),
    quantity: toNumber(raw.quantity),
  }
}

const toBatch = (raw: any): OrderBatch | null => {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: String(raw.id || ''),
    warehouseId: typeof raw.warehouseId === 'string' ? raw.warehouseId : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    shippingAddress: raw.shippingAddress && typeof raw.shippingAddress === 'object' ? raw.shippingAddress : undefined,
    items: Array.isArray(raw.items)
      ? raw.items.map(toBatchItem).filter(Boolean) as OrderBatchItem[]
      : [],
    createdAt: normalizeDate(raw.createdAt) || new Date().toISOString(),
  }
}

const toLineItem = (raw: ApiLike, currencyCode?: string): CustomerOrderLineItem | null => {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || raw.orderItemId || '').trim()
  if (!id) return null

  // Extract product info from nested structure
  const product = raw.product || {}
  const skuDetails = raw.skuDetails || {}
  const pricing = raw.pricing ? toItemPricing(raw.pricing) : undefined

  const productTitle = product.title || raw.productName || raw.productTitle
  const productSlug = product.slug || raw.productSlug
  const productShortDescription = product.shortDescription
  const skuTitle = skuDetails.title || raw.skuTitle
  const sku = skuDetails.sku || raw.sku
  const imageUrl = skuDetails.imageUrl || raw.imageUrl
  const options = skuDetails.options || raw.skuOptionsJson || raw.attributesJson || undefined
  const productId = product.id || raw.productId

  const name = String(productTitle || skuTitle || sku || raw.name || 'Item')
  const lineCurrency = typeof raw.currencyCode === 'string' ? raw.currencyCode : currencyCode

  return {
    id,
    name,
    productName: productTitle,
    productTitle,
    productSlug,
    productShortDescription,
    skuTitle,
    sku,
    productId,
    quantity: typeof raw.quantity === 'number' ? raw.quantity : toNumber(raw.quantity),
    price: pricing?.total ?? toNumber(raw.unitPrice ?? raw.total ?? raw.price),
    unitPrice: pricing?.unitPrice ?? toNumber(raw.unitPrice ?? raw.price),
    total: pricing?.total ?? toNumber(raw.total ?? raw.price),
    currencyCode: lineCurrency,
    imageUrl,
    options,
    pricing: pricing || undefined,
    batchId: typeof raw.batchId === 'string' ? raw.batchId : undefined,
  }
}

const toDetail = (raw: ApiLike): CustomerOrderDetail | null => {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id || raw.orderId || '').trim()
  const orderNumber = String(raw.orderNumber || raw.orderNo || id).trim()
  if (!id || !orderNumber) return null

  const currencyCode = typeof raw.currencyCode === 'string' ? raw.currencyCode : undefined
  const items = Array.isArray(raw.items)
    ? raw.items.map((item: any) => toLineItem(item, currencyCode)).filter(Boolean) as CustomerOrderLineItem[]
    : []

  const paymentSummary = raw.paymentSummary
    ? {
        status: raw.paymentSummary.status,
        capturedTotal: toNumber(raw.paymentSummary.capturedTotal),
        netPaidTotal: toNumber(raw.paymentSummary.netPaidTotal),
      }
    : undefined

  return {
    id,
    orderNumber,
    status: normalizeStatus(raw.status),
    date: normalizeDate(raw.placedAt || raw.createdAt || raw.updatedAt || new Date().toISOString()) || new Date().toISOString(),
    currencyCode,
    financialStatus: typeof raw.financialStatus === 'string' ? raw.financialStatus : undefined,
    fulfillmentStatus: typeof raw.fulfillmentStatus === 'string' ? raw.fulfillmentStatus : undefined,
    items,
    subtotal: toNumber(raw.itemsSubtotal ?? raw.subtotal),
    tax: toNumber(raw.taxTotal ?? raw.tax),
    shipping: toNumber(raw.shippingTotal ?? raw.shipping),
    discount: toNumber(raw.discountTotal ?? raw.discount),
    total: toNumber(raw.grandTotal ?? raw.total),
    shippingName: typeof raw.shippingName === 'string' ? raw.shippingName : undefined,
    shippingPhone: typeof raw.shippingPhone === 'string' ? raw.shippingPhone : undefined,
    shippingAddressSummary: typeof raw.shippingAddressSummary === 'string' ? raw.shippingAddressSummary : undefined,
    shippingAddress: raw.shippingAddress ? toShippingAddress(raw.shippingAddress) || undefined : undefined,
    batches: Array.isArray(raw.batches)
      ? raw.batches.map(toBatch).filter(Boolean) as OrderBatch[]
      : undefined,
    notesCustomer: typeof raw.notesCustomer === 'string' ? raw.notesCustomer : undefined,
    notesInternal: typeof raw.notesInternal === 'string' ? raw.notesInternal : undefined,
    paymentSummary,
  }
}

export function useCustomerOrders(options?: { token?: string | null; enabled?: boolean }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])
  const enabled = options?.enabled ?? true

  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setOrders([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get<any>(endpoints.customer.orders.list({ page: 1, limit: 50 }))
      setOrders(extractList(payload).map(toSummary).filter(Boolean) as CustomerOrderSummary[])
    } catch (e: any) {
      setOrders([])
      setError(e?.message || 'Failed to load orders')
    } finally {
      setIsLoading(false)
    }
  }, [api, enabled])

  const getOrderDetail = useCallback(
    async (orderId: string): Promise<CustomerOrderDetail> => {
      const payload = await api.get<any>(endpoints.customer.orders.byId(orderId))
      const raw = (payload as any)?.data ?? payload
      const detail = toDetail(raw)
      if (!detail) throw new Error('Order details not available')
      return detail
    },
    [api]
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return { orders, isLoading, error, refresh, getOrderDetail }
}
