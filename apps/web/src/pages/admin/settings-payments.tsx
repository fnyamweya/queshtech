import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { CornerDownRight, CreditCard } from 'lucide-react'

type PaymentMethodStatus = 'active' | 'inactive' | 'deprecated'

type PaymentProvider = {
  id: string
  code: string
  name: string
  isActive?: boolean
}

type PaymentMethod = {
  id: string
  code: string
  name: string
  description?: string
  status?: PaymentMethodStatus
  isActive?: boolean
  providerId: string
  provider?: PaymentProvider
  configJson?: Record<string, unknown>
  metadata?: Record<string, unknown>
  channelLinks?: Array<{ channel?: { code?: string } }>
  countryLinks?: Array<{ countryConfig?: { countryCode?: string } }>
  currencyLinks?: Array<{ currency?: { code?: string } }>
}

const safeJson = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return '{}' 
  }
}

const parseJson = (value: string) => {
  try {
    return { ok: true as const, data: JSON.parse(value || '{}') }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Invalid JSON' }
  }
}

export function AdminSettingsPaymentsPage() {
  const { accessToken } = useAdminAuth()
  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])

  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [providers, setProviders] = useState<PaymentProvider[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [query, setQuery] = useState('')

  const [draftStatus, setDraftStatus] = useState<PaymentMethodStatus>('active')
  const [draftConfig, setDraftConfig] = useState('')
  const [draftMetadata, setDraftMetadata] = useState('')

  const selected = methods.find((m) => m.id === selectedId) || null

  useEffect(() => {
    if (!accessToken) return
    setIsLoading(true)
    Promise.all([
      api.get(endpoints.paymentMethods.base),
      api.get(endpoints.paymentProviders.base),
    ])
      .then(([methodsResp, providersResp]) => {
        const methodsData = (methodsResp as any)?.data ?? methodsResp
        const providersData = (providersResp as any)?.data ?? providersResp
        setMethods(Array.isArray(methodsData) ? methodsData : [])
        setProviders(Array.isArray(providersData) ? providersData : [])
        if (!selectedId && Array.isArray(methodsData) && methodsData.length) {
          setSelectedId(methodsData[0].id)
        }
      })
      .catch((e: any) => {
        toast.error('Failed to load payment methods', { description: e?.message || 'Please try again.' })
      })
      .finally(() => setIsLoading(false))
  }, [accessToken, api, selectedId])

  useEffect(() => {
    if (!selected) return
    setDraftStatus((selected.status as PaymentMethodStatus) || (selected.isActive ? 'active' : 'inactive'))
    setDraftConfig(safeJson(selected.configJson))
    setDraftMetadata(safeJson(selected.metadata))
  }, [selected])

  const filtered = methods.filter((m) => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return `${m.code} ${m.name}`.toLowerCase().includes(term)
  })

  const providerName = (providerId?: string) => {
    const p = providers.find((pr) => pr.id === providerId)
    return p?.name || p?.code || '—'
  }

  const save = async () => {
    if (!selected) return
    const config = parseJson(draftConfig)
    if (!config.ok) {
      toast.error('Invalid config JSON', { description: config.error })
      return
    }
    const metadata = parseJson(draftMetadata)
    if (!metadata.ok) {
      toast.error('Invalid metadata JSON', { description: metadata.error })
      return
    }

    setIsSaving(true)
    try {
      const payload = await api.patch(endpoints.paymentMethods.byId(selected.id), {
        status: draftStatus,
        isActive: draftStatus === 'active',
        configJson: config.data,
        metadata: metadata.data,
      })
      const updated = (payload as any)?.data ?? payload
      setMethods((prev) => prev.map((m) => (m.id === selected.id ? updated : m)))
      toast.success('Payment method updated')
    } catch (e: any) {
      toast.error('Failed to update payment method', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminLayout
      title="Settings · Payment Methods"
      description="Configure payment methods, statuses, and integration settings."
      actions={
        <Link href="/axis/settings">
          <Button variant="outline" size="sm">
            <CornerDownRight className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment methods
            </CardTitle>
            <CardDescription>Search and select a method to edit its configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Search by name or code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div className="space-y-3">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading payment methods…</div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">No payment methods found.</div>
              ) : (
                filtered.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedId(method.id)}
                    className={
                      'w-full text-left rounded-lg border px-4 py-3 transition-colors ' +
                      (selectedId === method.id ? 'border-primary bg-primary/5' : 'hover:border-primary/40')
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{method.name}</div>
                        <div className="text-xs text-muted-foreground">{method.code} • {providerName(method.providerId)}</div>
                      </div>
                      <Badge variant={method.status === 'active' ? 'success' : method.status === 'deprecated' ? 'secondary' : 'outline'}>
                        {method.status || (method.isActive ? 'active' : 'inactive')}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Method configuration</CardTitle>
            <CardDescription>Update status and integration JSON.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <div className="text-sm text-muted-foreground">Select a payment method to edit.</div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Input value={`${selected.name} (${selected.code})`} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Input value={providerName(selected.providerId)} readOnly />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={draftStatus} onValueChange={(v) => setDraftStatus(v as PaymentMethodStatus)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Config JSON</Label>
                  <Textarea rows={8} value={draftConfig} onChange={(e) => setDraftConfig(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Metadata JSON</Label>
                  <Textarea rows={6} value={draftMetadata} onChange={(e) => setDraftMetadata(e.target.value)} />
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <div>Channels: {(selected.channelLinks || []).map((c) => c.channel?.code).filter(Boolean).join(', ') || 'All'}</div>
                  <div>Countries: {(selected.countryLinks || []).map((c) => c.countryConfig?.countryCode).filter(Boolean).join(', ') || 'All'}</div>
                  <div>Currencies: {(selected.currencyLinks || []).map((c) => c.currency?.code).filter(Boolean).join(', ') || 'All'}</div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button onClick={save} disabled={isSaving}>
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
