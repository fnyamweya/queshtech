import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useRoute } from 'wouter'
import { CornerDownRight, ExternalLink } from 'lucide-react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogBrands } from '@/hooks/use-catalog-brands'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { useCatalogProductById } from '@/hooks/use-catalog-products'
import { usePriceLists } from '@/hooks/use-pricing'

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
  const { priceLists } = usePriceLists({ token: accessToken })

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

  const resolvedPriceList = useMemo(() => {
    if (!resolvedPrice?.priceListId) return null
    return priceLists.find((p) => p.id === resolvedPrice.priceListId) ?? null
  }, [priceLists, resolvedPrice?.priceListId])

  const formatMoney = (value: number, currencyCode?: string) => {
    const currency = String(currencyCode || '').trim()
    if (!currency) return String(value)
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
    } catch {
      return `${value} ${currency}`.trim()
    }
  }

  const formatDateTime = (value?: string) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    try {
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
    } catch {
      return value
    }
  }

  const primaryName = product?.title || product?.translations?.[0]?.title || product?.slug || 'Product'

  const images = useMemo(() => {
    const raw = Array.isArray(product?.images) ? product.images : []
    return [...raw]
      .filter((img) => Boolean(img?.url))
      .sort((a, b) => {
        const ap = Boolean(a.isPrimary)
        const bp = Boolean(b.isPrimary)
        if (ap !== bp) return ap ? -1 : 1
        const ao = typeof a.sortOrder === 'number' ? a.sortOrder : 0
        const bo = typeof b.sortOrder === 'number' ? b.sortOrder : 0
        if (ao !== bo) return ao - bo
        return String(a.url).localeCompare(String(b.url))
      })
  }, [product?.images])

  const primaryImageIndex = useMemo(() => Math.max(0, images.findIndex((i) => i.isPrimary)), [images])
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  useEffect(() => {
    setActiveImageIndex(primaryImageIndex)
  }, [primaryImageIndex, product?.id])

  const storefrontHref = product?.slug ? `/product/${product.slug}` : null

  if (!productId) {
    return (
      <AdminLayout title="Product" description="Missing product id.">
        <div className="text-sm text-muted-foreground">No product id provided.</div>
      </AdminLayout>
    )
  }

  if (isLoadingProduct) {
    return <AdminLayout title="Product" description="Product" />
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

  const brandName = product.brandId ? brandById.get(product.brandId) : null
  const categoryNames = (product.categoryIds || []).map((id) => categoryById.get(id) || id)
  const tags = Array.isArray((product.metaJson as any)?.tags)
    ? (product.metaJson as any).tags.map((t: any) => String(t).trim()).filter(Boolean)
    : []

  return (
    <AdminLayout
      title={primaryName}
      description="Product details (price is resolved from price lists + variant prices)."
      actions={
        <div className="flex items-center gap-2">
          <Link href="/axis/products">
            <Button variant="outline" size="sm">
              <CornerDownRight className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
          </Link>
          {storefrontHref ? (
            <a href={storefrontHref} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Storefront
              </Button>
            </a>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button asChild size="sm" variant="outline">
          <Link href={`/axis/products/${encodeURIComponent(product.id)}/edit`}>Edit</Link>
        </Button>
        <Badge variant="secondary">{product.status}</Badge>
        {brandName ? <Badge variant="outline">{brandName}</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Media</CardTitle>
              <CardDescription>Primary image + gallery.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {images.length ? (
                <>
                  <div className="relative overflow-hidden rounded-md border bg-muted/20">
                    <div className="aspect-[4/3] w-full">
                      <img
                        src={images[Math.min(activeImageIndex, images.length - 1)]?.url}
                        alt={images[Math.min(activeImageIndex, images.length - 1)]?.alt || primaryName}
                        className="h-full w-full object-cover"
                        loading="eager"
                      />
                    </div>
                    <div className="absolute left-3 top-3 flex items-center gap-2">
                      <Badge variant="secondary">
                        {Math.min(activeImageIndex, images.length - 1) + 1}/{images.length}
                      </Badge>
                      {images[Math.min(activeImageIndex, images.length - 1)]?.isPrimary ? <Badge>Primary</Badge> : null}
                    </div>
                    <div className="absolute bottom-3 right-3">
                      <a
                        href={images[Math.min(activeImageIndex, images.length - 1)]?.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm" variant="secondary">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open
                        </Button>
                      </a>
                    </div>
                  </div>

                  {images.length > 1 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {images.slice(0, 14).map((img, idx) => {
                        const active = idx === activeImageIndex
                        return (
                          <button
                            key={img.id || img.url}
                            type="button"
                            onClick={() => setActiveImageIndex(idx)}
                            className={[
                              'relative shrink-0 overflow-hidden rounded-md border bg-muted/10 transition',
                              active ? 'border-primary ring-1 ring-primary/20' : 'hover:border-border',
                            ].join(' ')}
                            aria-label={`Select image ${idx + 1}`}
                          >
                            <div className="aspect-square w-16">
                              <img src={img.url} alt={img.alt || primaryName} className="h-full w-full object-cover" loading="lazy" />
                            </div>
                            {img.isPrimary ? (
                              <span className="absolute left-1 top-1 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium">
                                P
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No images yet.</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>Slug, brand, categories, and translations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Product ID</div>
                  <div className="font-medium break-all">{product.id}</div>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">External ref</div>
                  <div className="font-medium break-all">{product.externalRef || '—'}</div>
                </div>
              </div>

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
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div className="font-medium">{formatDateTime(product.createdAt)}</div>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Updated</div>
                  <div className="font-medium">{formatDateTime(product.updatedAt)}</div>
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

              {tags.length ? (
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Tags</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">Translations</div>
                <div className="space-y-2">
                  {(product.translations || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">—</div>
                  ) : (
                    (product.translations || []).map((t) => (
                      <div key={t.locale} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{t.title}</div>
                          <Badge variant="outline">{t.locale}</Badge>
                        </div>
                        {t.description ? <div className="text-sm text-muted-foreground mt-1">{t.description}</div> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Description</CardTitle>
              <CardDescription>Customer-facing content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {product.shortDescription ? (
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Short description</div>
                  <div className="mt-1">{product.shortDescription}</div>
                </div>
              ) : null}
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Description</div>
                <div className="mt-1 whitespace-pre-wrap">{product.description || '—'}</div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                      {formatMoney(resolvedPrice.unitPrice, resolvedPriceList?.currencyCode)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Price list: {resolvedPriceList ? `${resolvedPriceList.name} (${resolvedPriceList.currencyCode})` : resolvedPrice.priceListId}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No active price found.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Options</CardTitle>
              <CardDescription>Validates SKU options (e.g., size, color).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(product.optionDefinitions || []).length === 0 ? (
                <div className="text-muted-foreground">—</div>
              ) : (
                (product.optionDefinitions || []).map((opt) => (
                  <div key={opt.key} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">
                        {opt.label} <span className="text-muted-foreground">({opt.key})</span>
                      </div>
                      {opt.required ? <Badge>required</Badge> : <Badge variant="secondary">optional</Badge>}
                    </div>
                    {opt.allowedValues?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {opt.allowedValues.slice(0, 20).map((v) => (
                          <Badge key={`${opt.key}:${v}`} variant="outline">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-muted-foreground">Allowed values are derived from SKUs.</div>
                    )}
                  </div>
                ))
              )}
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
