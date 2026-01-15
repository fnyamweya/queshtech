import { useMemo } from 'react'
import { Link, useLocation, useRoute } from 'wouter'
import { CornerDownRight } from 'lucide-react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogBrands } from '@/hooks/use-catalog-brands'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { useCatalogProductById } from '@/hooks/use-catalog-products'

export function AdminProductViewPage() {
  const [, params] = useRoute('/axis/products/:id')
  const [, setLocation] = useLocation()
  const { accessToken } = useAdminAuth()

  const productId = params?.id ? decodeURIComponent(params.id) : null

  const { product, isLoading: isLoadingProduct, error: productError } = useCatalogProductById({
    token: accessToken,
    id: productId,
  })

  const { categories } = useCatalogCategories({ token: accessToken, fallbackToMock: false })
  const { brands } = useCatalogBrands({ token: accessToken })

  const brandById = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of brands) m.set(b.id, b.name)
    return m
  }, [brands])

  const categoryById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.id, c.name)
    return m
  }, [categories])

  const defaultSku = useMemo(() => {
    if (!product?.skus?.length) return null
    const byFlag = product.skus.find((v) => v.isDefault)
    return byFlag ?? product.skus[0] ?? null
  }, [product])

  const resolvedPrice = useMemo(() => {
    if (!product) return null
    const skuPrice = defaultSku?.prices?.[0]
    const productPrice = product.prices?.[0]
    return skuPrice ?? productPrice ?? null
  }, [defaultSku, product])

  if (!productId) {
    return (
      <AdminLayout title="Product" description="Missing product id.">
        <div className="text-sm text-muted-foreground">No product id provided.</div>
      </AdminLayout>
    )
  }

  if (isLoadingProduct) {
    return (
      <AdminLayout title="Product" description="Loading…">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </AdminLayout>
    )
  }

  if (productError || !product) {
    return (
      <AdminLayout title="Product not found" description={productError || 'Not found'}>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">No product matches this id.</div>
          <Button onClick={() => setLocation('/axis/products')}>Back to Products</Button>
        </div>
      </AdminLayout>
    )
  }

  const primaryName = product.title || product.translations?.[0]?.title || product.slug || 'Product'
  const brandName = product.brandId ? brandById.get(product.brandId) : null
  const categoryNames = (product.categoryIds || []).map((id) => categoryById.get(id) || id)

  return (
    <AdminLayout
      title={primaryName}
      description="Product details (price is resolved from price lists + variant prices)."
      actions={
        <Link href="/axis/products">
          <Button variant="outline" size="sm">
            <CornerDownRight className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button asChild size="sm" variant="outline">
          <Link href={`/axis/products/${encodeURIComponent(product.id)}/edit`}>Edit</Link>
        </Button>
        <Badge variant="secondary">{product.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Slug, brand, categories, and translations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Slug</div>
                <div className="font-medium">{product.slug || '—'}</div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Brand</div>
                <div className="font-medium">{brandName || '—'}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">SEO title</div>
                <div className="font-medium">{product.seoTitle || '—'}</div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">SEO description</div>
                <div className="font-medium line-clamp-2">{product.seoDescription || '—'}</div>
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">Categories (ordered; first is primary)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {categoryNames.length === 0 ? (
                  <span className="text-sm text-muted-foreground">—</span>
                ) : (
                  categoryNames.map((name, idx) => (
                    <Badge key={`${name}-${idx}`} variant={idx === 0 ? 'default' : 'secondary'}>
                      {name}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="text-sm font-medium">Translations</div>
              <div className="space-y-2">
                {(product.translations || []).map((t) => (
                  <div key={t.locale} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{t.title}</div>
                      <Badge variant="outline">{t.locale}</Badge>
                    </div>
                    {t.description ? (
                      <div className="text-sm text-muted-foreground mt-1">{t.description}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Default SKU</CardTitle>
              <CardDescription>Used to resolve the displayed price.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">SKU</div>
                <div className="font-medium">{defaultSku?.sku || '—'}</div>
              </div>

              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Resolved price</div>
                {resolvedPrice ? (
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {resolvedPrice.unitPrice}
                    </div>
                    <div className="text-xs text-muted-foreground">Price list: {resolvedPrice.priceListId}</div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No active price found.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>SKUs</CardTitle>
              <CardDescription>Replace-on-save list; one default.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(product.skus || []).length === 0 ? (
                <div className="text-muted-foreground">—</div>
              ) : (
                (product.skus || []).map((v) => (
                  <div key={v.id || v.sku} className="rounded-md border p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{v.sku}</div>
                      {v.title ? <div className="text-xs text-muted-foreground truncate">{v.title}</div> : null}
                    </div>
                    {v.isDefault ? <Badge>default</Badge> : <Badge variant="secondary">variant</Badge>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
