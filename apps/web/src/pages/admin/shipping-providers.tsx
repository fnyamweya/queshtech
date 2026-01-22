import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCcw, Save, Trash2, X } from 'lucide-react'
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
  metaJson?: Record<string, unknown>
}

type ProviderDraft = {
  code: string
  name: string
  isActive: boolean
  apiBaseUrl: string
  apiKey: string
  accountId: string
  webhookUrl: string
  mode: string
}

type MethodDraft = {
  code: string
  displayName: string
}

const unwrap = (payload: any) => payload?.data ?? payload

const asArray = <T,>(payload: any): T[] => {
  const unwrapped = unwrap(payload)
  if (Array.isArray(unwrapped)) return unwrapped as T[]
  if (Array.isArray(unwrapped?.items)) return unwrapped.items as T[]
  return []
}

export function AdminShippingProvidersPage() {
  const { authorizedRequest } = useAdminAuth()

  const [providers, setProviders] = useState<ShippingProvider[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [draft, setDraft] = useState<ProviderDraft>({
    code: '',
    name: '',
    isActive: true,
    apiBaseUrl: '',
    apiKey: '',
    accountId: '',
    webhookUrl: '',
    mode: 'sandbox',
  })
  const [isCreating, setIsCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<ProviderDraft | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [methods, setMethods] = useState<Array<{ id: string; providerId?: string; code?: string; displayName?: string }>>([])
  const [methodDrafts, setMethodDrafts] = useState<Record<string, MethodDraft>>({})
  const [isCreatingMethodFor, setIsCreatingMethodFor] = useState<string | null>(null)

  const loadProviders = useCallback(async () => {
    setIsLoading(true)
    try {
      const payload = await authorizedRequest<any>(endpoints.shipping.providers, { method: 'GET' })
      const list = asArray<any>(payload).map((p) => ({
        id: String(p?.id ?? ''),
        code: p?.code ? String(p.code) : undefined,
        name: p?.name ? String(p.name) : undefined,
        isActive: typeof p?.isActive === 'boolean' ? p.isActive : undefined,
        metaJson: (p?.metaJson || p?.meta_json || undefined) as Record<string, unknown> | undefined,
      }))
      setProviders(list.filter((p) => p.id))
    } catch (e: any) {
      toast.error('Failed to load providers', { description: e?.message || 'Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }, [authorizedRequest])

  const loadMethods = useCallback(async () => {
    try {
      const payload = await authorizedRequest<any>(endpoints.shipping.methods, { method: 'GET' })
      const list = asArray<any>(payload).map((m) => ({
        id: String(m?.id ?? ''),
        providerId: m?.providerId ? String(m.providerId) : undefined,
        code: m?.code ? String(m.code) : undefined,
        displayName: m?.displayName ? String(m.displayName) : undefined,
      }))
      setMethods(list.filter((m) => m.id))
    } catch {
      // ignore
    }
  }, [authorizedRequest])

  useEffect(() => {
    loadProviders()
    loadMethods()
  }, [loadMethods, loadProviders])

  const canCreate = draft.code.trim().length > 0 && draft.name.trim().length > 0

  const buildMetaJson = (input: ProviderDraft) => {
    const meta: Record<string, unknown> = { configVersion: '1', mode: input.mode || 'sandbox' }
    if (input.apiBaseUrl.trim()) meta.apiBaseUrl = input.apiBaseUrl.trim()
    if (input.apiKey.trim()) meta.apiKey = input.apiKey.trim()
    if (input.accountId.trim()) meta.accountId = input.accountId.trim()
    if (input.webhookUrl.trim()) meta.webhookUrl = input.webhookUrl.trim()
    return meta
  }

  const handleCreate = useCallback(async () => {
    if (!canCreate) return
    setIsCreating(true)
    try {
      await authorizedRequest(endpoints.shipping.providers, {
        method: 'POST',
        body: {
          code: draft.code.trim(),
          name: draft.name.trim(),
          isActive: draft.isActive,
          metaJson: buildMetaJson(draft),
        },
      })
      toast.success('Provider created')
      setDraft({
        code: '',
        name: '',
        isActive: true,
        apiBaseUrl: '',
        apiKey: '',
        accountId: '',
        webhookUrl: '',
        mode: 'sandbox',
      })
      await loadProviders()
    } catch (e: any) {
      toast.error('Failed to create provider', { description: e?.message || 'Please try again.' })
    } finally {
      setIsCreating(false)
    }
  }, [authorizedRequest, canCreate, draft, loadProviders])

  const beginEdit = useCallback((provider: ShippingProvider) => {
    const meta = (provider.metaJson || {}) as Record<string, any>
    setEditingId(provider.id)
    setEditDraft({
      code: provider.code || '',
      name: provider.name || '',
      isActive: provider.isActive !== false,
      apiBaseUrl: meta.apiBaseUrl ? String(meta.apiBaseUrl) : '',
      apiKey: meta.apiKey ? String(meta.apiKey) : '',
      accountId: meta.accountId ? String(meta.accountId) : '',
      webhookUrl: meta.webhookUrl ? String(meta.webhookUrl) : '',
      mode: meta.mode ? String(meta.mode) : 'sandbox',
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditDraft(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!editingId || !editDraft) return
    if (!editDraft.code.trim() || !editDraft.name.trim()) {
      toast.error('Code and name are required')
      return
    }

    setIsSaving(true)
    try {
      await authorizedRequest(endpoints.shipping.providerById(editingId), {
        method: 'PATCH',
        body: {
          code: editDraft.code.trim(),
          name: editDraft.name.trim(),
          isActive: editDraft.isActive,
          metaJson: buildMetaJson(editDraft),
        },
      })
      toast.success('Provider updated')
      cancelEdit()
      await loadProviders()
    } catch (e: any) {
      toast.error('Failed to update provider', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }, [authorizedRequest, cancelEdit, editDraft, editingId, loadProviders])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      await authorizedRequest(endpoints.shipping.providerById(deleteId), { method: 'DELETE' })
      toast.success('Provider deleted')
      setDeleteId(null)
      if (editingId === deleteId) cancelEdit()
      await loadProviders()
    } catch (e: any) {
      toast.error('Failed to delete provider', { description: e?.message || 'Please try again.' })
    } finally {
      setIsDeleting(false)
    }
  }, [authorizedRequest, cancelEdit, deleteId, editingId, loadProviders])

  const createMethodForProvider = useCallback(
    async (providerId: string) => {
      const draft = methodDrafts[providerId]
      if (!draft || !draft.code.trim() || !draft.displayName.trim()) {
        toast.error('Code and display name are required')
        return
      }

      setIsCreatingMethodFor(providerId)
      try {
        await authorizedRequest(endpoints.shipping.methods, {
          method: 'POST',
          body: {
            code: draft.code.trim(),
            displayName: draft.displayName.trim(),
            providerId,
            isActive: true,
          },
        })
        toast.success('Method created')
        setMethodDrafts((prev) => ({ ...prev, [providerId]: { code: '', displayName: '' } }))
        await loadMethods()
      } catch (e: any) {
        toast.error('Failed to create method', { description: e?.message || 'Please try again.' })
      } finally {
        setIsCreatingMethodFor(null)
      }
    },
    [authorizedRequest, loadMethods, methodDrafts]
  )

  const sorted = useMemo(() => {
    return [...providers].sort((a, b) => String(a.name || a.code || a.id).localeCompare(String(b.name || b.code || b.id)))
  }, [providers])

  const methodsByProvider = useMemo(() => {
    const map = new Map<string, Array<{ id: string; code?: string; displayName?: string }>>()
    for (const m of methods) {
      if (!m.providerId) continue
      if (!map.has(m.providerId)) map.set(m.providerId, [])
      map.get(m.providerId)!.push({ id: m.id, code: m.code, displayName: m.displayName })
    }
    return map
  }, [methods])

  return (
    <AdminLayout title="Shipping providers" description="Configure carrier providers used by shipping methods.">
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Providers</CardTitle>
              <CardDescription>Manage carriers such as internal fleets or external couriers.</CardDescription>
            </div>
            <Button variant="outline" onClick={loadProviders} disabled={isLoading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="providerCode">Code</Label>
                <Input id="providerCode" value={draft.code} onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value }))} placeholder="e.g. internal" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="providerName">Name</Label>
                <Input id="providerName" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Internal Fleet" />
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreate} disabled={!canCreate || isCreating} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add provider
                </Button>
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
              Tip: add provider credentials below to enable future API integrations. You can also create methods directly under each provider.
            </div>

            {sorted.length === 0 ? (
              <div className="text-sm text-muted-foreground">No providers yet.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {sorted.map((provider) => (
                  <Card key={provider.id} className="shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{provider.name || provider.code || 'Provider'}</CardTitle>
                          <CardDescription className="truncate">{provider.code || provider.id}</CardDescription>
                        </div>
                        <Badge variant={provider.isActive === false ? 'secondary' : 'default'}>
                          {provider.isActive === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {editingId === provider.id && editDraft ? (
                        <div className="space-y-4 rounded-md border bg-muted/20 p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Code</Label>
                              <Input value={editDraft.code} onChange={(e) => setEditDraft((d) => (d ? { ...d, code: e.target.value } : d))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Name</Label>
                              <Input value={editDraft.name} onChange={(e) => setEditDraft((d) => (d ? { ...d, name: e.target.value } : d))} />
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Mode</Label>
                              <Select value={editDraft.mode} onValueChange={(v) => setEditDraft((d) => (d ? { ...d, mode: v } : d))}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sandbox">Sandbox</SelectItem>
                                  <SelectItem value="live">Live</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Account ID</Label>
                              <Input value={editDraft.accountId} onChange={(e) => setEditDraft((d) => (d ? { ...d, accountId: e.target.value } : d))} />
                            </div>
                            <div className="space-y-2">
                              <Label>API base URL</Label>
                              <Input value={editDraft.apiBaseUrl} onChange={(e) => setEditDraft((d) => (d ? { ...d, apiBaseUrl: e.target.value } : d))} placeholder="https://api.carrier.com" />
                            </div>
                            <div className="space-y-2">
                              <Label>Webhook URL</Label>
                              <Input value={editDraft.webhookUrl} onChange={(e) => setEditDraft((d) => (d ? { ...d, webhookUrl: e.target.value } : d))} placeholder="https://yourapp.com/webhooks/shipping" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label>API key</Label>
                              <Input type="password" value={editDraft.apiKey} onChange={(e) => setEditDraft((d) => (d ? { ...d, apiKey: e.target.value } : d))} placeholder="Stored in metaJson" />
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
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">Provider configuration</div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => beginEdit(provider)}>
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setDeleteId(provider.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-md border bg-muted/10 p-3">
                              <div className="text-xs text-muted-foreground">Mode</div>
                              <div className="font-medium capitalize">
                                {String((provider.metaJson as any)?.mode || 'sandbox')}
                              </div>
                            </div>
                            <div className="rounded-md border bg-muted/10 p-3">
                              <div className="text-xs text-muted-foreground">API base URL</div>
                              <div className="font-medium truncate">
                                {String((provider.metaJson as any)?.apiBaseUrl || 'Not configured')}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-md border bg-muted/10 p-3">
                            <div className="text-sm font-medium">Quick add method</div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                              <Input
                                value={methodDrafts[provider.id]?.code || ''}
                                onChange={(e) =>
                                  setMethodDrafts((prev) => ({
                                    ...prev,
                                    [provider.id]: { code: e.target.value, displayName: prev[provider.id]?.displayName || '' },
                                  }))
                                }
                                placeholder="Code"
                              />
                              <Input
                                value={methodDrafts[provider.id]?.displayName || ''}
                                onChange={(e) =>
                                  setMethodDrafts((prev) => ({
                                    ...prev,
                                    [provider.id]: { code: prev[provider.id]?.code || '', displayName: e.target.value },
                                  }))
                                }
                                placeholder="Display name"
                              />
                              <Button
                                type="button"
                                onClick={() => createMethodForProvider(provider.id)}
                                disabled={isCreatingMethodFor === provider.id}
                              >
                                {isCreatingMethodFor === provider.id ? 'Adding…' : 'Add'}
                              </Button>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              Methods linked: {methods.filter((m) => m.providerId === provider.id).length}
                            </div>
                          </div>

                          {methodsByProvider.get(provider.id)?.length ? (
                            <div className="rounded-md border bg-muted/10 p-3">
                              <div className="text-sm font-medium">Linked methods</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {methodsByProvider.get(provider.id)!.map((m) => (
                                  <Badge key={m.id} variant="secondary">
                                    {m.displayName || m.code || 'Method'}
                                  </Badge>
                                ))}
                              </div>
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
          title="Delete provider?"
          description="This will remove the provider and may affect linked methods."
          confirmText={isDeleting ? 'Deleting…' : 'Delete'}
          cancelText="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      </div>
    </AdminLayout>
  )
}
