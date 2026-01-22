import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, RefreshCcw, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/commerce/confirm-dialog'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { endpoints } from '@/lib/endpoints'

type ShippingProvider = {
  id: string
  code?: string
  name?: string
  isActive?: boolean
}

type ShippingMethod = {
  id: string
  code?: string
  displayName?: string
  provider?: string
  providerId?: string
  isActive?: boolean
}

type ShippingRate = {
  id: string
  name?: string
  isActive?: boolean
  priority?: number
  currency?: string
  calculationType?: string
  amount?: number
  formula?: string
  table?: { measure?: string; tiers?: Array<{ upto: string; price: string }> }
  metaJson?: Record<string, unknown>
}

type MethodDraft = {
  code: string
  displayName: string
  provider: string
  providerId: string
  isActive: boolean
}

const unwrap = (payload: any) => payload?.data ?? payload

const asArray = <T,>(payload: any): T[] => {
  const unwrapped = unwrap(payload)
  if (Array.isArray(unwrapped)) return unwrapped as T[]
  if (Array.isArray(unwrapped?.items)) return unwrapped.items as T[]
  return []
}

export function AdminShippingMethodsPage() {
  const { authorizedRequest } = useAdminAuth()

  const [providers, setProviders] = useState<ShippingProvider[]>([])
  const [methods, setMethods] = useState<ShippingMethod[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [draft, setDraft] = useState<MethodDraft>({ code: '', displayName: '', provider: '', providerId: '', isActive: true })
  const [isCreating, setIsCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<MethodDraft | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [expandedMethodId, setExpandedMethodId] = useState<string | null>(null)
  const [methodRates, setMethodRates] = useState<Record<string, ShippingRate[]>>({})
  const [loadingRatesFor, setLoadingRatesFor] = useState<string | null>(null)

  const loadProviders = useCallback(async () => {
    try {
      const payload = await authorizedRequest<any>(endpoints.shipping.providers, { method: 'GET' })
      const list = asArray<any>(payload).map((p) => ({
        id: String(p?.id ?? ''),
        code: p?.code ? String(p.code) : undefined,
        name: p?.name ? String(p.name) : undefined,
        isActive: typeof p?.isActive === 'boolean' ? p.isActive : undefined,
      }))
      setProviders(list.filter((p) => p.id))
    } catch {
      // non-blocking
    }
  }, [authorizedRequest])

  const loadMethods = useCallback(async () => {
    setIsLoading(true)
    try {
      const payload = await authorizedRequest<any>(endpoints.shipping.methods, { method: 'GET' })
      const list = asArray<any>(payload).map((m) => ({
        id: String(m?.id ?? ''),
        code: m?.code ? String(m.code) : undefined,
        displayName: m?.displayName ? String(m.displayName) : undefined,
        provider: m?.provider ? String(m.provider) : (m?.providerEntity?.name ? String(m.providerEntity.name) : undefined),
        providerId: m?.providerId ? String(m.providerId) : undefined,
        isActive: typeof m?.isActive === 'boolean' ? m.isActive : undefined,
      }))
      setMethods(list.filter((m) => m.id))
    } catch (e: any) {
      toast.error('Failed to load methods', { description: e?.message || 'Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }, [authorizedRequest])

  useEffect(() => {
    loadProviders()
    loadMethods()
  }, [loadMethods, loadProviders])

  const providerOptions = useMemo(() => {
    return providers.map((p) => ({ id: p.id, label: p.name || p.code || p.id }))
  }, [providers])

  const providerLabelById = useMemo(() => {
    return new Map(providers.map((p) => [p.id, p.name || p.code || 'Provider']))
  }, [providers])

  const formatRateSummary = useCallback((r: ShippingRate) => {
    if (r.calculationType === 'per_weight') return `${r.currency || 'KES'} ${r.amount ?? 0} per kg`
    if (r.calculationType === 'per_item') return `${r.currency || 'KES'} ${r.amount ?? 0} per item`
    if (r.calculationType === 'flat') return `${r.currency || 'KES'} ${r.amount ?? 0} flat`
    if (r.calculationType === 'formula') return r.formula ? `Formula: ${r.formula}` : 'Formula rate'
    if (r.calculationType === 'table_rate') {
      const tiers = Array.isArray(r.table?.tiers) ? r.table?.tiers : []
      const measure = r.table?.measure ? String(r.table.measure) : 'subtotal'
      if (!tiers.length) return `Table rate (${measure})`
      const preview = tiers
        .slice(0, 2)
        .map((t) => `≤ ${t?.upto ?? '?'}: ${r.currency || 'KES'} ${t?.price ?? 0}`)
        .join(' · ')
      return `Table rate (${measure}) • ${preview}${tiers.length > 2 ? '…' : ''}`
    }
    return ''
  }, [])

  const loadMethodRates = useCallback(
    async (methodId: string) => {
      if (!methodId) return
      setLoadingRatesFor(methodId)
      try {
        const payload = await authorizedRequest<any>(endpoints.shipping.ratesByMethod(methodId), { method: 'GET' })
        const list = asArray<any>(payload).map((r) => ({
          id: String(r?.id ?? ''),
          name: r?.metaJson?.label
            ? String(r.metaJson.label)
            : r?.meta_json?.label
              ? String(r.meta_json.label)
              : r?.name
                ? String(r.name)
                : undefined,
          isActive: typeof r?.isActive === 'boolean' ? r.isActive : undefined,
          priority: typeof r?.priority === 'number' ? r.priority : undefined,
          currency: r?.currencyCode ? String(r.currencyCode) : r?.currency ? String(r.currency) : r?.currency?.code ? String(r.currency.code) : undefined,
          calculationType: r?.calculationType ? String(r.calculationType) : undefined,
          amount:
            typeof r?.calculationType === 'string' && (r.calculationType === 'per_weight' || r.calculationType === 'per_item')
              ? Number(r?.pricePerUnit ?? r?.price_per_unit ?? 0)
              : Number(r?.price ?? r?.amount ?? 0),
          formula: r?.metaJson?.formula
            ? String(r.metaJson.formula)
            : r?.meta_json?.formula
              ? String(r.meta_json.formula)
              : r?.calculationType === 'formula' && r?.price
                ? String(r.price)
                : undefined,
          table: r?.metaJson?.tiers
            ? { measure: r.metaJson.measure || 'subtotal', tiers: r.metaJson.tiers }
            : r?.meta_json?.tiers
              ? { measure: r.meta_json.measure || 'subtotal', tiers: r.meta_json.tiers }
              : undefined,
          metaJson: (r?.metaJson || r?.meta_json || undefined) as Record<string, unknown> | undefined,
        }))
        setMethodRates((prev) => ({ ...prev, [methodId]: list.filter((r) => r.id) }))
      } catch (e: any) {
        toast.error('Failed to load rates', { description: e?.message || 'Please try again.' })
      } finally {
        setLoadingRatesFor((current) => (current === methodId ? null : current))
      }
    },
    [authorizedRequest]
  )

  const canCreate = draft.code.trim().length > 0 && draft.displayName.trim().length > 0

  const handleCreate = useCallback(async () => {
    if (!canCreate) return
    setIsCreating(true)
    try {
      await authorizedRequest(endpoints.shipping.methods, {
        method: 'POST',
        body: {
          code: draft.code.trim(),
          displayName: draft.displayName.trim(),
          ...(draft.providerId.trim() ? { providerId: draft.providerId.trim() } : {}),
          ...(draft.provider.trim() ? { provider: draft.provider.trim() } : {}),
          isActive: draft.isActive,
        },
      })
      toast.success('Method created')
      setDraft({ code: '', displayName: '', provider: '', providerId: '', isActive: true })
      await loadMethods()
    } catch (e: any) {
      toast.error('Failed to create method', { description: e?.message || 'Please try again.' })
    } finally {
      setIsCreating(false)
    }
  }, [authorizedRequest, canCreate, draft, loadMethods])

  const beginEdit = useCallback((method: ShippingMethod) => {
    setEditingId(method.id)
    setEditDraft({
      code: method.code || '',
      displayName: method.displayName || '',
      provider: method.provider || '',
      providerId: method.providerId || '',
      isActive: method.isActive !== false,
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditDraft(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!editingId || !editDraft) return
    if (!editDraft.code.trim() || !editDraft.displayName.trim()) {
      toast.error('Code and display name are required')
      return
    }

    setIsSaving(true)
    try {
      await authorizedRequest(endpoints.shipping.methodById(editingId), {
        method: 'PATCH',
        body: {
          code: editDraft.code.trim(),
          displayName: editDraft.displayName.trim(),
          ...(editDraft.providerId.trim() ? { providerId: editDraft.providerId.trim() } : {}),
          ...(editDraft.provider.trim() ? { provider: editDraft.provider.trim() } : {}),
          isActive: editDraft.isActive,
        },
      })
      toast.success('Method updated')
      cancelEdit()
      await loadMethods()
    } catch (e: any) {
      toast.error('Failed to update method', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }, [authorizedRequest, cancelEdit, editDraft, editingId, loadMethods])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      await authorizedRequest(endpoints.shipping.methodById(deleteId), { method: 'DELETE' })
      toast.success('Method deleted')
      setDeleteId(null)
      if (editingId === deleteId) cancelEdit()
      await loadMethods()
    } catch (e: any) {
      toast.error('Failed to delete method', { description: e?.message || 'Please try again.' })
    } finally {
      setIsDeleting(false)
    }
  }, [authorizedRequest, cancelEdit, deleteId, editingId, loadMethods])

  const sorted = useMemo(() => {
    return [...methods].sort((a, b) => String(a.displayName || a.code || a.id).localeCompare(String(b.displayName || b.code || b.id)))
  }, [methods])

  return (
    <AdminLayout title="Shipping methods" description="Configure shipping methods used by zones and rates.">
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Methods</CardTitle>
              <CardDescription>Reusable methods such as Standard or Express.</CardDescription>
            </div>
            <Button variant="outline" onClick={loadMethods} disabled={isLoading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border bg-card p-3">
                <div className="text-xs text-muted-foreground">Total methods</div>
                <div className="text-lg font-semibold">{methods.length}</div>
              </div>
              <div className="rounded-md border bg-card p-3">
                <div className="text-xs text-muted-foreground">Active methods</div>
                <div className="text-lg font-semibold">{methods.filter((m) => m.isActive !== false).length}</div>
              </div>
              <div className="rounded-md border bg-card p-3">
                <div className="text-xs text-muted-foreground">Rate management</div>
                <div className="text-sm">View rates per method below.</div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="methodCode">Code</Label>
                <Input id="methodCode" value={draft.code} onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value }))} placeholder="standard" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="methodName">Display name</Label>
                <Input id="methodName" value={draft.displayName} onChange={(e) => setDraft((p) => ({ ...p, displayName: e.target.value }))} placeholder="Standard" />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={draft.providerId || '__none'}
                  onValueChange={(v) => setDraft((p) => ({ ...p, providerId: v === '__none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No provider</SelectItem>
                    {providerOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreate} disabled={!canCreate || isCreating} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add method
                </Button>
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
              Tip: methods are reusable and can be attached to multiple zones. Use providers to group integrations.
            </div>

            {sorted.length === 0 ? (
              <div className="text-sm text-muted-foreground">No methods yet.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {sorted.map((method) => (
                  <Card key={method.id} className="shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{method.displayName || method.code || 'Method'}</CardTitle>
                          <CardDescription className="truncate">{method.code || method.id}</CardDescription>
                        </div>
                        <Badge variant={method.isActive === false ? 'secondary' : 'default'}>
                          {method.isActive === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </div>
                      {method.providerId || method.provider ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {method.providerId ? providerLabelById.get(method.providerId) || 'Provider' : method.provider}
                          </Badge>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No provider linked</div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">
                          {methodRates[method.id]?.length ?? 0} rates
                        </Badge>
                        <Badge variant="outline">
                          {(methodRates[method.id] || []).filter((r) => r.isActive !== false).length} active
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {editingId === method.id && editDraft ? (
                        <div className="space-y-4 rounded-md border bg-muted/20 p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Code</Label>
                              <Input value={editDraft.code} onChange={(e) => setEditDraft((d) => (d ? { ...d, code: e.target.value } : d))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Display name</Label>
                              <Input value={editDraft.displayName} onChange={(e) => setEditDraft((d) => (d ? { ...d, displayName: e.target.value } : d))} />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Provider</Label>
                              <Select
                                value={editDraft.providerId || '__none'}
                                onValueChange={(v) => setEditDraft((d) => (d ? { ...d, providerId: v === '__none' ? '' : v } : d))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">No provider</SelectItem>
                                  {providerOptions.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="methodProviderText">Provider label</Label>
                              <Input
                                id="methodProviderText"
                                value={editDraft.provider}
                                onChange={(e) => setEditDraft((d) => (d ? { ...d, provider: e.target.value } : d))}
                                placeholder="Optional fallback label"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-md border px-3 py-2">
                            <span className="text-sm text-muted-foreground">Active</span>
                            <Switch checked={editDraft.isActive} onCheckedChange={(v) => setEditDraft((d) => (d ? { ...d, isActive: v } : d))} />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={cancelEdit} disabled={isSaving}>
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isSaving}>
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">Method configuration</div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => beginEdit(method)}>
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setDeleteId(method.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const next = expandedMethodId === method.id ? null : method.id
                              setExpandedMethodId(next)
                              if (next && !methodRates[method.id]) {
                                await loadMethodRates(method.id)
                              }
                            }}
                          >
                            {expandedMethodId === method.id ? (
                              <ChevronUp className="h-4 w-4 mr-2" />
                            ) : (
                              <ChevronDown className="h-4 w-4 mr-2" />
                            )}
                            {expandedMethodId === method.id ? 'Hide rates' : 'View rates'}
                          </Button>

                          {expandedMethodId === method.id ? (
                            <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                              {loadingRatesFor === method.id ? (
                                <div className="text-xs text-muted-foreground">Loading rates…</div>
                              ) : (methodRates[method.id] || []).length === 0 ? (
                                <div className="text-xs text-muted-foreground">No rates configured for this method yet.</div>
                              ) : (
                                <div className="space-y-2">
                                  {(methodRates[method.id] || [])
                                    .slice()
                                    .sort((a, b) => {
                                      const ap = typeof a.priority === 'number' ? a.priority : Number.POSITIVE_INFINITY
                                      const bp = typeof b.priority === 'number' ? b.priority : Number.POSITIVE_INFINITY
                                      if (ap !== bp) return ap - bp
                                      return String(a.name || a.id).localeCompare(String(b.name || b.id))
                                    })
                                    .map((rate) => (
                                      <div key={rate.id} className="flex items-start justify-between gap-3 rounded-md border bg-background p-3">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-sm font-medium truncate">
                                              {rate.name || rate.calculationType?.replace('_', ' ') || 'Rate'}
                                            </div>
                                            <Badge variant={rate.isActive === false ? 'secondary' : 'default'}>
                                              {rate.isActive === false ? 'Inactive' : 'Active'}
                                            </Badge>
                                            {typeof rate.priority === 'number' ? <Badge variant="secondary">P{rate.priority}</Badge> : null}
                                          </div>
                                          <div className="text-xs text-muted-foreground">{formatRateSummary(rate) || 'No summary yet.'}</div>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <ConfirmDialog
          open={Boolean(deleteId)}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setDeleteId(null)
          }}
          title="Delete shipping method?"
          description="This will remove the method and may impact attached zones and rates."
          confirmText={isDeleting ? 'Deleting…' : 'Delete'}
          cancelText="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      </div>
    </AdminLayout>
  )
}
