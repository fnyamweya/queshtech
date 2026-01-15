import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'

type ApiLike = any

export type Currency = {
  code: string
  name?: string
  symbol?: string
  decimals?: number
  isActive?: boolean
}

function extractList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload
  const p: any = payload as any
  if (Array.isArray(p?.data)) return p.data
  if (Array.isArray(p?.items)) return p.items
  if (Array.isArray(p?.results)) return p.results
  if (Array.isArray(p?.data?.items)) return p.data.items
  return []
}

function toCurrency(raw: ApiLike): Currency | null {
  if (!raw || typeof raw !== 'object') return null

  const code = String(raw.code || raw.currencyCode || raw.isoCode || raw.id || raw._id || '').trim().toUpperCase()
  if (!code) return null

  const nameRaw = raw.name ?? raw.title ?? raw.displayName
  const symbolRaw = raw.symbol ?? raw.sign
  const decimalsRaw = raw.decimals ?? raw.minorUnit ?? raw.minorUnits

  const decimals =
    typeof decimalsRaw === 'number'
      ? decimalsRaw
      : typeof decimalsRaw === 'string'
        ? Number(decimalsRaw)
        : undefined

  return {
    code,
    name: typeof nameRaw === 'string' ? nameRaw.trim() : undefined,
    symbol: typeof symbolRaw === 'string' ? symbolRaw.trim() : undefined,
    decimals: Number.isFinite(decimals as number) ? (decimals as number) : undefined,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : typeof raw.active === 'boolean' ? raw.active : undefined,
  }
}

export function useCurrencies(options?: { token?: string | null }) {
  const api = useMemo(() => createApiClient({ token: options?.token || null }), [options?.token])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await api.get<any>(endpoints.currencies.base)
      setCurrencies(extractList(payload).map(toCurrency).filter(Boolean) as Currency[])
    } catch (e: any) {
      setCurrencies([])
      setError(e?.message || 'Failed to load currencies')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createCurrency = useCallback(
    async (input: Partial<Currency> & { code: string }) => {
      const payload = await api.post<any>(endpoints.currencies.base, {
        ...input,
        code: input.code.trim().toUpperCase(),
      })
      const created = toCurrency(payload)
      if (created) {
        setCurrencies((prev) => {
          const without = prev.filter((c) => c.code !== created.code)
          return [created, ...without].sort((a, b) => a.code.localeCompare(b.code))
        })
      }
      return created
    },
    [api]
  )

  const updateCurrency = useCallback(
    async (code: string, patch: Partial<Currency>) => {
      const normalized = code.trim().toUpperCase()
      const payload = await api.patch<any>(endpoints.currencies.byCode(normalized), patch)
      const updated = toCurrency(payload)
      if (updated) {
        setCurrencies((prev) => prev.map((c) => (c.code === normalized ? updated : c)).sort((a, b) => a.code.localeCompare(b.code)))
      }
      return updated
    },
    [api]
  )

  const deleteCurrency = useCallback(
    async (code: string) => {
      const normalized = code.trim().toUpperCase()
      await api.delete(endpoints.currencies.byCode(normalized))
      setCurrencies((prev) => prev.filter((c) => c.code !== normalized))
    },
    [api]
  )

  return { currencies, isLoading, error, refresh, createCurrency, updateCurrency, deleteCurrency }
}
