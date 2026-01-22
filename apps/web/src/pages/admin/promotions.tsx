import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCcw, Save, Tag, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { createApiClient, createResource } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import { cn } from '@/lib/utils'

type Promotion = {
  id: string
  code?: string | null
  name: string
  description?: string | null
  type?: string | null
  value?: number | null
  currencyCode?: string | null
  isActive?: boolean | null
  startsAt?: string | null
  endsAt?: string | null
  usageLimit?: number | null
  usageCount?: number | null
  perCustomerLimit?: number | null
  minSubtotal?: number | null
  conditions?: unknown
  metadata?: unknown
  createdAt?: string
  updatedAt?: string
}

type PromotionStatusFilter = 'all' | 'active' | 'scheduled' | 'expired' | 'disabled'

type PromotionType = 'PERCENT' | 'FIXED' | 'FREE_SHIPPING'

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function safeStringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

function parseJsonText(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: true, value: {} }
  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Must be a JSON object.' }
    }
    return { ok: true, value: parsed }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Invalid JSON.' }
  }
}

function normalizePromotion(raw: any): Promotion {
  const id = String(raw?.id ?? raw?._id ?? raw?.promotionId ?? '')
  return {
    id,
    code: raw?.code ?? raw?.promoCode ?? null,
    name: String(raw?.name ?? raw?.title ?? raw?.code ?? 'Untitled'),
    description: raw?.description ?? null,
    type: raw?.type ?? raw?.discountType ?? null,
    value: typeof raw?.value === 'number' ? raw.value : typeof raw?.discount === 'number' ? raw.discount : null,
    currencyCode: raw?.currencyCode ?? raw?.currency ?? null,
    isActive: typeof raw?.isActive === 'boolean' ? raw.isActive : typeof raw?.active === 'boolean' ? raw.active : null,
    startsAt: raw?.startsAt ?? raw?.startAt ?? raw?.startDate ?? null,
    endsAt: raw?.endsAt ?? raw?.endAt ?? raw?.endDate ?? null,
    usageLimit: typeof raw?.usageLimit === 'number' ? raw.usageLimit : null,
    usageCount: typeof raw?.usageCount === 'number' ? raw.usageCount : null,
    perCustomerLimit: typeof raw?.perCustomerLimit === 'number' ? raw.perCustomerLimit : null,
    minSubtotal: typeof raw?.minSubtotal === 'number' ? raw.minSubtotal : null,
    conditions: raw?.conditions ?? raw?.rules ?? null,
    metadata: raw?.metadata ?? null,
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  }
}

