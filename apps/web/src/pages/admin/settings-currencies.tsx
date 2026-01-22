import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { Plus, RefreshCcw, Save, Trash2, CornerDownRight } from 'lucide-react'
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
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCurrencies } from '@/hooks/use-currencies'
import { cn } from '@/lib/utils'

type Draft = {
  code: string
  name: string
  symbol: string
  decimals: string
  isActive: boolean
}

export function AdminSettingsCurrenciesPage() {
  const { accessToken } = useAdminAuth()
  const { currencies, isLoading, error, refresh, createCurrency, updateCurrency, deleteCurrency } = useCurrencies({ token: accessToken })

  const [query, setQuery] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [draftCode, setDraftCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [decimals, setDecimals] = useState('2')
  const [isActive, setIsActive] = useState(true)

  const [initialDraft, setInitialDraft] = useState<Draft>({
    code: '',
    name: '',
    symbol: '',
    decimals: '2',
    isActive: true,
  })

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const beginCreate = () => {
    setDraftCode(null)
    setCode('')
    setName('')
    setSymbol('')
    setDecimals('2')
    setIsActive(true)
    setInitialDraft({ code: '', name: '', symbol: '', decimals: '2', isActive: true })
  }

  const beginEdit = (currencyCode: string) => {
    const c = currencies.find((x) => x.code === currencyCode)
    if (!c) return

    setDraftCode(c.code)
    setCode(c.code)
    setName(c.name || '')
    setSymbol(c.symbol || '')
    setDecimals(typeof c.decimals === 'number' ? String(c.decimals) : '2')
    setIsActive(typeof c.isActive === 'boolean' ? c.isActive : true)
    setInitialDraft({
      code: c.code,
      name: c.name || '',
      symbol: c.symbol || '',
      decimals: typeof c.decimals === 'number' ? String(c.decimals) : '2',
      isActive: typeof c.isActive === 'boolean' ? c.isActive : true,
    })
  }

  const normalizedCode = code.trim().toUpperCase()

  const codeConflict = useMemo(() => {
    if (!normalizedCode) return null
    const other = currencies.find((c) => c.code.toUpperCase() === normalizedCode)
    if (!other) return null
    if (draftCode && other.code === draftCode) return null
    return other
  }, [currencies, draftCode, normalizedCode])

  const decimalsNumber = useMemo(() => {
    const raw = decimals.trim()
    if (!raw) return undefined
    const n = Number(raw)
    if (!Number.isFinite(n)) return undefined
    return Math.max(0, Math.floor(n))
  }, [decimals])

  const canSave = useMemo(() => {
    if (!normalizedCode) return false
    if (codeConflict) return false
    if (decimals.trim() && decimalsNumber === undefined) return false
    return true
  }, [codeConflict, decimals, decimalsNumber, normalizedCode])

  const isDirty = useMemo(() => {
    return (
      initialDraft.code !== code ||
      initialDraft.name !== name ||
      initialDraft.symbol !== symbol ||
      initialDraft.decimals !== decimals ||
      initialDraft.isActive !== isActive
    )
  }, [code, decimals, initialDraft, isActive, name, symbol])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...currencies].sort((a, b) => a.code.localeCompare(b.code))
    if (!q) return sorted
    return sorted.filter((c) => `${c.code} ${c.name || ''} ${c.symbol || ''}`.toLowerCase().includes(q))
  }, [currencies, query])

  const handleSave = async () => {
    if (!canSave) {
      if (codeConflict) toast.error('Code must be unique', { description: `“${codeConflict.code}” already exists.` })
      else if (decimals.trim() && decimalsNumber === undefined) toast.error('Decimals must be a number')
      else toast.error('Currency code is required')
      return
    }

    setIsSaving(true)
    try {
      const payload: any = {
        code: normalizedCode,
      }
      if (name.trim()) payload.name = name.trim()
      if (symbol.trim()) payload.symbol = symbol.trim()
      if (decimals.trim()) payload.decimals = decimalsNumber
      payload.isActive = isActive

      if (draftCode) {
        // Keep code immutable while editing to avoid backend surprises.
        const patch = { ...payload }
        delete patch.code
        await updateCurrency(draftCode, patch)
        toast.success('Currency updated')
      } else {
        await createCurrency(payload)
        toast.success('Currency created')
      }
      beginCreate()
    } catch (e: any) {
      toast.error('Failed to save currency', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!draftCode) return
    setIsDeleting(true)
    try {
      await deleteCurrency(draftCode)
      toast.success('Currency deleted')
      beginCreate()
    } catch (e: any) {
      toast.error('Failed to delete currency', { description: e?.message || 'Please try again.' })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  return (
    <AdminLayout
      title="Settings · Currencies"
      description="Manage currencies used by price lists, checkout, and country configs."
      actions={
        <Link href="/axis/settings">
          <Button variant="outline" size="sm">
            <CornerDownRight className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Create currencies and keep names/symbols consistent across the system.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={beginCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New currency
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Currencies</CardTitle>
                <Badge variant="secondary">{currencies.length}</Badge>
              </div>
              <CardDescription>{error ? error : 'Search and select a currency to edit.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Command className="rounded-md border">
                <CommandInput placeholder="Search by code, name, symbol…" value={query} onValueChange={setQuery} />
                <CommandList>
                  <ScrollArea className="h-[360px]">
                    {visible.length === 0 && !isLoading ? <CommandEmpty>No currencies found.</CommandEmpty> : null}
                    {visible.map((c) => {
                      const isSelected = c.code === draftCode
                      return (
                        <CommandItem
                          key={c.code}
                          value={`${c.code} ${c.name || ''} ${c.symbol || ''}`}
                          onSelect={() => beginEdit(c.code)}
                          className={cn('flex items-start justify-between gap-3', isSelected ? 'bg-accent text-accent-foreground' : undefined)}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{c.code}</div>
                            <div className="text-xs text-muted-foreground truncate">{c.name || '—'}</div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-1">
                            {c.symbol ? <Badge variant="outline">{c.symbol}</Badge> : null}
                            {typeof c.decimals === 'number' ? <Badge variant="outline">{c.decimals} dp</Badge> : null}
                            {c.isActive === false ? <Badge variant="secondary">off</Badge> : <Badge variant="outline">on</Badge>}
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
                    {draftCode ? 'Edit currency' : 'Create currency'}
                    {isDirty ? <Badge variant="secondary">Unsaved changes</Badge> : null}
                  </CardTitle>
                  <CardDescription>Code is required. Use ISO 4217 where possible.</CardDescription>
                </div>
                {draftCode ? <Badge variant="outline">Code: {draftCode}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code (required)</label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="USD"
                    disabled={Boolean(draftCode)}
                  />
                  {draftCode ? <p className="text-xs text-muted-foreground">Code cannot be changed after creation.</p> : null}
                  {codeConflict ? <p className="text-xs text-destructive">Code already exists.</p> : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="US Dollar" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Symbol</label>
                  <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="$" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Decimals</label>
                  <Input value={decimals} onChange={(e) => setDecimals(e.target.value)} placeholder="2" inputMode="numeric" />
                  {decimals.trim() && decimalsNumber === undefined ? (
                    <p className="text-xs text-destructive">Decimals must be a number.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Minor unit digits (e.g. 2 for cents).</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">Controls whether the currency should be selectable in admin flows.</div>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {draftCode ? (
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
                  <Button onClick={handleSave} disabled={!canSave || isSaving || isDeleting}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete currency?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. If this currency is referenced by price lists or orders, the API may reject the delete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}
