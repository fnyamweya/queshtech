import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'

type ApiLike = any

export type Customer = {
  id: string
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
  isActive?: boolean
  isBanned?: boolean
  status?: string
  createdAt?: string
  updatedAt?: string
  raw?: any
}

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

function toCustomer(raw: ApiLike): Customer | null {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.id || raw._id || raw.customerId || '').trim()
  if (!id) return null

  const email = typeof raw.email === 'string' ? raw.email.trim() : undefined
  const firstName = typeof raw.firstName === 'string' ? raw.firstName.trim() : undefined
  const lastName = typeof raw.lastName === 'string' ? raw.lastName.trim() : undefined
  const phone = typeof raw.phone === 'string' ? raw.phone.trim() : typeof raw.phoneNumber === 'string' ? raw.phoneNumber.trim() : undefined

  const isActive =
    typeof raw.isActive === 'boolean'
      ? raw.isActive
      : typeof raw.active === 'boolean'
        ? raw.active
        : undefined

  const isBanned = typeof raw.isBanned === 'boolean' ? raw.isBanned : typeof raw.banned === 'boolean' ? raw.banned : undefined
  const status = typeof raw.status === 'string' ? raw.status : undefined

  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : raw.createdAt ? String(raw.createdAt) : undefined
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : raw.updatedAt ? String(raw.updatedAt) : undefined

  return { id, email, firstName, lastName, phone, isActive, isBanned, status, createdAt, updatedAt, raw }
}

export function getCustomerDisplayName(c: Pick<Customer, 'firstName' | 'lastName' | 'email'>) {
  const name = `${c.firstName || ''} ${c.lastName || ''}`.trim()
  return name || c.email || '—'
}

export function useCustomers(options?: { token?: string | null; query?: string }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])

  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const q = (options?.query || '').trim()
      const payload = await api.get<any>(endpoints.customers.list(q ? { q } : { getAll: true }))
      setCustomers(extractList(payload).map(toCustomer).filter(Boolean) as Customer[])
    } catch (e: any) {
      setCustomers([])
      setError(e?.message || 'Failed to load customers')
    } finally {
      setIsLoading(false)
    }
  }, [api, options?.query])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createCustomer = useCallback(
    async (input: { email?: string; firstName?: string; lastName?: string; phone?: string; password?: string; isActive?: boolean }) => {
      const payload = await api.post<any>(endpoints.customers.base, input)
      const created = toCustomer((payload as any)?.data ?? payload)
      if (created) {
        setCustomers((prev) => {
          const without = prev.filter((c) => c.id !== created.id)
          return [created, ...without]
        })
      }
      return created
    },
    [api]
  )

  const inviteCustomer = useCallback(
    async (input: { email: string; phone?: string; firstName?: string; lastName?: string }) => {
      const payload = await api.post<any>(endpoints.customers.invite, {
        email: input.email,
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
      })
      const maybeCustomer = toCustomer((payload as any)?.data ?? payload)
      if (maybeCustomer) {
        setCustomers((prev) => {
          const without = prev.filter((c) => c.id !== maybeCustomer.id)
          return [maybeCustomer, ...without]
        })
      }
      return payload
    },
    [api]
  )

  const updateCustomer = useCallback(
    async (id: string, patch: Partial<Customer> & { password?: string }) => {
      const payload = await api.patch<any>(endpoints.customers.byId(id), patch)
      const updated = toCustomer((payload as any)?.data ?? payload)
      if (updated) setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)))
      return updated
    },
    [api]
  )

  const deleteCustomer = useCallback(
    async (id: string) => {
      await api.delete(endpoints.customers.byId(id))
      setCustomers((prev) => prev.filter((c) => c.id !== id))
    },
    [api]
  )

  return { customers, isLoading, error, refresh, createCustomer, inviteCustomer, updateCustomer, deleteCustomer }
}
