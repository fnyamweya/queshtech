import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'

export type OrderPaymentSummary = {
  capturedTotal?: string
  adjustedTotal?: string
  reversedTotal?: string
  refundedTotal?: string
  netPaidTotal?: string
  status?: string
}

export type OrderListItem = {
  id: string
  orderNumber?: string
  customerName?: string
  customerEmail?: string
  shippingName?: string
  shippingPhone?: string
  shippingAddressSummary?: string
  currencyCode?: string
  grandTotal?: string
  status?: string
  financialStatus?: string
  fulfillmentStatus?: string
  itemCount?: number
  placedAt?: string
  createdAt?: string
  updatedAt?: string
  paymentSummary?: OrderPaymentSummary
  raw?: any
}

export type OrdersPagination = {
  total: number
  page: number
  limit: number
  totalPages: number
}

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

function buildShippingSummary(raw: ApiLike): {
  shippingName?: string
  shippingPhone?: string
  shippingAddressSummary?: string
} {
  const shippingName =
    typeof raw?.shippingName === 'string'
      ? raw.shippingName
      : typeof raw?.shippingAddress?.name === 'string'
        ? raw.shippingAddress.name
        : undefined

  const shippingPhone =
    typeof raw?.shippingPhone === 'string'
      ? raw.shippingPhone
      : typeof raw?.shippingAddress?.phone === 'string'
        ? raw.shippingAddress.phone
        : undefined

  const shippingAddressSummary =
    typeof raw?.shippingAddressSummary === 'string'
      ? raw.shippingAddressSummary
      : typeof raw?.shippingAddress?.address1 === 'string'
        ? [
            raw.shippingAddress.address1,
            raw.shippingAddress.city,
            raw.shippingAddress.state,
            raw.shippingAddress.postalCode,
            raw.shippingAddress.country,
          ]
            .filter((part: any) => typeof part === 'string' && part.trim())
            .join(', ')
        : undefined

  return { shippingName, shippingPhone, shippingAddressSummary }
}

function toOrder(raw: ApiLike): OrderListItem | null {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id || raw.orderId || raw._id || '').trim()
  if (!id) return null

  const orderNumber = typeof raw.orderNumber === 'string' ? raw.orderNumber : undefined
  const customerName = typeof raw.customerName === 'string' ? raw.customerName : undefined
  const customerEmail =
    typeof raw.customerEmail === 'string'
      ? raw.customerEmail
      : typeof raw.email === 'string'
        ? raw.email
        : undefined

  const currencyCode = typeof raw.currencyCode === 'string' ? raw.currencyCode : undefined
  const grandTotal =
    typeof raw.grandTotal === 'string'
      ? raw.grandTotal
      : typeof raw.total === 'string'
        ? raw.total
        : raw.grandTotal !== undefined
          ? String(raw.grandTotal)
          : undefined

  const status = typeof raw.status === 'string' ? raw.status : undefined
  const financialStatus = typeof raw.financialStatus === 'string' ? raw.financialStatus : undefined
  const fulfillmentStatus = typeof raw.fulfillmentStatus === 'string' ? raw.fulfillmentStatus : undefined
  const itemCount = typeof raw.itemCount === 'number' ? raw.itemCount : Array.isArray(raw.items) ? raw.items.length : undefined

  const placedAt = typeof raw.placedAt === 'string' ? raw.placedAt : raw.placedAt ? String(raw.placedAt) : undefined
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : raw.createdAt ? String(raw.createdAt) : undefined
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : raw.updatedAt ? String(raw.updatedAt) : undefined

  const paymentSummary = typeof raw.paymentSummary === 'object' && raw.paymentSummary
    ? {
        capturedTotal: raw.paymentSummary.capturedTotal,
        adjustedTotal: raw.paymentSummary.adjustedTotal,
        reversedTotal: raw.paymentSummary.reversedTotal,
        refundedTotal: raw.paymentSummary.refundedTotal,
        netPaidTotal: raw.paymentSummary.netPaidTotal,
        status: raw.paymentSummary.status,
      }
    : undefined

  const shipping = buildShippingSummary(raw)

  return {
    id,
    orderNumber,
    customerName,
    customerEmail,
    currencyCode,
    grandTotal,
    status,
    financialStatus,
    fulfillmentStatus,
    itemCount,
    placedAt,
    createdAt,
    updatedAt,
    paymentSummary,
    ...shipping,
    raw,
  }
}

export function useOrders(options?: { token?: string | null; page?: number; limit?: number; enabled?: boolean }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])
  const page = options?.page ?? 1
  const limit = options?.limit ?? 25
  const enabled = options?.enabled ?? true

  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [pagination, setPagination] = useState<OrdersPagination>({ total: 0, page: 1, limit: 25, totalPages: 1 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setOrders([])
      setPagination({ total: 0, page: 1, limit, totalPages: 1 })
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get<any>(endpoints.orders.list({ page, limit }))
      const rawList = extractList(payload)
      setOrders(rawList.map(toOrder).filter(Boolean) as OrderListItem[])

      // Extract pagination metadata from API response
      const paginationData = payload?.pagination ?? payload?.meta
      if (paginationData) {
        setPagination({
          total: Number(paginationData.total) || rawList.length,
          page: Number(paginationData.page) || page,
          limit: Number(paginationData.limit) || limit,
          totalPages: Number(paginationData.totalPages) || 1,
        })
      } else {
        setPagination({ total: rawList.length, page, limit, totalPages: 1 })
      }
    } catch (e: any) {
      setOrders([])
      setPagination({ total: 0, page: 1, limit, totalPages: 1 })
      setError(e?.message || 'Failed to load orders')
    } finally {
      setIsLoading(false)
    }
  }, [api, enabled, limit, page])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { orders, pagination, isLoading, error, refresh }
}
