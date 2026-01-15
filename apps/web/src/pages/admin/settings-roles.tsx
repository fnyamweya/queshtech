import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, CornerDownRight, Loader2, Plus, Save, Shield, Trash2, X } from 'lucide-react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { endpoints } from '@/lib/endpoints'
import { useAdminAuth } from '@/hooks/use-admin-auth'

type Role = {
  id: string
  name: string
  description?: string
  permissionIds: string[]
}

type Permission = {
  // Canonical key used for rendering + selection: module.permission
  key: string
  // Underlying identifier if backend returns one (not used for rendering)
  id?: string
  description?: string
}

function unwrap<T>(payload: any): T {
  return (payload?.data ?? payload) as T
}

function normalizeRolesResponse(payload: any): Role[] {
  const data = payload?.data ?? payload
  const items = data?.items ?? data?.results ?? data
  if (!Array.isArray(items)) return []

  return items
    .map((r: any) => {
      const permissionIdsRaw = r?.permissionIds ?? r?.permissions ?? r?.permission_ids ?? []
      const permissionIds = Array.isArray(permissionIdsRaw)
        ? permissionIdsRaw
            .map((p: any) => {
              if (typeof p === 'string') return p
              // Prefer the stable permission key over any opaque id
              const module = (p?.module ?? p?.resource ?? '').toString().trim()
              const perm = (p?.permission ?? p?.action ?? p?.scope ?? '').toString().trim()
              if (module && perm) return `${module}.${perm}`
              return String(p?.key ?? p?.name ?? p?.code ?? p?.id ?? '')
            })
            .filter(Boolean)
        : []

      return {
        id: String(r?.id ?? r?._id ?? ''),
        name: String(r?.name ?? r?.title ?? ''),
        description: r?.description ? String(r.description) : undefined,
        permissionIds,
      } satisfies Role
    })
    .filter((r: Role) => Boolean(r.id) && Boolean(r.name))
}

function normalizePermissionsResponse(payload: any): Permission[] {
  const data = payload?.data ?? payload
  const items = data?.items ?? data?.results ?? data
  if (!Array.isArray(items)) return []

  return items
    .map((p: any) => {
      if (typeof p === 'string') {
        // Already in module.permission form
        return { key: p } satisfies Permission
      }

      const module = (p?.module ?? p?.resource ?? '').toString().trim()
      const perm = (p?.permission ?? p?.action ?? p?.scope ?? '').toString().trim()
      const key = module && perm ? `${module}.${perm}` : String(p?.key ?? p?.name ?? p?.code ?? p?.id ?? '')

      return {
        key,
        id: p?.id ? String(p.id) : undefined,
        description: p?.description ? String(p.description) : undefined,
      } satisfies Permission
    })
    .filter((p: Permission) => Boolean(p.key))
}

function permissionGroup(key: string) {
  if (key.includes('.')) return key.split('.')[0]
  if (key.includes(':')) return key.split(':')[0]
  if (key.includes('/')) return key.split('/')[0]
  return 'general'
}

