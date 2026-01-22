import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { Plus, RefreshCcw, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
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
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogBrands } from '@/hooks/use-catalog-brands'
import { cn } from '@/lib/utils'

export function AdminBrandsPage() {
  const { accessToken } = useAdminAuth()
  const { brands, isLoading, error, refresh, createBrand, updateBrand, deleteBrand } = useCatalogBrands({ token: accessToken })

  const [query, setQuery] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [draftId, setDraftId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [initialDraft, setInitialDraft] = useState({
    id: null as string | null,
    code: '',
    name: '',
    description: '',
    isActive: true,
  })

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const beginCreate = () => {
    setDraftId(null)
    setCode('')
    setName('')
    setDescription('')
    setIsActive(true)
    setInitialDraft({ id: null, code: '', name: '', description: '', isActive: true })
  }

  const beginEdit = (id: string) => {
    const b = brands.find((x) => x.id === id)
    if (!b) return
    setDraftId(id)
    setCode(b.code)
    setName(b.name)
    setDescription(b.description || '')
    setIsActive(typeof b.isActive === 'boolean' ? b.isActive : true)
    setInitialDraft({
      id,
      code: b.code,
      name: b.name,
      description: b.description || '',
      isActive: typeof b.isActive === 'boolean' ? b.isActive : true,
    })
  }

  const normalizedCode = code.trim().toLowerCase()
  const codeConflict = useMemo(() => {
    if (!normalizedCode) return null
    const other = brands.find((b) => b.id !== draftId && b.code.trim().toLowerCase() === normalizedCode)
    return other || null
  }, [brands, draftId, normalizedCode])

  const canSave = useMemo(() => code.trim().length > 0 && name.trim().length > 0 && !codeConflict, [code, codeConflict, name])

  const isDirty = useMemo(() => {
    return (
      initialDraft.id !== draftId ||
      initialDraft.code !== code ||
      initialDraft.name !== name ||
      initialDraft.description !== description ||
      initialDraft.isActive !== isActive
    )
  }, [code, description, draftId, initialDraft, isActive, name])

  const visibleBrands = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name))
    if (!q) return sorted
    return sorted.filter((b) => `${b.name} ${b.code}`.toLowerCase().includes(q))
  }, [brands, query])

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
        await updateBrand(draftId, {
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          isActive,
        })
        toast.success('Brand updated')
      } else {
        await createBrand({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          isActive,
        })
        toast.success('Brand created')
      }
      beginCreate()
    } catch (e: any) {
      toast.error('Failed to save brand', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await deleteBrand(id)
      toast.success('Brand deleted')
      if (draftId === id) beginCreate()
    } catch (e: any) {
      toast.error('Failed to delete brand', { description: e?.message || 'Please try again.' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AdminLayout title="Brands" description="Manage catalog brands used across products and filters.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Brands power filtering and consistent product attribution.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/axis/products">Back to Products</Link>
            </Button>
            <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={beginCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New brand
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Brands</CardTitle>
                <Badge variant="secondary">{brands.length}</Badge>
              </div>
              <CardDescription>
                {error ? error : 'Search and select a brand to edit.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Command className="rounded-md border">
                <CommandInput placeholder="Search by name or code…" value={query} onValueChange={setQuery} />
                <CommandList>
                  <ScrollArea className="h-[360px]">
                    {visibleBrands.length === 0 ? (
                      <CommandEmpty>No brands found.</CommandEmpty>
                    ) : null}
                    {visibleBrands.map((b) => {
                      const isSelected = b.id === draftId
                      return (
                        <CommandItem
                          key={b.id}
                          value={`${b.name} ${b.code}`}
                          onSelect={() => beginEdit(b.id)}
                          className={cn('flex items-start justify-between gap-3', isSelected ? 'bg-accent text-accent-foreground' : undefined)}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{b.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{b.code}</div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-1">
                            {b.isActive === false ? <Badge variant="outline">inactive</Badge> : <Badge variant="outline">active</Badge>}
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
                    {draftId ? 'Edit brand' : 'Create brand'}
                    {isDirty ? <Badge variant="secondary">Unsaved changes</Badge> : null}
                  </CardTitle>
                  <CardDescription>Code and name are required.</CardDescription>
                </div>
                {draftId ? <Badge variant="outline">ID: {draftId}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code (required)</label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="apple" />
                  {codeConflict ? <p className="text-xs text-destructive">Code already used by “{codeConflict.name}”.</p> : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name (required)</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apple" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">Controls whether this brand appears in selection lists.</div>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {draftId ? (
                    <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} disabled={isDeleting || isSaving}>
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
              <AlertDialogTitle>Delete brand?</AlertDialogTitle>
              <AlertDialogDescription>This permanently deletes the brand. Products using it may be impacted.</AlertDialogDescription>
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
