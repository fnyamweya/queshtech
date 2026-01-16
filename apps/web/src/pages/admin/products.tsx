import { Fragment, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AdminLayout } from '@/components/admin/admin-layout'
import { AxisSection, AxisStat } from '@/components/admin/axis-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Archive, CheckCircle2, ChevronDown, ChevronRight, CircleDashed, Eye, Pencil, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react'
import { Link } from 'wouter'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogProducts } from '@/hooks/use-catalog-products'
import { toast } from 'sonner'
import type { CatalogProductStatus } from '@/types/catalog'

export function AdminProductsPage() {
  const { accessToken } = useAdminAuth()
  const productsQuery = useCatalogProducts({ token: accessToken, filters: { page: 1, limit: 20 } })

  const [searchTerm, setSearchTerm] = useState('')
  const [status, setStatus] = useState<CatalogProductStatus | 'all'>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpanded = (id: string) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }))
  }

  const formatStock = (sku: any) => {
    const stock = sku?.availability?.stock
    if (!stock || typeof stock !== 'object') return '—'
    const type = String(stock.type || '').toUpperCase()
    if (type === 'INFINITE') return '∞'
    const qty = stock.quantity
    return typeof qty === 'number' ? String(qty) : '0'
  }

  const pickPrimaryPrice = (prices?: any[]) => {
    if (!Array.isArray(prices) || !prices.length) return null
    // Prefer minQuantity=1 if available, otherwise lowest unit price.
    const withMinOne = prices.filter((p) => (p?.minQuantity ?? 1) === 1)
    const list = withMinOne.length ? withMinOne : prices
    return list
      .filter((p) => typeof p?.unitPrice === 'number' && Number.isFinite(p.unitPrice))
      .sort((a, b) => a.unitPrice - b.unitPrice)[0] || null
  }

  const rows = useMemo(() => {
    let list = productsQuery.items
    const q = searchTerm.trim().toLowerCase()
    if (q) list = list.filter((p) => `${p.slug ?? ''} ${p.title ?? ''}`.toLowerCase().includes(q))
    if (status !== 'all') list = list.filter((p) => p.status === status)
    return list
  }, [productsQuery.items, searchTerm, status])

  const statusCounts = useMemo(() => {
    const counts = { active: 0, draft: 0, archived: 0 }
    for (const p of rows) {
      if (p.status === 'active') counts.active += 1
      if (p.status === 'draft') counts.draft += 1
      if (p.status === 'archived') counts.archived += 1
    }
    return counts
  }, [rows])

  const handleDelete = async (id: string) => {
    const ok = window.confirm('Delete this product?')
    if (!ok) return
    try {
      await productsQuery.deleteProduct(id)
      toast.success('Deleted')
    } catch (e: any) {
      toast.error('Delete failed', { description: e?.message || 'Please try again.' })
    }
  }

  return (
    <AdminLayout
      title="Products"
      description="Manage products, variants, translations, category placement, and compliance metadata."
    >
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="rounded-lg border bg-card/80 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => productsQuery.refresh()} disabled={productsQuery.isLoading}>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button asChild>
                  <Link href="/axis/products/add">
                    <span className="inline-flex items-center">
                      <Plus className="h-4 w-4 mr-2" />
                      New product
                    </span>
                  </Link>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{productsQuery.total ?? productsQuery.items.length} total</Badge>
                {productsQuery.error ? <Badge variant="destructive">{productsQuery.error}</Badge> : null}
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AxisStat label="Results" value={rows.length} description="Filtered view" />
              <AxisStat
                label="Active"
                value={statusCounts.active}
                description="Live products"
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <AxisStat
                label="Draft"
                value={statusCounts.draft}
                description="In progress"
                icon={<CircleDashed className="h-4 w-4" />}
              />
              <AxisStat
                label="Archived"
                value={statusCounts.archived}
                description="Hidden"
                icon={<Archive className="h-4 w-4" />}
              />
            </div>
          </div>
        </motion.div>

        <AxisSection
          title="Catalog"
          description="Search, filter, and manage product entries."
        >
          <div className="grid gap-3 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by slug or title…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SKUs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      {productsQuery.isLoading ? 'Loading…' : 'No products found.'}
                    </TableCell>
                  </TableRow>
                ) : null}
                {rows.map((p) => {
                  const skuCount = p.skus?.length ?? 0
                  const isOpen = Boolean(expanded[p.id])
                  return (
                    <Fragment key={p.id}>
                      <TableRow>
                        <TableCell className="font-mono text-sm">{p.slug || '—'}</TableCell>
                        <TableCell className="font-medium">{p.title || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{p.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => toggleExpanded(p.id)}
                            disabled={skuCount === 0}
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                            {skuCount} SKU{skuCount === 1 ? '' : 's'}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/axis/products/${p.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/axis/products/${p.id}/edit`}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {isOpen ? (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/10">
                            <div className="p-3">
                              <div className="text-sm font-medium mb-2">SKUs</div>
                              <div className="rounded-lg border bg-card overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-[180px]">SKU</TableHead>
                                      <TableHead>Options</TableHead>
                                      <TableHead className="w-[120px]">Stock</TableHead>
                                      <TableHead className="w-[160px]">Price</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(p.skus || []).map((sku) => {
                                      const options = (sku.options && typeof sku.options === 'object' ? sku.options : sku.attributes) as any
                                      const optionEntries = options && typeof options === 'object' ? Object.entries(options) : []
                                      const primary = pickPrimaryPrice(sku.prices)
                                      const priceCount = Array.isArray(sku.prices) ? sku.prices.length : 0

                                      return (
                                        <TableRow key={sku.id || sku.sku}>
                                          <TableCell className="font-mono text-sm">{sku.sku}</TableCell>
                                          <TableCell>
                                            {optionEntries.length ? (
                                              <div className="flex flex-wrap gap-2">
                                                {optionEntries
                                                  .sort(([a], [b]) => String(a).localeCompare(String(b)))
                                                  .map(([k, v]) => (
                                                    <Badge key={k} variant="secondary" className="max-w-[260px] truncate">
                                                      {String(k)}: {String(v)}
                                                    </Badge>
                                                  ))}
                                              </div>
                                            ) : (
                                              <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                          </TableCell>
                                          <TableCell>{formatStock(sku)}</TableCell>
                                          <TableCell>
                                            {primary ? (
                                              <div className="space-y-1">
                                                <div className="font-medium">{primary.unitPrice}</div>
                                                {priceCount > 1 ? (
                                                  <div className="text-xs text-muted-foreground">{priceCount} price rows</div>
                                                ) : null}
                                              </div>
                                            ) : (
                                              <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              disabled={productsQuery.page <= 1 || productsQuery.isLoading}
              onClick={() => productsQuery.setPage(Math.max(1, productsQuery.page - 1))}
            >
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">Page {productsQuery.page}</div>
            <Button
              variant="outline"
              disabled={
                productsQuery.isLoading ||
                (productsQuery.total !== null && productsQuery.page * productsQuery.limit >= productsQuery.total)
              }
              onClick={() => productsQuery.setPage(productsQuery.page + 1)}
            >
              Next
            </Button>
          </div>
        </AxisSection>
      </div>
    </AdminLayout>
  )
}
