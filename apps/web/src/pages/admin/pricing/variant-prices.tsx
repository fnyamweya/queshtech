import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogProducts } from '@/hooks/use-catalog-products'
import { usePriceLists, useVariantPrices } from '@/hooks/use-pricing'
import type { ProductVariantPrice } from '@/types/catalog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, RefreshCcw, Save, Trash2 } from 'lucide-react'

function asNumber(v: string): number | null {
  if (!v.trim()) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toDraft(priceListId: string, variantId: string) {
  return {
    unitPrice: '',
    compareAtPrice: '',
    minQuantity: '1',
    maxQuantity: '',
    validFrom: '',
    validTo: '',
    priceListId,
    variantId,
  }
}

export function AdminVariantPricesPage() {
  const { accessToken } = useAdminAuth()
  const { priceLists, isLoading: isLoadingLists, error: listsError, refresh: refreshLists } = usePriceLists({ token: accessToken })

  const [selectedPriceListId, setSelectedPriceListId] = useState<string | null>(null)
  const [productQuery, setProductQuery] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const productsQuery = useCatalogProducts({
    token: accessToken,
    filters: { page: 1, limit: 20, q: productQuery.trim() || undefined },
  })

  const variants = useMemo(() => {
    const out: { variantId: string; sku: string; title?: string; productHandle: string }[] = []
    for (const p of productsQuery.items) {
      const label = p.slug || p.title || p.id
      for (const v of p.skus || []) {
        if (!v?.id) continue
        out.push({ variantId: v.id, sku: v.sku, title: v.title, productHandle: label })
      }
    }
    return out
  }, [productsQuery.items])

  useEffect(() => {
    if (selectedPriceListId) return
    if (priceLists.length === 0) return
    setSelectedPriceListId(priceLists[0].id)
  }, [priceLists, selectedPriceListId])

  const {
    prices,
    isLoading: isLoadingPrices,
    error: pricesError,
    refresh: refreshPrices,
    createVariantPrice,
    updateVariantPrice,
    deleteVariantPrice,
  } = useVariantPrices({ token: accessToken, priceListId: selectedPriceListId, variantId: selectedVariantId })

  const [draft, setDraft] = useState(() => toDraft(selectedPriceListId || '', selectedVariantId || ''))

  useEffect(() => {
    setDraft(toDraft(selectedPriceListId || '', selectedVariantId || ''))
  }, [selectedPriceListId, selectedVariantId])

  const canAdd = Boolean(selectedPriceListId && selectedVariantId)

  const handleAdd = async () => {
    if (!selectedPriceListId || !selectedVariantId) return

    const unitPrice = asNumber(draft.unitPrice)
    if (unitPrice === null) return toast.error('Unit price is required')

    const compareAt = asNumber(draft.compareAtPrice)
    const minQty = asNumber(draft.minQuantity)
    if (minQty !== null && minQty < 1) return toast.error('Min qty must be >= 1')
    const maxQty = asNumber(draft.maxQuantity)

    try {
      const created = await createVariantPrice({
        variantId: selectedVariantId,
        priceListId: selectedPriceListId,
        unitPrice,
        compareAtPrice: compareAt ?? undefined,
        minQuantity: minQty ?? undefined,
        maxQuantity: maxQty ?? undefined,
        validFrom: draft.validFrom.trim() || undefined,
        validTo: draft.validTo.trim() || undefined,
      } as Omit<ProductVariantPrice, 'id'>)

      if (!created) return toast.error('Failed to add price')
      toast.success('Price added')
      setDraft(toDraft(selectedPriceListId, selectedVariantId))
    } catch (e: any) {
      toast.error('Add failed', { description: e?.message || 'Please try again.' })
    }
  }

  const handleRowSave = async (row: ProductVariantPrice, patch: Partial<ProductVariantPrice>) => {
    try {
      const updated = await updateVariantPrice(row.id, patch)
      if (!updated) return toast.error('Save failed')
      toast.success('Saved')
    } catch (e: any) {
      toast.error('Save failed', { description: e?.message || 'Please try again.' })
    }
  }

  const handleRowDelete = async (row: ProductVariantPrice) => {
    const ok = window.confirm('Delete this price tier?')
    if (!ok) return
    try {
      await deleteVariantPrice(row.id)
      toast.success('Deleted')
    } catch (e: any) {
      toast.error('Delete failed', { description: e?.message || 'Please try again.' })
    }
  }

  return (
    <AdminLayout title="Variant Prices" description="Manage tiered pricing per variant and price list.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => refreshLists()} disabled={isLoadingLists}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh lists
            </Button>
            <Button variant="outline" onClick={() => refreshPrices()} disabled={isLoadingPrices || !canAdd}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh prices
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle>Selection</CardTitle>
              <CardDescription>
                {listsError ? listsError : 'Pick a price list and variant to edit tiers.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Price list</label>
                <Select value={selectedPriceListId || ''} onValueChange={(v) => setSelectedPriceListId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select price list" />
                  </SelectTrigger>
                  <SelectContent>
                    {priceLists.map((pl) => (
                      <SelectItem key={pl.id} value={pl.id}>
                        {pl.name} ({pl.currencyCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Find variant</label>
                <Input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Search products to find variants…" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Variants</label>
                <Command className="rounded-md border">
                  <CommandInput placeholder="Filter variants…" />
                  <CommandList>
                    <ScrollArea className="h-[320px]">
                      {variants.length === 0 ? (
                        <CommandEmpty>No variants found.</CommandEmpty>
                      ) : null}
                      {variants.map((v) => {
                        const isSelected = v.variantId === selectedVariantId
                        return (
                          <CommandItem
                            key={v.variantId}
                            value={`${v.sku} ${v.productHandle} ${v.title || ''}`}
                            onSelect={() => setSelectedVariantId(v.variantId)}
                            className={cn('flex items-start justify-between gap-3', isSelected ? 'bg-accent text-accent-foreground' : undefined)}
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">{v.sku}</div>
                              <div className="text-xs text-muted-foreground truncate">{v.productHandle}{v.title ? ` • ${v.title}` : ''}</div>
                            </div>
                            {isSelected ? <Badge variant="outline">selected</Badge> : null}
                          </CommandItem>
                        )
                      })}
                    </ScrollArea>
                  </CommandList>
                </Command>
                {productsQuery.error ? <p className="text-xs text-destructive">{productsQuery.error}</p> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Tiers</CardTitle>
              <CardDescription>
                {pricesError ? pricesError : !canAdd ? 'Select a price list and a variant.' : `Loaded ${prices.length} tier(s).`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Add tier</div>
                  <Button size="sm" onClick={handleAdd} disabled={!canAdd}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Unit price</label>
                    <Input value={draft.unitPrice} onChange={(e) => setDraft((p) => ({ ...p, unitPrice: e.target.value }))} placeholder="1000" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Compare-at</label>
                    <Input value={draft.compareAtPrice} onChange={(e) => setDraft((p) => ({ ...p, compareAtPrice: e.target.value }))} placeholder="" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Min qty</label>
                    <Input value={draft.minQuantity} onChange={(e) => setDraft((p) => ({ ...p, minQuantity: e.target.value }))} placeholder="1" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Max qty</label>
                    <Input value={draft.maxQuantity} onChange={(e) => setDraft((p) => ({ ...p, maxQuantity: e.target.value }))} placeholder="" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Valid from</label>
                    <Input value={draft.validFrom} onChange={(e) => setDraft((p) => ({ ...p, validFrom: e.target.value }))} placeholder="2026-01-01T00:00:00Z" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Valid to</label>
                    <Input value={draft.validTo} onChange={(e) => setDraft((p) => ({ ...p, validTo: e.target.value }))} placeholder="" />
                  </div>
                </div>
              </div>

              <Separator />

              {prices.length === 0 ? (
                <div className="text-sm text-muted-foreground">No prices yet.</div>
              ) : (
                <div className="space-y-2">
                  {prices
                    .slice()
                    .sort((a, b) => (b.minQuantity ?? 1) - (a.minQuantity ?? 1))
                    .map((row) => (
                      <VariantPriceRow key={row.id} row={row} onSave={handleRowSave} onDelete={handleRowDelete} />
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

function VariantPriceRow(props: {
  row: ProductVariantPrice
  onSave: (row: ProductVariantPrice, patch: Partial<ProductVariantPrice>) => void
  onDelete: (row: ProductVariantPrice) => void
}) {
  const { row } = props
  const [draft, setDraft] = useState(() => ({
    unitPrice: String(row.unitPrice),
    compareAtPrice: row.compareAtPrice === null || row.compareAtPrice === undefined ? '' : String(row.compareAtPrice),
    minQuantity: row.minQuantity === null || row.minQuantity === undefined ? '' : String(row.minQuantity),
    maxQuantity: row.maxQuantity === null || row.maxQuantity === undefined ? '' : String(row.maxQuantity),
    validFrom: row.validFrom ?? '',
    validTo: row.validTo ?? '',
  }))

  useEffect(() => {
    setDraft({
      unitPrice: String(row.unitPrice),
      compareAtPrice: row.compareAtPrice === null || row.compareAtPrice === undefined ? '' : String(row.compareAtPrice),
      minQuantity: row.minQuantity === null || row.minQuantity === undefined ? '' : String(row.minQuantity),
      maxQuantity: row.maxQuantity === null || row.maxQuantity === undefined ? '' : String(row.maxQuantity),
      validFrom: row.validFrom ?? '',
      validTo: row.validTo ?? '',
    })
  }, [row])

  const patch = useMemo(() => {
    const next: Partial<ProductVariantPrice> = {}
    const unitPrice = asNumber(draft.unitPrice)
    if (unitPrice !== null && unitPrice !== row.unitPrice) next.unitPrice = unitPrice

    const compareAt = asNumber(draft.compareAtPrice)
    const compareAtNorm = compareAt === null ? undefined : compareAt
    const rowCompareAtNorm = row.compareAtPrice === null || row.compareAtPrice === undefined ? undefined : row.compareAtPrice
    if (compareAtNorm !== rowCompareAtNorm) next.compareAtPrice = compareAtNorm as any

    const minQty = asNumber(draft.minQuantity)
    const minNorm = minQty === null ? undefined : minQty
    const rowMinNorm = row.minQuantity === null || row.minQuantity === undefined ? undefined : row.minQuantity
    if (minNorm !== rowMinNorm) next.minQuantity = minNorm as any

    const maxQty = asNumber(draft.maxQuantity)
    const maxNorm = maxQty === null ? undefined : maxQty
    const rowMaxNorm = row.maxQuantity === null || row.maxQuantity === undefined ? undefined : row.maxQuantity
    if (maxNorm !== rowMaxNorm) next.maxQuantity = maxNorm as any

    const vf = draft.validFrom.trim() || undefined
    const vt = draft.validTo.trim() || undefined
    const rowVf = row.validFrom ?? undefined
    const rowVt = row.validTo ?? undefined
    if (vf !== rowVf) next.validFrom = vf
    if (vt !== rowVt) next.validTo = vt

    return next
  }, [draft, row])

  const isDirty = Object.keys(patch).length > 0

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Tier</div>
        <div className="flex items-center gap-2">
          {isDirty ? <Badge variant="secondary">Unsaved</Badge> : null}
          <Button size="sm" onClick={() => props.onSave(row, patch)} disabled={!isDirty}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => props.onDelete(row)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Unit price</label>
          <Input value={draft.unitPrice} onChange={(e) => setDraft((p) => ({ ...p, unitPrice: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Compare-at</label>
          <Input value={draft.compareAtPrice} onChange={(e) => setDraft((p) => ({ ...p, compareAtPrice: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Min qty</label>
          <Input value={draft.minQuantity} onChange={(e) => setDraft((p) => ({ ...p, minQuantity: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Max qty</label>
          <Input value={draft.maxQuantity} onChange={(e) => setDraft((p) => ({ ...p, maxQuantity: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Valid from</label>
          <Input value={draft.validFrom} onChange={(e) => setDraft((p) => ({ ...p, validFrom: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Valid to</label>
          <Input value={draft.validTo} onChange={(e) => setDraft((p) => ({ ...p, validTo: e.target.value }))} />
        </div>
      </div>
    </div>
  )
}
