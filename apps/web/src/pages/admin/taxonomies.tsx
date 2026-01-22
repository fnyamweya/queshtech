import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Link } from 'wouter'
import { Plus, RefreshCcw, Save, Trash2 } from 'lucide-react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogTaxonomies } from '@/hooks/use-catalog-taxonomies'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { IconPicker } from '@/components/common/icon-picker'
import { resolvePhosphorIcon } from '@/lib/phosphor'

export function AdminTaxonomiesPage() {
  const { accessToken } = useAdminAuth()
  const { taxonomies, isLoading, error, refresh, createTaxonomy, updateTaxonomy, deleteTaxonomy } = useCatalogTaxonomies({
    token: accessToken,
  })

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [draftId, setDraftId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [icon, setIcon] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const [query, setQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [initialDraft, setInitialDraft] = useState({
    id: null as string | null,
    code: '',
    name: '',
    description: '',
    isDefault: false,
    isActive: true,
    icon: '',
    avatarUrl: '',
    imageUrl: '',
  })

  const beginCreate = () => {
    setDraftId(null)
    setCode('')
    setName('')
    setDescription('')
    setIsDefault(false)
    setIsActive(true)
    setIcon('')
    setAvatarUrl('')
    setImageUrl('')

    setInitialDraft({
      id: null,
      code: '',
      name: '',
      description: '',
      isDefault: false,
      isActive: true,
      icon: '',
      avatarUrl: '',
      imageUrl: '',
    })
  }

  const beginEdit = (id: string) => {
    const t = taxonomies.find((x) => x.id === id)
    if (!t) return
    setDraftId(id)
    setCode(t.code)
    setName(t.name)
    setDescription(t.description || '')
    setIsDefault(Boolean(t.isDefault))
    setIsActive(typeof t.isActive === 'boolean' ? t.isActive : true)
    setIcon(t.icon || '')
    setAvatarUrl(t.avatarUrl || '')
    setImageUrl(t.imageUrl || '')

    setInitialDraft({
      id,
      code: t.code,
      name: t.name,
      description: t.description || '',
      isDefault: Boolean(t.isDefault),
      isActive: typeof t.isActive === 'boolean' ? t.isActive : true,
      icon: t.icon || '',
      avatarUrl: t.avatarUrl || '',
      imageUrl: t.imageUrl || '',
    })
  }

  const normalizedCode = code.trim().toLowerCase()
  const codeConflict = useMemo(() => {
    if (!normalizedCode) return null
    const other = taxonomies.find((t) => t.id !== draftId && t.code.trim().toLowerCase() === normalizedCode)
    return other || null
  }, [draftId, normalizedCode, taxonomies])

  const canSave = useMemo(() => code.trim().length > 0 && name.trim().length > 0 && !codeConflict, [code, codeConflict, name])

  const isDirty = useMemo(() => {
    return (
      initialDraft.id !== draftId ||
      initialDraft.code !== code ||
      initialDraft.name !== name ||
      initialDraft.description !== description ||
      initialDraft.isDefault !== isDefault ||
      initialDraft.isActive !== isActive ||
      initialDraft.icon !== icon ||
      initialDraft.avatarUrl !== avatarUrl ||
      initialDraft.imageUrl !== imageUrl
    )
  }, [code, description, draftId, initialDraft, isActive, isDefault, name, icon, avatarUrl, imageUrl])

  const currentDefaultOther = useMemo(() => {
    return taxonomies.find((t) => t.isDefault && t.id !== draftId) || null
  }, [draftId, taxonomies])

  const handleSave = async () => {
    if (!canSave) {
      if (codeConflict) {
        toast.error('Code must be unique', { description: `“${codeConflict.code}” is already used by “${codeConflict.name}”.` })
      } else {
        toast.error('Code and name are required')
      }
      return
    }

    setIsSaving(true)
    try {
      if (draftId) {
        await updateTaxonomy(draftId, {
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          isDefault,
          isActive,
          icon: icon.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
        })
        toast.success('Taxonomy updated')
      } else {
        await createTaxonomy({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          isDefault,
          isActive,
          icon: icon.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
        })
        toast.success('Taxonomy created')
      }
      beginCreate()
    } catch (e: any) {
      toast.error('Failed to save taxonomy', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await deleteTaxonomy(id)
      toast.success('Taxonomy deleted')
      if (draftId === id) beginCreate()
    } catch (e: any) {
      toast.error('Failed to delete taxonomy', { description: e?.message || 'Please try again.' })
    } finally {
      setIsDeleting(false)
    }
  }

  const visibleTaxonomies = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...taxonomies].sort((a, b) => {
      const ad = a.isDefault ? 1 : 0
      const bd = b.isDefault ? 1 : 0
      if (ad !== bd) return bd - ad
      return a.name.localeCompare(b.name)
    })

    if (!q) return sorted

    return sorted.filter((t) => {
      const hay = `${t.name} ${t.code}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, taxonomies])

  return (
    <AdminLayout title="Taxonomies" description="Create and manage catalog taxonomies used to structure categories.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Taxonomies define how categories are organized (e.g. Products, Brands).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/axis/categories">Back to Categories</Link>
            </Button>
            <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={beginCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New taxonomy
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Taxonomies</CardTitle>
                <Badge variant="secondary">{taxonomies.length}</Badge>
              </div>
              <CardDescription>
                {error ? error : 'Search and select a taxonomy to edit.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Command className="rounded-md border">
                <CommandInput placeholder="Search by name or code…" value={query} onValueChange={setQuery} />
                <CommandList>
                  <ScrollArea className="h-[360px]">
                    {visibleTaxonomies.length === 0 ? (
                      <CommandEmpty>No taxonomies found.</CommandEmpty>
                    ) : null}
                    {visibleTaxonomies.map((t) => {
                      const isSelected = t.id === draftId
                      const Icon = resolvePhosphorIcon(t.icon)
                      return (
                        <CommandItem
                          key={t.id}
                          value={`${t.name} ${t.code}`}
                          onSelect={() => beginEdit(t.id)}
                          className={cn(
                            'flex items-start gap-3',
                            isSelected ? 'bg-accent text-accent-foreground' : undefined
                          )}
                        >
                          <Avatar className="h-9 w-9 mt-0.5">
                            {t.avatarUrl || t.imageUrl ? (
                              <AvatarImage src={t.avatarUrl || t.imageUrl} alt={t.name} />
                            ) : null}
                            <AvatarFallback>{Icon ? <Icon size={16} weight="bold" /> : t.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{t.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{t.code}</div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-1">
                            {t.isDefault ? <Badge variant="default">default</Badge> : null}
                            {t.isActive === false ? <Badge variant="outline">inactive</Badge> : <Badge variant="outline">active</Badge>}
                          </div>
                        </CommandItem>
                      )
                    })}
                  </ScrollArea>
                </CommandList>
              </Command>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {draftId ? 'Edit taxonomy' : 'Create taxonomy'}
                    {isDirty ? <Badge variant="secondary">Unsaved changes</Badge> : null}
                  </CardTitle>
                  <CardDescription>Code and name are required. Mark one taxonomy as default if needed.</CardDescription>
                </div>
                {draftId ? <Badge variant="outline">ID: {draftId}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code (required)</label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="product-taxonomy" />
                  {codeConflict ? (
                    <p className="text-xs text-destructive">Code already used by “{codeConflict.name}”.</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name (required)</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Products" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Icon</label>
                  <IconPicker value={icon} onChange={setIcon} placeholder="Search Phosphor icons" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Avatar URL</label>
                  <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://cdn.example.com/tax/avatar.png" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Image URL</label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://cdn.example.com/tax/image.png" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Active</div>
                    <div className="text-xs text-muted-foreground">Controls whether this taxonomy can be used.</div>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Default</div>
                    <div className="text-xs text-muted-foreground">Used as the fallback taxonomy where needed.</div>
                  </div>
                  <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                </div>
              </div>

              {isDefault && currentDefaultOther ? (
                <div className="rounded-md border bg-muted/20 p-3 text-sm">
                  <span className="font-medium">Note:</span> “{currentDefaultOther.name}” is currently marked default. Saving may replace it depending on backend behavior.
                </div>
              ) : null}

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {draftId ? (
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={isDeleting || isSaving}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={beginCreate} disabled={isSaving || isDeleting}>
                    Clear
                  </Button>
                  <Button onClick={handleSave} disabled={!canSave || isSaving || !isDirty}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete taxonomy?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the taxonomy. Categories using it may be impacted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!draftId || isDeleting) return
                  handleDelete(draftId)
                  setDeleteDialogOpen(false)
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  )
}
