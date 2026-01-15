import { useMemo } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Link, useRoute } from 'wouter'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { resolvePhosphorIcon } from '@/lib/phosphor'

export function AdminCategoryViewPage() {
  const [, params] = useRoute('/axis/categories/:id')
  const { accessToken } = useAdminAuth()
  const { categories, isLoading, error } = useCatalogCategories({ token: accessToken, fallbackToMock: false })

  const categoryId = params?.id
  const category = useMemo(() => {
    if (!categoryId) return null
    return categories.find(c => c.id === categoryId) ?? categories.find(c => c.slug === categoryId) ?? null
  }, [categories, categoryId])

  const parentName = useMemo(() => {
    if (!category?.parentId) return 'Top level'
    const parent = categories.find(c => c.id === category.parentId)
    return parent?.name || category.parentId
  }, [categories, category?.parentId])

  return (
    <AdminLayout
      title={category ? `Category: ${category.name}` : 'Category'}
      description="Category overview."
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="shadow-sm">
          <CardHeader className="flex items-start justify-between">
            <div>
              <CardTitle>{category?.name ?? 'Category'}</CardTitle>
              <CardDescription>{category?.description || 'Category details and storefront mapping.'}</CardDescription>
            </div>
            <Badge variant="outline">catalog</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && (
              <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                Loading category…
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                Failed to load categories: {error}
              </div>
            )}

            {!isLoading && !category && (
              <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                Category not found.
              </div>
            )}

            {category && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Icon</p>
                    <div className="h-10 w-10 rounded-md border bg-background flex items-center justify-center">
                      {(() => {
                        const Icon = resolvePhosphorIcon(category.icon)
                        return Icon ? <Icon size={18} weight="bold" /> : <span className="text-xs text-muted-foreground">None</span>
                      })()}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Avatar</p>
                    <Avatar className="h-10 w-10">
                      {category.avatarUrl ? <AvatarImage src={category.avatarUrl} alt={category.name} /> : null}
                      <AvatarFallback>{category.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Image</p>
                    {category.imageUrl || category.image ? (
                      <div
                        className="aspect-video w-full rounded-md bg-center bg-cover"
                        style={{ backgroundImage: `url(${category.imageUrl || category.image})` }}
                      />
                    ) : (
                      <div className="aspect-video w-full rounded-md bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="rounded-lg border bg-card p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Slug</p>
                    <p className="font-semibold break-all">{category.slug}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Parent</p>
                    <p className="font-semibold">{parentName}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Products</p>
                    <p className="font-semibold">{category.productCount ?? '—'}</p>
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="flex items-center gap-2">
              <Button asChild disabled={!categoryId}>
                <Link href={`/axis/categories/${categoryId ?? 'category'}/edit`}>Edit category</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/axis/categories">Back</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Identifiers and hierarchy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="font-semibold">ID</p>
                  <p className="text-muted-foreground break-all">{category?.id ?? categoryId ?? '—'}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="font-semibold">Parent</p>
                  <p className="text-muted-foreground">{parentName}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="font-semibold">Slug</p>
                  <p className="text-muted-foreground break-all">{category?.slug ?? '—'}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="font-semibold">Image</p>
                  <p className="text-muted-foreground break-all">{category?.imageUrl ?? category?.image ?? '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
