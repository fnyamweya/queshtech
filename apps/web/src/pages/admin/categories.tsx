import { useEffect, useMemo, useState } from 'react'
import type { Category } from '@/types'
import { Link } from 'wouter'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { cn } from '@/lib/utils'
import { LniIcon } from '@/components/common/lni-icon'
import { ValueIcon } from '@/components/common/value-icon'

type StatusFilter = 'all' | 'active' | 'hidden'

function categoryPath(category: Category, byId: Map<string, Category>): string {
  const parts: string[] = [category.name]
  let cursor: Category | undefined = category
  const seen = new Set<string>()

  for (let i = 0; i < 8; i++) {
    const parentId = cursor?.parentId
    if (!parentId) break
    if (seen.has(parentId)) break
    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    parts.unshift(parent.name)
    cursor = parent
  }

  return parts.join(' / ')
}

export function AdminCategoriesPage() {
  const { accessToken } = useAdminAuth()
  const { categories, isLoading, error, refresh, updateCategory } = useCatalogCategories({ token: accessToken, fallbackToMock: false })

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const byId = useMemo(() => {
    const map = new Map<string, Category>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = categories.filter((c) => {
      const matchesQuery = !q || `${c.name} ${c.slug} ${c.key || ''}`.toLowerCase().includes(q)
      const matchesStatus =
        status === 'all' ? true : status === 'active' ? (c.isActive ?? true) : !(c.isActive ?? true)
      return matchesQuery && matchesStatus
    })

    return filtered.sort((a, b) => {
      const ao = typeof a.sortOrder === 'number' ? a.sortOrder : Number.POSITIVE_INFINITY
      const bo = typeof b.sortOrder === 'number' ? b.sortOrder : Number.POSITIVE_INFINITY
      if (ao !== bo) return ao - bo
      return a.name.localeCompare(b.name)
    })
  }, [categories, query, status])

  useEffect(() => {
    if (selectedId) return
    if (!visible.length) return
    setSelectedId(visible[0].id)
  }, [selectedId, visible])

  const selected = useMemo(() => {
    if (!selectedId) return null
    return byId.get(selectedId) || null
  }, [byId, selectedId])

  const activeCount = useMemo(() => categories.filter((c) => c.isActive ?? true).length, [categories])

  const onToggleActive = async (cat: Category, nextActive: boolean) => {
    setSavingId(cat.id)
    try {
      const updated = await updateCategory(cat.id, { isActive: nextActive })
      if (!updated) throw new Error('No update returned')
    } catch (e: any) {
      toast.error('Failed to update category', { description: e?.message || 'Please try again.' })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <AdminLayout title="Categories" description="Curate catalog groupings and keep assortments organized.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{categories.length} total</Badge>
            <Badge variant="outline">{activeCount} active</Badge>
            {status !== 'all' ? <Badge variant="outline">Filter: {status}</Badge> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
              <LniIcon name="lni-refresh-circle-1-clockwise" size={16} className="mr-2" />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/axis/categories/add">
                <span className="inline-flex items-center">
                  <LniIcon name="lni-plus" size={16} className="mr-2" />
                  New category
                </span>
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[520px_1fr]">
          <Card className="shadow-sm">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Browse</CardTitle>
                <Badge variant="secondary">{visible.length}</Badge>
              </div>
              <CardDescription>{error ? error : 'Search, filter, and select a category.'}</CardDescription>

              <div className="flex flex-wrap items-center gap-2">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, slug, or key…" className="flex-1" />
                <div className="flex items-center gap-2">
                  <Button type="button" variant={status === 'all' ? 'secondary' : 'outline'} size="sm" onClick={() => setStatus('all')}>
                    All
                  </Button>
                  <Button type="button" variant={status === 'active' ? 'secondary' : 'outline'} size="sm" onClick={() => setStatus('active')}>
                    Active
                  </Button>
                  <Button type="button" variant={status === 'hidden' ? 'secondary' : 'outline'} size="sm" onClick={() => setStatus('hidden')}>
                    Hidden
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Products</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!visible.length ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                          No categories found.
                        </TableCell>
                      </TableRow>
                    ) : null}

                    {visible.map((c) => {
                      const isSelected = c.id === selectedId
                      const parent = c.parentId ? byId.get(c.parentId) : null
                      const isActive = c.isActive ?? true
                      return (
                        <TableRow
                          key={c.id}
                          data-state={isSelected ? 'selected' : undefined}
                          className={cn('cursor-pointer', isSelected && 'bg-muted')}
                          onClick={() => setSelectedId(c.id)}
                        >
                          <TableCell className="min-w-0">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt={c.name} /> : null}
                                <AvatarFallback>{c.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate">{c.name}</span>
                                  {c.icon ? <ValueIcon value={c.icon} size={16} className="text-muted-foreground" /> : null}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{c.slug}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">{parent?.name || 'Top level'}</TableCell>
                          <TableCell>
                            <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Active' : 'Hidden'}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{typeof c.productCount === 'number' ? c.productCount : '—'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle>Details</CardTitle>
                  <CardDescription>{selected ? 'Review and update visibility, or open view/edit.' : 'Select a category.'}</CardDescription>
                </div>
                {selected ? <Badge variant="outline">ID: {selected.id}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Pick a category from the list, or create a new one.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {selected.avatarUrl ? <AvatarImage src={selected.avatarUrl} alt={selected.name} /> : null}
                        <AvatarFallback>{selected.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-semibold truncate">{selected.name}</div>
                          {selected.icon ? <ValueIcon value={selected.icon} size={18} className="text-muted-foreground" /> : null}
                        </div>
                        <div className="text-sm text-muted-foreground">/{selected.slug}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={selected.isActive ?? true}
                        disabled={savingId === selected.id}
                        onCheckedChange={(checked) => onToggleActive(selected, checked)}
                      />
                      <span className="text-sm text-muted-foreground">{selected.isActive ?? true ? 'Active' : 'Hidden'}</span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Path</div>
                      <div className="text-sm text-muted-foreground">{categoryPath(selected, byId)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Key</div>
                      <div className="text-sm text-muted-foreground">{selected.key || '—'}</div>
                    </div>
                  </div>

                  {selected.description ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Description</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.description}</div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Taxonomy</p>
                      <p className="text-sm font-medium break-all">{selected.taxonomyId || '—'}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Sort</p>
                      <p className="text-sm font-medium">{typeof selected.sortOrder === 'number' ? selected.sortOrder : '—'}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Locale</p>
                      <p className="text-sm font-medium">{selected.locale || '—'}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Avatar</p>
                      <p className="text-xs text-muted-foreground break-all">{selected.avatarUrl || '—'}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Image</p>
                      <p className="text-xs text-muted-foreground break-all">{selected.imageUrl || selected.image || '—'}</p>
                    </div>
                  </div>

                  {selected.imageUrl || selected.image ? (
                    <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted/20">
                      <img src={selected.imageUrl || selected.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="aspect-video w-full rounded-lg border bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}

                  <Separator />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" asChild>
                        <Link href={`/axis/categories/${selected.id}`}>
                          <span className="inline-flex items-center">
                            <LniIcon name="lni-eye" size={16} className="mr-2" />
                            View
                          </span>
                        </Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/axis/categories/${selected.id}/edit`}>
                          <span className="inline-flex items-center">
                            <LniIcon name="lni-pencil-1" size={16} className="mr-2" />
                            Edit
                          </span>
                        </Link>
                      </Button>
                    </div>
                    <Button asChild>
                      <Link href="/axis/categories/add">
                        <span className="inline-flex items-center">
                          <LniIcon name="lni-plus" size={16} className="mr-2" />
                          New category
                        </span>
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

