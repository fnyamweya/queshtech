import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { usePriceLists } from '@/hooks/use-pricing'
import { cn } from '@/lib/utils'
import type { PriceList } from '@/types/catalog'
import { toast } from 'sonner'
import { Plus, RefreshCcw, Save, Trash2 } from 'lucide-react'

function safeJsonParse(text: string): any | null {
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function toEditor(pl?: PriceList | null) {
  return {
    id: pl?.id ?? null,
    code: pl?.code ?? '',
    name: pl?.name ?? '',
    currencyCode: pl?.currencyCode ?? 'USD',
    isActive: pl?.isActive ?? true,
    validFrom: pl?.validFrom ?? '',
    validTo: pl?.validTo ?? '',
    metaJsonText: pl?.metaJson ? JSON.stringify(pl.metaJson, null, 2) : '{\n  "priority": 0\n}',
  }
}

export function AdminPriceListsPage() {
  const { accessToken } = useAdminAuth()
  const { priceLists, isLoading, error, refresh, createPriceList, updatePriceList, deletePriceList } = usePriceLists({
    token: accessToken,
  })

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const byId = useMemo(() => {
    const map = new Map<string, PriceList>()
    for (const pl of priceLists) map.set(pl.id, pl)
    return map
  }, [priceLists])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...priceLists].sort((a, b) => a.code.localeCompare(b.code))
    if (!q) return sorted
    return sorted.filter((pl) => `${pl.code} ${pl.name} ${pl.currencyCode}`.toLowerCase().includes(q))
  }, [priceLists, query])

  useEffect(() => {
    if (selectedId) return
    if (visible.length === 0) return
    setSelectedId(visible[0].id)
  }, [selectedId, visible])

  const selected = useMemo(() => (selectedId ? byId.get(selectedId) || null : null), [byId, selectedId])

  const [editor, setEditor] = useState(() => toEditor(selected))
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setEditor(toEditor(selected))
    setIsDirty(false)
  }, [selectedId])

  const handleNew = () => {
    setSelectedId(null)
    setEditor(toEditor(null))
    setIsDirty(true)
  }

  const handleSave = async () => {
    const code = editor.code.trim()
    const name = editor.name.trim()
    const currencyCode = editor.currencyCode.trim().toUpperCase()
    if (!code) return toast.error('Code is required')
    if (!name) return toast.error('Name is required')
    if (!currencyCode) return toast.error('Currency is required')

    const metaJson = safeJsonParse(editor.metaJsonText)
    if (!metaJson) return toast.error('Meta JSON is invalid')

    const payload: Omit<PriceList, 'id'> = {
      code,
      name,
      currencyCode,
      isActive: editor.isActive,
      validFrom: editor.validFrom.trim() || undefined,
      validTo: editor.validTo.trim() || undefined,
      metaJson,
    }

    try {
      if (!editor.id) {
        const created = await createPriceList(payload)
        if (!created) return toast.error('Failed to create price list')
        toast.success('Price list created')
        setSelectedId(created.id)
      } else {
        const updated = await updatePriceList(editor.id, payload)
        if (!updated) return toast.error('Failed to save')
        toast.success('Price list saved')
      }
      setIsDirty(false)
    } catch (e: any) {
      toast.error('Save failed', { description: e?.message || 'Please try again.' })
    }
  }

  const handleDelete = async () => {
    if (!editor.id) return
    const ok = window.confirm('Delete this price list?')
    if (!ok) return
    try {
      await deletePriceList(editor.id)
      toast.success('Deleted')
      setSelectedId(null)
      setEditor(toEditor(null))
      setIsDirty(false)
    } catch (e: any) {
      toast.error('Delete failed', { description: e?.message || 'Please try again.' })
    }
  }

  return (
    <AdminLayout title="Price Lists" description="Define pricing contexts (currency, priority, validity) without storing price on Products.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {isDirty ? <Badge variant="secondary">Unsaved</Badge> : null}
            <Button onClick={handleSave} disabled={!isDirty}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button variant="outline" onClick={handleDelete} disabled={!editor.id}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Lists</CardTitle>
                <Badge variant="secondary">{priceLists.length}</Badge>
              </div>
              <CardDescription>{error ? error : 'Search and select a price list.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Command className="rounded-md border">
                <CommandInput placeholder="Search by code, name, currency…" value={query} onValueChange={setQuery} />
                <CommandList>
                  <ScrollArea className="h-[360px]">
                    {visible.length === 0 ? (
                      <CommandEmpty>No price lists found.</CommandEmpty>
                    ) : null}
                    {visible.map((pl) => {
                      const isSelected = pl.id === selectedId
                      return (
                        <CommandItem
                          key={pl.id}
                          value={`${pl.code} ${pl.name} ${pl.currencyCode}`}
                          onSelect={() => setSelectedId(pl.id)}
                          className={cn('flex items-start justify-between gap-3', isSelected ? 'bg-accent text-accent-foreground' : undefined)}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{pl.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{pl.code} • {pl.currencyCode}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {pl.isActive ? <Badge variant="outline">active</Badge> : <Badge variant="secondary">off</Badge>}
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
              <CardTitle>Editor</CardTitle>
              <CardDescription>{editor.id ? `ID: ${editor.id}` : 'Create a new price list.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code</label>
                  <Input value={editor.code} onChange={(e) => { setEditor((p) => ({ ...p, code: e.target.value })); setIsDirty(true) }} placeholder="e.g. retail-usd" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Currency</label>
                  <Input value={editor.currencyCode} onChange={(e) => { setEditor((p) => ({ ...p, currencyCode: e.target.value })); setIsDirty(true) }} placeholder="USD" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={editor.name} onChange={(e) => { setEditor((p) => ({ ...p, name: e.target.value })); setIsDirty(true) }} placeholder="Retail (USD)" />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">Inactive lists are ignored by resolution.</div>
                </div>
                <Switch checked={editor.isActive} onCheckedChange={(v) => { setEditor((p) => ({ ...p, isActive: v })); setIsDirty(true) }} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valid from (ISO)</label>
                  <Input value={editor.validFrom} onChange={(e) => { setEditor((p) => ({ ...p, validFrom: e.target.value })); setIsDirty(true) }} placeholder="2026-01-01T00:00:00Z" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valid to (ISO)</label>
                  <Input value={editor.validTo} onChange={(e) => { setEditor((p) => ({ ...p, validTo: e.target.value })); setIsDirty(true) }} placeholder="2026-12-31T23:59:59Z" />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">Meta JSON</label>
                <p className="text-xs text-muted-foreground">Use `priority` to influence resolution (higher wins).</p>
                <Textarea
                  value={editor.metaJsonText}
                  onChange={(e) => { setEditor((p) => ({ ...p, metaJsonText: e.target.value })); setIsDirty(true) }}
                  className="font-mono text-xs min-h-[220px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
