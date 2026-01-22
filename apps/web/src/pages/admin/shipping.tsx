import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { Pencil, Plus, RefreshCcw, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { endpoints } from '@/lib/endpoints'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/commerce/confirm-dialog'

type ShippingZone = {
  id: string
  name?: string
  code?: string
  isActive?: boolean
  locations?: Array<{ id?: string }>
  zoneMethods?: Array<{ id?: string }>
}

type ZoneDraft = {
  name: string
  code: string
  isActive: boolean
}

const asArray = <T,>(payload: any): T[] => {
  const unwrapped = payload?.data ?? payload
  if (Array.isArray(unwrapped)) return unwrapped as T[]
  if (Array.isArray(unwrapped?.items)) return unwrapped.items as T[]
  return []
}

export function AdminShippingPage() {
  const { authorizedRequest } = useAdminAuth()

  const [zones, setZones] = useState<ShippingZone[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [createName, setCreateName] = useState('')
  const [createCode, setCreateCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft | null>(null)
  const [isSavingZone, setIsSavingZone] = useState(false)

  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null)
  const [isDeletingZone, setIsDeletingZone] = useState(false)

  const beginEdit = useCallback((zone: ShippingZone) => {
    setEditingZoneId(zone.id)
    setZoneDraft({
      name: zone.name || '',
      code: zone.code || '',
      isActive: zone.isActive !== false,
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingZoneId(null)
    setZoneDraft(null)
  }, [])

  const patchZone = useCallback(
    async (zoneId: string, body: any) => {
      await authorizedRequest(endpoints.shipping.zoneById(zoneId), { method: 'PATCH', body })
    },
    [authorizedRequest]
  )

  const removeZone = useCallback(
    async (zoneId: string) => {
      await authorizedRequest(endpoints.shipping.zoneById(zoneId), { method: 'DELETE' })
    },
    [authorizedRequest]
  )

  const loadZones = useCallback(async () => {
    setIsLoading(true)
    try {
      const payload = await authorizedRequest<any>(endpoints.shipping.zones, { method: 'GET' })
      setZones(asArray<ShippingZone>(payload))
    } catch (e: any) {
      toast.error('Failed to load shipping zones', { description: e?.message || 'Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }, [authorizedRequest])

  useEffect(() => {
    loadZones()
  }, [loadZones])

  const canCreate = createName.trim().length > 0 && createCode.trim().length > 0

  const handleCreate = useCallback(async () => {
    if (!canCreate) return
    setIsCreating(true)
    try {
      const body = {
        name: createName.trim(),
        code: createCode.trim(),
      }

      await authorizedRequest(endpoints.shipping.zones, { method: 'POST', body })
      toast.success('Zone created')
      setCreateName('')
      setCreateCode('')
      await loadZones()
    } catch (e: any) {
      toast.error('Failed to create zone', { description: e?.message || 'Please try again.' })
    } finally {
      setIsCreating(false)
    }
  }, [authorizedRequest, canCreate, createCode, createName, loadZones])

  const handleSaveZone = useCallback(async () => {
    if (!editingZoneId || !zoneDraft) return
    if (!zoneDraft.name.trim()) {
      toast.error('Zone name is required')
      return
    }
    if (!zoneDraft.code.trim()) {
      toast.error('Zone code is required')
      return
    }

    setIsSavingZone(true)
    try {
      await patchZone(editingZoneId, {
        name: zoneDraft.name.trim(),
        code: zoneDraft.code.trim(),
        isActive: zoneDraft.isActive,
      })
      toast.success('Zone updated')
      cancelEdit()
      await loadZones()
    } catch (e: any) {
      toast.error('Failed to update zone', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSavingZone(false)
    }
  }, [cancelEdit, editingZoneId, loadZones, patchZone, zoneDraft])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteZoneId) return
    setIsDeletingZone(true)
    try {
      await removeZone(deleteZoneId)
      toast.success('Zone deleted')
      setDeleteZoneId(null)
      if (editingZoneId === deleteZoneId) cancelEdit()
      await loadZones()
    } catch (e: any) {
      toast.error('Failed to delete zone', { description: e?.message || 'Please try again.' })
    } finally {
      setIsDeletingZone(false)
    }
  }, [cancelEdit, deleteZoneId, editingZoneId, loadZones, removeZone])

  const sortedZones = useMemo(() => {
    return [...zones].sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
  }, [zones])

  return (
    <AdminLayout title="Shipping" description="Configure zones, destinations, methods, and rates.">
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Zones</CardTitle>
              <CardDescription>Zones group destinations and the shipping methods that apply.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={loadZones} disabled={isLoading}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="zoneName">Zone name</Label>
                <Input id="zoneName" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Nairobi Metro" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zoneCode">Code</Label>
                <Input id="zoneCode" value={createCode} onChange={(e) => setCreateCode(e.target.value)} placeholder="e.g. KE-NRB" />
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreate} disabled={!canCreate || isCreating} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add zone
                </Button>
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
              Tip: Create a zone, attach destinations, then assign methods and rates from the zone detail page.
            </div>

            <Separator />

            {sortedZones.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No zones yet. Create your first zone to start configuring shipping.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {sortedZones.map((z) => (
                  <Card key={z.id} className="shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{z.name || z.id}</CardTitle>
                          <CardDescription className="truncate">{z.code ? `Code: ${z.code}` : `ID: ${z.id}`}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={z.isActive === false ? 'secondary' : 'default'}>{z.isActive === false ? 'Inactive' : 'Active'}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>Destinations: {Array.isArray(z.locations) ? z.locations.length : 0}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <span>Methods: {Array.isArray(z.zoneMethods) ? z.zoneMethods.length : 0}</span>
                      </div>
                      {editingZoneId === z.id && zoneDraft ? (
                        <div className="space-y-4 rounded-md border bg-muted/20 p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Zone name</Label>
                              <Input value={zoneDraft.name} onChange={(e) => setZoneDraft({ ...zoneDraft, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>Code</Label>
                              <Input value={zoneDraft.code} onChange={(e) => setZoneDraft({ ...zoneDraft, code: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>Active</Label>
                              <div className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
                                <Switch checked={zoneDraft.isActive} onCheckedChange={(checked) => setZoneDraft({ ...zoneDraft, isActive: checked })} />
                                <span className="text-sm text-muted-foreground">{zoneDraft.isActive ? 'Active' : 'Inactive'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={cancelEdit} disabled={isSavingZone}>
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleSaveZone} disabled={isSavingZone || !zoneDraft.name.trim()}>
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Configure destinations, methods, and rates.</div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => beginEdit(z)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setDeleteZoneId(z.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                          <Link href={`/axis/shipping/${encodeURIComponent(z.id)}`}>
                            <Button size="sm">Manage</Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <ConfirmDialog
          open={Boolean(deleteZoneId)}
          onOpenChange={(open) => {
            if (!open && !isDeletingZone) setDeleteZoneId(null)
          }}
          title="Delete shipping zone?"
          description="This will permanently remove the zone."
          confirmText={isDeletingZone ? 'Deleting…' : 'Delete'}
          cancelText="Cancel"
          onConfirm={handleConfirmDelete}
          variant="destructive"
        />
      </div>
    </AdminLayout>
  )
}