export function AdminSettingsRolesPage() {
  const { authorizedRequest, isAuthenticated } = useAdminAuth()

  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])

  const [isLoading, setIsLoading] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)

  const [listQuery, setListQuery] = useState('')
  const [permQuery, setPermQuery] = useState('')
  const [onlyShowSelected, setOnlyShowSelected] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftPermissionIds, setDraftPermissionIds] = useState<string[]>([])

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return

    let isMounted = true
    setIsLoading(true)
    ;(async () => {
      try {
        const [rolesPayload, permissionsPayload] = await Promise.all([
          authorizedRequest<any>(endpoints.roles.list('getAll=true'), { method: 'GET' }),
          authorizedRequest<any>(endpoints.roles.permissions, { method: 'GET' }),
        ])

        const nextRoles = normalizeRolesResponse(rolesPayload)
        const nextPermissions = normalizePermissionsResponse(permissionsPayload)

        if (!isMounted) return
        setRoles(nextRoles)
        setPermissions(nextPermissions)
      } catch (e: any) {
        toast.error('Failed to load roles & permissions', { description: e?.message || 'Please try again.' })
      } finally {
        if (isMounted) setIsLoading(false)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [authorizedRequest, isAuthenticated])

  const filteredRoles = useMemo(() => {
    if (!listQuery.trim()) return roles
    const q = listQuery.trim().toLowerCase()
    return roles.filter((r) => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q))
  }, [listQuery, roles])

  const groupedPermissions = useMemo(() => {
    const q = permQuery.trim().toLowerCase()
    const filtered = !q
      ? permissions
      : permissions.filter((p) => p.key.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))

    const map = new Map<string, Permission[]>()
    for (const p of filtered) {
      const g = permissionGroup(p.key)
      const list = map.get(g) || []
      list.push(p)
      map.set(g, list)
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, perms]) => ({
        group,
        perms: perms.sort((a, b) => a.key.localeCompare(b.key)),
      }))
  }, [permQuery, permissions])

  const groupInfoByName = useMemo(() => {
    const map = new Map<string, { keys: string[]; total: number }>()
    for (const g of groupedPermissions) {
      const keys = g.perms.map((p) => p.key)
      map.set(g.group, { keys, total: keys.length })
    }
    return map
  }, [groupedPermissions])

  const visibleGroupedPermissions = useMemo(() => {
    if (!onlyShowSelected) return groupedPermissions
    const selected = new Set(draftPermissionIds)
    return groupedPermissions
      .map((g) => ({
        group: g.group,
        perms: g.perms.filter((p) => selected.has(p.key)),
      }))
      .filter((g) => g.perms.length > 0)
  }, [draftPermissionIds, groupedPermissions, onlyShowSelected])

  const permissionsByKey = useMemo(() => {
    const map = new Map<string, Permission>()
    for (const p of permissions) map.set(p.key, p)
    return map
  }, [permissions])

  const permissionsById = useMemo(() => {
    const map = new Map<string, Permission>()
    for (const p of permissions) {
      if (p.id) map.set(p.id, p)
    }
    return map
  }, [permissions])

  const normalizePermissionRefToKey = (ref: string) => {
    const trimmed = ref.trim()
    if (!trimmed) return ''

    // Already a human-readable key
    if (trimmed.includes('.') || trimmed.includes(':') || trimmed.includes('/')) return trimmed

    // If backend uses opaque ids, translate to our canonical key
    const hit = permissionsById.get(trimmed)
    return hit?.key ?? trimmed
  }

  const mapSelectedKeysToBackendIds = (keys: string[]) => {
    const out: string[] = []
    const seen = new Set<string>()
    for (const key of keys) {
      const p = permissionsByKey.get(key)
      const backendId = (p?.id ?? key).trim()
      if (!backendId) continue
      if (seen.has(backendId)) continue
      seen.add(backendId)
      out.push(backendId)
    }
    return out
  }

  const filteredPermissionKeys = useMemo(() => {
    return groupedPermissions.flatMap((g) => g.perms.map((p) => p.key))
  }, [groupedPermissions])

  const selectedPermissions = useMemo(() => {
    const unique = Array.from(new Set(draftPermissionIds))
    unique.sort((a, b) => a.localeCompare(b))
    return unique
      .map((key) => permissionsByKey.get(key) || ({ key } as Permission))
      .filter((p) => Boolean(p.key))
  }, [draftPermissionIds, permissionsByKey])

  useEffect(() => {
    // If we loaded a role before the permissions catalog, we may be holding
    // backend ids in state. Once permissions are available, translate them to
    // canonical keys for rendering/selection.
    if (permissionsById.size === 0) return
    setDraftPermissionIds((prev) => {
      const next = prev.map((x) => normalizePermissionRefToKey(x)).filter(Boolean)
      const unique = Array.from(new Set(next))
      const changed = unique.length !== prev.length || unique.some((v, i) => v !== prev[i])
      return changed ? unique : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsById])

  const selectedRole = useMemo(() => {
    if (!selectedRoleId) return null
    return roles.find((r) => r.id === selectedRoleId) || null
  }, [roles, selectedRoleId])

  const beginCreate = () => {
    setSelectedRoleId(null)
    setDraftId(null)
    setDraftName('')
    setDraftDescription('')
    setDraftPermissionIds([])
  }

  const beginEdit = async (roleId: string) => {
    setSelectedRoleId(roleId)

    try {
      const payload = await authorizedRequest<any>(endpoints.roles.byId(roleId), { method: 'GET' })
      const roleRaw = unwrap<any>(payload)

      const permissionIdsRaw = roleRaw?.permissionIds ?? roleRaw?.permissions ?? roleRaw?.permission_ids ?? []
      const permissionIds = Array.isArray(permissionIdsRaw)
        ? permissionIdsRaw
            .map((p: any) => {
              if (typeof p === 'string') return p
              const module = (p?.module ?? p?.resource ?? '').toString().trim()
              const perm = (p?.permission ?? p?.action ?? p?.scope ?? '').toString().trim()
              if (module && perm) return `${module}.${perm}`
              return String(p?.key ?? p?.name ?? p?.code ?? p?.id ?? '')
            })
            .filter(Boolean)
        : []

      setDraftId(String(roleRaw?.id ?? roleId))
      setDraftName(String(roleRaw?.name ?? ''))
      setDraftDescription(String(roleRaw?.description ?? ''))
      setDraftPermissionIds(permissionIds.map((x) => normalizePermissionRefToKey(String(x))).filter(Boolean))
    } catch (e: any) {
      toast.error('Failed to load role', { description: e?.message || 'Please try again.' })
    }
  }

  const togglePermission = (permissionKey: string, checked: boolean) => {
    setDraftPermissionIds((prev) => {
      const set = new Set(prev)
      if (checked) set.add(permissionKey)
      else set.delete(permissionKey)
      return Array.from(set)
    })
  }

  const selectAllFiltered = () => {
    setDraftPermissionIds((prev) => {
      const set = new Set(prev)
      for (const k of filteredPermissionKeys) set.add(k)
      return Array.from(set)
    })
  }

  const selectAllInGroup = (group: string) => {
    const info = groupInfoByName.get(group)
    if (!info) return

    setDraftPermissionIds((prev) => {
      const set = new Set(prev)
      const selectedCount = info.keys.reduce((acc, k) => acc + (set.has(k) ? 1 : 0), 0)
      const allSelected = info.total > 0 && selectedCount === info.total

      if (allSelected) {
        for (const k of info.keys) set.delete(k)
      } else {
        for (const k of info.keys) set.add(k)
      }

      return Array.from(set)
    })
  }

  const toggleGroupCollapsed = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  const collapseAllGroups = () => {
    const next: Record<string, boolean> = {}
    for (const g of groupedPermissions) next[g.group] = true
    setCollapsedGroups(next)
  }

  const expandAllGroups = () => {
    setCollapsedGroups({})
  }

  const removeSelectedPermission = (key: string) => {
    setDraftPermissionIds((prev) => prev.filter((x) => x !== key))
  }

  const canSave = useMemo(() => {
    return draftName.trim().length >= 2 && draftPermissionIds.length > 0
  }, [draftName, draftPermissionIds.length])

  const refreshRoles = async (keepSelectedId?: string | null) => {
    const rolesPayload = await authorizedRequest<any>(endpoints.roles.list('getAll=true'), { method: 'GET' })
    const nextRoles = normalizeRolesResponse(rolesPayload)
    setRoles(nextRoles)

    if (keepSelectedId) {
      const exists = nextRoles.some((r) => r.id === keepSelectedId)
      setSelectedRoleId(exists ? keepSelectedId : null)
    }
  }

  const handleSave = async () => {
    if (!canSave) {
      toast.error('Missing required fields', { description: 'Name and at least one permission are required.' })
      return
    }

    const permissionIdsForSave = mapSelectedKeysToBackendIds(draftPermissionIds)
    if (permissionIdsForSave.length === 0) {
      toast.error('No valid permissions selected', {
        description: 'Reload permissions and try selecting again.',
      })
      return
    }

    setIsSaving(true)
    try {
      if (draftId) {
        // OpenAPI shows UpdateRoleDto, but its properties are not visible in the snippet.
        // We send the same shape as CreateRoleDto; backend can treat them as optional.
        await authorizedRequest<any>(endpoints.roles.byId(draftId), {
          method: 'PATCH',
          body: {
            name: draftName.trim(),
            description: draftDescription.trim() || undefined,
            permissionIds: permissionIdsForSave,
          },
        })

        toast.success('Role updated')
        await refreshRoles(draftId)
        await beginEdit(draftId)
      } else {
        const payload = await authorizedRequest<any>(endpoints.roles.base, {
          method: 'POST',
          body: {
            name: draftName.trim(),
            description: draftDescription.trim() || undefined,
            permissionIds: permissionIdsForSave,
          },
        })

        const created = unwrap<any>(payload)
        const createdId = String(created?.id ?? created?._id ?? '') || null

        toast.success('Role created')
        await refreshRoles(createdId)
        if (createdId) await beginEdit(createdId)
        else beginCreate()
      }
    } catch (e: any) {
      toast.error('Failed to save role', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!draftId) return

    setIsDeleting(true)
    try {
      await authorizedRequest<any>(endpoints.roles.byId(draftId), { method: 'DELETE' })
      toast.success('Role deleted')
      beginCreate()
      await refreshRoles(null)
    } catch (e: any) {
      toast.error('Failed to delete role', { description: e?.message || 'Please try again.' })
    } finally {
      setIsDeleting(false)
    }
  }

  const permissionCount = draftPermissionIds.length

  return (
    <AdminLayout
      title="Settings · Roles & permissions"
      description="Create roles, assign permission sets, and control admin access."
      actions={
        <Link href="/axis/settings">
          <Button variant="outline" size="sm">
            <CornerDownRight className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.45fr]">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Roles
              </CardTitle>
              <Button size="sm" onClick={beginCreate}>
                <Plus className="h-4 w-4 mr-2" />
                New role
              </Button>
            </div>
            <CardDescription>Search and select a role to edit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={listQuery} onChange={(e) => setListQuery(e.target.value)} placeholder="Search roles…" />

            <div className="rounded-lg border bg-card">
              <ScrollArea className="h-[520px]">
                <div className="p-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : filteredRoles.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">No roles found.</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredRoles.map((r) => {
                        const selected = r.id === selectedRoleId
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => beginEdit(r.id)}
                            className={
                              'w-full rounded-md border px-3 py-2 text-left transition-colors ' +
                              (selected ? 'bg-muted' : 'hover:bg-muted/50')
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate font-medium">{r.name}</div>
                                <div className="truncate text-xs text-muted-foreground">{r.description || '—'}</div>
                              </div>
                              <Badge variant="secondary" className="shrink-0">
                                {r.permissionIds.length}
                              </Badge>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{draftId ? 'Edit role' : 'Create role'}</CardTitle>
                <div className="flex items-center gap-2">
                  {draftId ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isDeleting}>
                          {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete role?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently deletes the role and may affect users assigned to it.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}

                  <Button size="sm" onClick={handleSave} disabled={!canSave || isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </div>
              <CardDescription>
                {draftId
                  ? `Editing “${draftName || selectedRole?.name || 'role'}”. Choose permissions that match the responsibilities.`
                  : 'Define a name and assign a permission set.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name (required)</Label>
                  <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Administrator" />
                </div>

                <div className="space-y-2">
                  <Label>Selected permissions</Label>
                  <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/20 px-3">
                    <Badge variant={permissionCount ? 'default' : 'secondary'}>{permissionCount}</Badge>
                    <span className="text-sm text-muted-foreground">selected</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  placeholder="Human readable description of the role responsibilities"
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Permissions</p>
                    <p className="text-xs text-muted-foreground">Filter and toggle to build the permission set.</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1">
                      <span className="text-xs text-muted-foreground">Only selected</span>
                      <Switch checked={onlyShowSelected} onCheckedChange={setOnlyShowSelected} />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={expandAllGroups} disabled={visibleGroupedPermissions.length === 0}>
                      Expand all
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={collapseAllGroups} disabled={visibleGroupedPermissions.length === 0}>
                      Collapse all
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllFiltered}
                      disabled={filteredPermissionKeys.length === 0 || onlyShowSelected}
                    >
                      Select all filtered
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDraftPermissionIds([])}
                      disabled={draftPermissionIds.length === 0}
                    >
                      Clear all
                    </Button>
                  </div>
                </div>

                {draftPermissionIds.length > 0 ? (
                  <div className="rounded-lg border bg-card">
                    <div className="flex items-center justify-between gap-3 p-3 border-b">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">{draftPermissionIds.length}</Badge>
                        <span className="text-sm font-medium">Selected</span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDraftPermissionIds([])}>
                        Clear
                      </Button>
                    </div>
                    <ScrollArea className="h-[132px]">
                      <div className="p-3 flex flex-wrap gap-2">
                        {selectedPermissions.map((p) => (
                          <Button
                            key={p.key}
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2 gap-1 max-w-full"
                            onClick={() => removeSelectedPermission(p.key)}
                            title={p.description ? `${p.key} — ${p.description}` : p.key}
                          >
                            <span className="truncate max-w-[260px]">{p.key}</span>
                            <X className="h-3.5 w-3.5 opacity-70" />
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : null}

                <Input value={permQuery} onChange={(e) => setPermQuery(e.target.value)} placeholder="Filter permissions…" />

                <div className="rounded-lg border bg-card">
                  <ScrollArea className="h-[360px]">
                    <div className="p-4 space-y-5">
                      {visibleGroupedPermissions.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">No permissions found.</div>
                      ) : (
                        visibleGroupedPermissions.map(({ group, perms }) => {
                          const info = groupInfoByName.get(group)
                          const selected = new Set(draftPermissionIds)
                          const selectedCount = info ? info.keys.reduce((acc, k) => acc + (selected.has(k) ? 1 : 0), 0) : 0
                          const totalCount = info?.total ?? perms.length
                          const allSelected = totalCount > 0 && selectedCount === totalCount
                          const someSelected = selectedCount > 0 && !allSelected
                          const isCollapsed = Boolean(collapsedGroups[group])

                          return (
                          <div key={group} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                className="flex items-center gap-2 min-w-0"
                                onClick={() => toggleGroupCollapsed(group)}
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="text-sm font-medium truncate">{group}</span>
                              </button>
                              <div className="flex items-center gap-2">
                                <Badge variant={allSelected ? 'default' : someSelected ? 'secondary' : 'outline'}>
                                  {selectedCount}/{totalCount}
                                </Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => selectAllInGroup(group)}
                                  disabled={onlyShowSelected}
                                >
                                  {allSelected ? 'Clear' : 'Select all'}
                                </Button>
                              </div>
                            </div>

                            {isCollapsed ? null : (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {perms.map((p) => {
                                  const checked = draftPermissionIds.includes(p.key)
                                  return (
                                    <label
                                      key={p.key}
                                      className="flex items-start gap-2 rounded-md border p-2 hover:bg-muted/40 cursor-pointer"
                                    >
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(v) => togglePermission(p.key, Boolean(v))}
                                        className="mt-0.5"
                                      />
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">{p.key}</span>
                                        {p.description ? (
                                          <span className="block truncate text-xs text-muted-foreground">{p.description}</span>
                                        ) : null}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          )
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex items-center justify-end">
                  <Button onClick={handleSave} disabled={!canSave || isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save role
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API</CardTitle>
              <CardDescription>These calls use the configured API prefix.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">List roles</span>
                <code className="text-xs">{endpoints.roles.list('getAll=true')}</code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Permissions</span>
                <code className="text-xs">{endpoints.roles.permissions}</code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Role by id</span>
                <code className="text-xs">{endpoints.roles.byId('{id}')}</code>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
