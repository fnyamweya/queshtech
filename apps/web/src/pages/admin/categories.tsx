import { useEffect, useMemo, useState } from 'react'
import type { Category } from '@/types'
import { Link } from 'wouter'
import { Eye, Pencil, Plus, RefreshCcw } from 'lucide-react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { cn } from '@/lib/utils'
import { resolvePhosphorIcon } from '@/lib/phosphor'

export function AdminCategoriesPage() {
  const { accessToken } = useAdminAuth()
  const { categories, isLoading, error, refresh } = useCatalogCategories({ token: accessToken, fallbackToMock: false })

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const byId = useMemo(() => {
    const map = new Map<string, Category>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])

  const visibleCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name))
    if (!q) return sorted
    return sorted.filter((c) => `${c.name} ${c.slug}`.toLowerCase().includes(q))
  }, [categories, query])

  useEffect(() => {
    if (selectedId) return
    if (visibleCategories.length === 0) return
    setSelectedId(visibleCategories[0].id)
  }, [selectedId, visibleCategories])

  const selected = useMemo(() => {
    if (!selectedId) return null
    return byId.get(selectedId) || null
  }, [byId, selectedId])

  const getCategoryPath = useMemo(() => {
    return (cat: Category | null) => {
      if (!cat) return '—'
      const parts: string[] = [cat.name]
      let cursor: Category | undefined = cat
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
  }, [byId])

  return (
    <AdminLayout
      title="Categories"
      description="Curate catalog groupings and keep assortments organized."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Design a clean category hierarchy for navigation, merchandising, and search.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/axis/categories/add">
                <span className="inline-flex items-center">
                  <Plus className="h-4 w-4 mr-2" />
                  New category
                </span>
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Categories</CardTitle>
                <Badge variant="secondary">{categories.length}</Badge>
              </div>
              <CardDescription>{isLoading ? 'Loading…' : error ? error : 'Search and select a category.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Command className="rounded-md border">
                <CommandInput placeholder="Search by name or slug…" value={query} onValueChange={setQuery} />
                <CommandList>
                  <ScrollArea className="h-[360px]">
                    {visibleCategories.length === 0 ? (
                      <CommandEmpty>{isLoading ? 'Loading…' : 'No categories found.'}</CommandEmpty>
                    ) : null}
                    {visibleCategories.map((c) => {
                      const isSelected = c.id === selectedId
                      const path = getCategoryPath(c)
                      const Icon = resolvePhosphorIcon(c.icon)
                      return (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.slug}`}
                          onSelect={() => setSelectedId(c.id)}
                          className={cn(
                            'flex items-start gap-3',
                            isSelected ? 'bg-accent text-accent-foreground' : undefined
                          )}
                        >
                          <Avatar className="h-9 w-9 mt-0.5">
                            {c.avatarUrl || c.imageUrl ? (
                              <AvatarImage src={c.avatarUrl || c.imageUrl} alt={c.name} />
                            ) : null}
                            <AvatarFallback>
                              {Icon ? <Icon size={16} weight="bold" /> : c.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{c.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{c.slug}</div>
                            <div className="text-xs text-muted-foreground truncate">{path}</div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-1">
                            {typeof c.productCount === 'number' ? <Badge variant="outline">{c.productCount} products</Badge> : null}
                            {c.parentId ? <Badge variant="outline">child</Badge> : <Badge variant="outline">top-level</Badge>}
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
                  <CardTitle>Category details</CardTitle>
                  <CardDescription>{selected ? 'Review details or open view/edit.' : 'Select a category to see details.'}</CardDescription>
                </div>
                {selected ? <Badge variant="outline">ID: {selected.id}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Name</div>
                      <div className="text-sm text-muted-foreground">{selected.name}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Slug</div>
                      <div className="text-sm text-muted-foreground">{selected.slug}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-medium">Path</div>
                    <div className="text-sm text-muted-foreground">{getCategoryPath(selected)}</div>
                  </div>

                  {selected.description ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Description</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.description}</div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Icon</p>
                      <div className="h-10 w-10 rounded-md border bg-background flex items-center justify-center">
                        {(() => {
                          const Icon = resolvePhosphorIcon(selected.icon)
                          return Icon ? <Icon size={18} weight="bold" /> : <span className="text-xs text-muted-foreground">None</span>
                        })()}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Avatar</p>
                      <Avatar className="h-10 w-10">
                        {selected.avatarUrl ? <AvatarImage src={selected.avatarUrl} alt={selected.name} /> : null}
                        <AvatarFallback>{selected.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Image</p>
                      {selected.imageUrl || selected.image ? (
                        <div
                          className="aspect-video w-full rounded-md bg-center bg-cover"
                          style={{ backgroundImage: `url(${selected.imageUrl || selected.image})` }}
                        />
                      ) : (
                        <div className="aspect-video w-full rounded-md bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" asChild>
                        <Link href={`/axis/categories/${selected.id}`}>
                          <span className="inline-flex items-center">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </span>
                        </Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/axis/categories/${selected.id}/edit`}>
                          <span className="inline-flex items-center">
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </span>
                        </Link>
                      </Button>
                    </div>

                    <Button asChild>
                      <Link href="/axis/categories/add">
                        <span className="inline-flex items-center">
                          <Plus className="h-4 w-4 mr-2" />
                          New category
                        </span>
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                  {isLoading ? 'Loading categories…' : 'Pick a category from the left, or create a new one.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