function toDateTimeLocalValue(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const min = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function fromDateTimeLocalValue(v: string): string | null {
  const trimmed = v.trim()
  if (!trimmed) return null
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function promotionStatus(p: Promotion): PromotionStatusFilter {
  const now = Date.now()
  const starts = p.startsAt ? new Date(p.startsAt).getTime() : null
  const ends = p.endsAt ? new Date(p.endsAt).getTime() : null

  if (!p.isActive) return 'disabled'
  if (starts && starts > now) return 'scheduled'
  if (ends && ends < now) return 'expired'
  return 'active'
}

function typeLabel(type?: string | null): string {
  const t = (type || '').toUpperCase()
  if (t === 'PERCENT' || t === 'PERCENTAGE') return 'Percent'
  if (t === 'FIXED' || t === 'AMOUNT') return 'Fixed'
  if (t === 'FREE_SHIPPING') return 'Free shipping'
  return type ? String(type) : '—'
}

function formatValue(p: Promotion): string {
  const t = (p.type || '').toUpperCase()
  if (t === 'FREE_SHIPPING') return 'Free shipping'
  if (typeof p.value !== 'number') return '—'
  if (t === 'PERCENT' || t === 'PERCENTAGE') return `${p.value}%`
  if (t === 'FIXED' || t === 'AMOUNT') return `${p.currencyCode || ''} ${p.value}`.trim()
  return String(p.value)
}

export function AdminPromotionsPage() {
  const { accessToken } = useAdminAuth()
  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])
  const promotionsResource = useMemo(() => createResource(api, endpoints.promotions.base), [api])

  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PromotionStatusFilter>('all')

  const [draftId, setDraftId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [type, setType] = useState<PromotionType>('PERCENT')
  const [valueText, setValueText] = useState('')
  const [currencyCode, setCurrencyCode] = useState('KES')
  const [startsAtLocal, setStartsAtLocal] = useState('')
  const [endsAtLocal, setEndsAtLocal] = useState('')

  const [usageLimitText, setUsageLimitText] = useState('')
  const [perCustomerLimitText, setPerCustomerLimitText] = useState('')
  const [minSubtotalText, setMinSubtotalText] = useState('')

  const [conditionsText, setConditionsText] = useState('{}')
  const [metadataText, setMetadataText] = useState('{}')
  const [conditionsError, setConditionsError] = useState<string | null>(null)
  const [metadataError, setMetadataError] = useState<string | null>(null)

  const [initialDraft, setInitialDraft] = useState({
    id: null as string | null,
    name: '',
    code: '',
    description: '',
    isActive: true,
    type: 'PERCENT' as PromotionType,
    valueText: '',
    currencyCode: 'KES',
    startsAtLocal: '',
    endsAtLocal: '',
    usageLimitText: '',
    perCustomerLimitText: '',
    minSubtotalText: '',
    conditionsText: '{}',
    metadataText: '{}',
  })

  const [activeTab, setActiveTab] = useState<'basics' | 'schedule' | 'limits' | 'advanced'>('basics')

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const isDirty = useMemo(() => {
    return (
      initialDraft.id !== draftId ||
      initialDraft.name !== name ||
      initialDraft.code !== code ||
      initialDraft.description !== description ||
      initialDraft.isActive !== isActive ||
      initialDraft.type !== type ||
      initialDraft.valueText !== valueText ||
      initialDraft.currencyCode !== currencyCode ||
      initialDraft.startsAtLocal !== startsAtLocal ||
      initialDraft.endsAtLocal !== endsAtLocal ||
      initialDraft.usageLimitText !== usageLimitText ||
      initialDraft.perCustomerLimitText !== perCustomerLimitText ||
      initialDraft.minSubtotalText !== minSubtotalText ||
      initialDraft.conditionsText !== conditionsText ||
      initialDraft.metadataText !== metadataText
    )
  }, [
    code,
    conditionsText,
    currencyCode,
    description,
    draftId,
    endsAtLocal,
    initialDraft,
    isActive,
    metadataText,
    minSubtotalText,
    name,
    perCustomerLimitText,
    startsAtLocal,
    type,
    usageLimitText,
    valueText,
  ])

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, scheduled: 0, expired: 0, disabled: 0 }
    for (const p of promotions) {
      c.all += 1
      c[promotionStatus(p)] += 1
    }
    return c
  }, [promotions])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return promotions
      .filter((p) => {
        const s = promotionStatus(p)
        if (statusFilter !== 'all' && s !== statusFilter) return false
        if (!term) return true
        const hay = `${p.name} ${p.code ?? ''} ${p.type ?? ''}`.toLowerCase()
        return hay.includes(term)
      })
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  }, [promotions, query, statusFilter])

  const resetDraft = (p?: Promotion | null) => {
    if (!p) {
      setDraftId(null)
      setName('')
      setCode('')
      setDescription('')
      setIsActive(true)
      setType('PERCENT')
      setValueText('')
      setCurrencyCode('KES')
      setStartsAtLocal('')
      setEndsAtLocal('')
      setUsageLimitText('')
      setPerCustomerLimitText('')
      setMinSubtotalText('')
      setConditionsText('{}')
      setMetadataText('{}')
      setConditionsError(null)
      setMetadataError(null)
      setActiveTab('basics')
      setInitialDraft({
        id: null,
        name: '',
        code: '',
        description: '',
        isActive: true,
        type: 'PERCENT',
        valueText: '',
        currencyCode: 'KES',
        startsAtLocal: '',
        endsAtLocal: '',
        usageLimitText: '',
        perCustomerLimitText: '',
        minSubtotalText: '',
        conditionsText: '{}',
        metadataText: '{}',
      })
      return
    }

    const nextType = ((p.type || 'PERCENT') as any).toUpperCase() as PromotionType

    setDraftId(p.id)
    setName(p.name || '')
    setCode((p.code || '') as string)
    setDescription((p.description || '') as string)
    setIsActive(Boolean(p.isActive ?? true))
    setType(nextType === 'PERCENTAGE' ? 'PERCENT' : nextType)
    setValueText(typeof p.value === 'number' ? String(p.value) : '')
    setCurrencyCode((p.currencyCode || 'KES') as string)
    setStartsAtLocal(toDateTimeLocalValue(p.startsAt))
    setEndsAtLocal(toDateTimeLocalValue(p.endsAt))
    setUsageLimitText(typeof p.usageLimit === 'number' ? String(p.usageLimit) : '')
    setPerCustomerLimitText(typeof p.perCustomerLimit === 'number' ? String(p.perCustomerLimit) : '')
    setMinSubtotalText(typeof p.minSubtotal === 'number' ? String(p.minSubtotal) : '')

    const conditionsObj = asObject(p.conditions)
    const metadataObj = asObject(p.metadata)

    const nextConditionsText = safeStringifyJson(conditionsObj)
    const nextMetadataText = safeStringifyJson(metadataObj)

    setConditionsText(nextConditionsText)
    setMetadataText(nextMetadataText)
    setConditionsError(null)
    setMetadataError(null)
    setActiveTab('basics')

    setInitialDraft({
      id: p.id,
      name: p.name || '',
      code: (p.code || '') as string,
      description: (p.description || '') as string,
      isActive: Boolean(p.isActive ?? true),
      type: (nextType === 'PERCENTAGE' ? 'PERCENT' : nextType) as PromotionType,
      valueText: typeof p.value === 'number' ? String(p.value) : '',
      currencyCode: (p.currencyCode || 'KES') as string,
      startsAtLocal: toDateTimeLocalValue(p.startsAt),
      endsAtLocal: toDateTimeLocalValue(p.endsAt),
      usageLimitText: typeof p.usageLimit === 'number' ? String(p.usageLimit) : '',
      perCustomerLimitText: typeof p.perCustomerLimit === 'number' ? String(p.perCustomerLimit) : '',
      minSubtotalText: typeof p.minSubtotal === 'number' ? String(p.minSubtotal) : '',
      conditionsText: nextConditionsText,
      metadataText: nextMetadataText,
    })
  }

  const refresh = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await promotionsResource.list<any>()
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
      const normalized = list.map(normalizePromotion).filter((p: Promotion) => p.id)
      setPromotions(normalized)

      if (draftId) {
        const match = normalized.find((p: Promotion) => p.id === draftId)
        if (match) resetDraft(match)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load promotions')
      setPromotions([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const validateJson = (): boolean => {
    const c = parseJsonText(conditionsText)
    const m = parseJsonText(metadataText)

    setConditionsError(c.ok ? null : c.error)
    setMetadataError(m.ok ? null : m.error)

    if (!c.ok) setActiveTab('advanced')
    if (!m.ok) setActiveTab('advanced')

    return c.ok && m.ok
  }

  const onNew = () => resetDraft(null)

  const onSelect = (id: string) => {
    const p = promotions.find((x) => x.id === id)
    if (p) resetDraft(p)
  }

  const onSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      setActiveTab('basics')
      return
    }

    if (!validateJson()) {
      toast.error('Fix JSON validation errors first')
      return
    }

    const parsedConditions = parseJsonText(conditionsText)
    const parsedMetadata = parseJsonText(metadataText)

    const value = valueText.trim() ? Number(valueText) : null
    if (type !== 'FREE_SHIPPING' && valueText.trim() && Number.isNaN(value)) {
      toast.error('Value must be a number')
      setActiveTab('basics')
      return
    }

    const usageLimit = usageLimitText.trim() ? Number(usageLimitText) : null
    const perCustomerLimit = perCustomerLimitText.trim() ? Number(perCustomerLimitText) : null
    const minSubtotal = minSubtotalText.trim() ? Number(minSubtotalText) : null

    if (usageLimitText.trim() && Number.isNaN(usageLimit)) {
      toast.error('Usage limit must be a number')
      setActiveTab('limits')
      return
    }
    if (perCustomerLimitText.trim() && Number.isNaN(perCustomerLimit)) {
      toast.error('Per-customer limit must be a number')
      setActiveTab('limits')
      return
    }
    if (minSubtotalText.trim() && Number.isNaN(minSubtotal)) {
      toast.error('Minimum subtotal must be a number')
      setActiveTab('limits')
      return
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
      isActive,
      type,
      value: type === 'FREE_SHIPPING' ? undefined : value ?? undefined,
      currencyCode: type === 'FIXED' ? currencyCode.trim() || undefined : undefined,
      startsAt: fromDateTimeLocalValue(startsAtLocal) || undefined,
      endsAt: fromDateTimeLocalValue(endsAtLocal) || undefined,
      usageLimit: usageLimit ?? undefined,
      perCustomerLimit: perCustomerLimit ?? undefined,
      minSubtotal: minSubtotal ?? undefined,
      conditions: parsedConditions.ok ? parsedConditions.value : undefined,
      metadata: parsedMetadata.ok ? parsedMetadata.value : undefined,
    }

    setIsSaving(true)
    try {
      if (draftId) {
        await promotionsResource.update(draftId, payload)
        toast.success('Promotion updated')
      } else {
        const created = await promotionsResource.create<any>(payload)
        const normalized = normalizePromotion(created)
        toast.success('Promotion created')
        if (normalized.id) setDraftId(normalized.id)
      }

      await refresh()
    } catch (e: any) {
      toast.error('Save failed', { description: e?.message || 'Request failed' })
    } finally {
      setIsSaving(false)
    }
  }

  const onDelete = async () => {
    if (!draftId) return
    setIsDeleting(true)
    try {
      await promotionsResource.remove(draftId)
      toast.success('Promotion deleted')
      resetDraft(null)
      await refresh()
    } catch (e: any) {
      toast.error('Delete failed', { description: e?.message || 'Request failed' })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const onToggleActive = async () => {
    if (!draftId) return
    setIsToggling(true)
    try {
      if (isActive) {
        await api.post(endpoints.promotions.deactivateById(draftId))
        toast.success('Promotion deactivated')
      } else {
        await api.post(endpoints.promotions.activateById(draftId))
        toast.success('Promotion activated')
      }
      await refresh()
    } catch (e: any) {
      toast.error('Action failed', { description: e?.message || 'Request failed' })
    } finally {
      setIsToggling(false)
    }
  }

  const selected = useMemo(() => (draftId ? promotions.find((p) => p.id === draftId) || null : null), [draftId, promotions])

  return (
    <AdminLayout
      title="Promotions"
      description="Create and manage promo codes, discounts, and scheduled offers."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={onNew}>
            <Plus className="h-4 w-4 mr-2" />
            New promotion
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>All promotions</CardTitle>
                <CardDescription>Search, filter, and select a promotion to edit.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{counts.all} total</Badge>
                <Badge variant="secondary">{counts.active} active</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? <div className="text-sm text-destructive">{error}</div> : null}

            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as PromotionStatusFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                <TabsTrigger value="expired">Expired</TabsTrigger>
                <TabsTrigger value="disabled">Disabled</TabsTrigger>
              </TabsList>

              <TabsContent value={statusFilter} className="mt-3">
                <Command>
                  <CommandInput
                    placeholder="Search by name, code, type..."
                    value={query}
                    onValueChange={setQuery}
                  />
                  <CommandList className="mt-2">
                    <CommandEmpty>No promotions found.</CommandEmpty>
                    <ScrollArea className="h-[520px] pr-2">
                      {filtered.map((p) => {
                        const status = promotionStatus(p)
                        const isSelected = p.id === draftId
                        const statusVariant =
                          status === 'active'
                            ? 'secondary'
                            : status === 'scheduled'
                              ? 'outline'
                              : status === 'expired'
                                ? 'outline'
                                : 'outline'

                        return (
                          <CommandItem
                            key={p.id}
                            value={`${p.name} ${p.code ?? ''}`}
                            onSelect={() => onSelect(p.id)}
                            className={cn('flex items-start gap-3 py-3', isSelected && 'bg-muted')}
                          >
                            <div className="mt-0.5">
                              <Tag className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{p.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {p.code ? `Code: ${p.code}` : 'No code'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="outline">{typeLabel(p.type)}</Badge>
                                  <Badge variant={statusVariant}>{status}</Badge>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                                <span>{formatValue(p)}</span>
                                {p.startsAt || p.endsAt ? (
                                  <span>
                                    {p.startsAt ? new Date(p.startsAt).toLocaleDateString() : '—'} →{' '}
                                    {p.endsAt ? new Date(p.endsAt).toLocaleDateString() : '—'}
                                  </span>
                                ) : null}
                                {typeof p.usageCount === 'number' || typeof p.usageLimit === 'number' ? (
                                  <span>
                                    Uses: {p.usageCount ?? 0}/{p.usageLimit ?? '∞'}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </CommandItem>
                        )
                      })}
                    </ScrollArea>
                  </CommandList>
                </Command>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{draftId ? 'Edit promotion' : 'Create promotion'}</CardTitle>
                <CardDescription>
                  {draftId ? 'Update rules and scheduling. Save to apply changes.' : 'Define a promo code or automatic discount.'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {draftId ? <Badge variant={isDirty ? 'secondary' : 'outline'}>{isDirty ? 'unsaved' : 'saved'}</Badge> : null}
                <Badge variant={isActive ? 'secondary' : 'outline'}>{isActive ? 'enabled' : 'disabled'}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {selected ? `ID: ${selected.id}` : 'New promotion'}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => resetDraft(selected)}
                  disabled={!selected || !isDirty}
                >
                  Reset changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onToggleActive}
                  disabled={!draftId || isToggling}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList>
                <TabsTrigger value="basics">Basics</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="limits">Limits</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="basics" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday Sale" />
                  </div>
                  <div className="space-y-2">
                    <Label>Code (optional)</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SAVE10" />
                    <div className="text-xs text-muted-foreground">Leave empty for automatic promotions (if supported).</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short note for internal use"
                    className="min-h-[90px]"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">Enabled</div>
                    <div className="text-xs text-muted-foreground">Controls whether this promotion can be applied.</div>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={type} onValueChange={(v) => setType(v as PromotionType)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENT">Percent</SelectItem>
                        <SelectItem value="FIXED">Fixed amount</SelectItem>
                        <SelectItem value="FREE_SHIPPING">Free shipping</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className={cn('space-y-2', type === 'FREE_SHIPPING' && 'opacity-50')}>
                    <Label>Value</Label>
                    <Input
                      value={valueText}
                      onChange={(e) => setValueText(e.target.value)}
                      placeholder={type === 'PERCENT' ? '10' : type === 'FIXED' ? '500' : '—'}
                      disabled={type === 'FREE_SHIPPING'}
                    />
                  </div>

                  <div className={cn('space-y-2', type !== 'FIXED' && 'opacity-50')}>
                    <Label>Currency</Label>
                    <Input
                      value={currencyCode}
                      onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                      placeholder="KES"
                      disabled={type !== 'FIXED'}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Starts at</Label>
                    <Input type="datetime-local" value={startsAtLocal} onChange={(e) => setStartsAtLocal(e.target.value)} />
                    <div className="text-xs text-muted-foreground">Leave empty to start immediately.</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ends at</Label>
                    <Input type="datetime-local" value={endsAtLocal} onChange={(e) => setEndsAtLocal(e.target.value)} />
                    <div className="text-xs text-muted-foreground">Leave empty for no end date.</div>
                  </div>
                </div>

                <div className="rounded-md border p-3 text-xs text-muted-foreground">
                  Tip: “Scheduled” promotions are enabled but start in the future.
                </div>
              </TabsContent>

              <TabsContent value="limits" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Usage limit</Label>
                    <Input value={usageLimitText} onChange={(e) => setUsageLimitText(e.target.value)} placeholder="100" />
                    <div className="text-xs text-muted-foreground">Total times this promo can be used.</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Per-customer limit</Label>
                    <Input value={perCustomerLimitText} onChange={(e) => setPerCustomerLimitText(e.target.value)} placeholder="1" />
                    <div className="text-xs text-muted-foreground">Max uses per customer (if supported).</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Min subtotal</Label>
                    <Input value={minSubtotalText} onChange={(e) => setMinSubtotalText(e.target.value)} placeholder="10000" />
                    <div className="text-xs text-muted-foreground">Only apply if cart subtotal meets threshold.</div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Conditions (JSON)</Label>
                  <Textarea
                    value={conditionsText}
                    onChange={(e) => setConditionsText(e.target.value)}
                    className={cn('min-h-[160px] font-mono text-xs', conditionsError && 'border-destructive')}
                    placeholder="{}"
                  />
                  {conditionsError ? <div className="text-xs text-destructive">{conditionsError}</div> : null}
                  <div className="text-xs text-muted-foreground">Use this for product/category targeting rules if your API supports it.</div>
                </div>

                <div className="space-y-2">
                  <Label>Metadata (JSON)</Label>
                  <Textarea
                    value={metadataText}
                    onChange={(e) => setMetadataText(e.target.value)}
                    className={cn('min-h-[140px] font-mono text-xs', metadataError && 'border-destructive')}
                    placeholder="{}"
                  />
                  {metadataError ? <div className="text-xs text-destructive">{metadataError}</div> : null}
                </div>
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Button onClick={onSave} disabled={isSaving || !isDirty}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={!draftId}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete promotion?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. The promotion will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} disabled={isDeleting}>
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
