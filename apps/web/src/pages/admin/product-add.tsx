import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { CornerDownRight, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogBrands } from '@/hooks/use-catalog-brands'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { useChannels } from '@/hooks/use-channels'
import { useLocations } from '@/hooks/use-locations'
import { usePriceLists } from '@/hooks/use-pricing'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import { CommonUpload, type CommonUploadHandle } from '@/components/common/common-upload'

function parseJsonObject(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
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

function normalizeCreateResponse(raw: any): { id?: string } {
  const id = raw?.id ?? raw?._id ?? raw?.productId
  return { id: id ? String(id) : undefined }
}

function stripVariantIds(payload: any) {
  if (!payload || typeof payload !== 'object') return payload
  if (!('variants' in payload)) return payload
  return {
    ...(payload as any),
    variants: ((payload as any)?.variants || []).map((v: any) => {
      const { id: _id, ...rest } = v || {}
      return rest
    }),
  }
}

function uniq(list: string[]): string[] {
  return Array.from(new Set(list))
}

function toDateTimeLocalValue(iso: string): string {
  const trimmed = iso.trim()
  if (!trimmed) return ''
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const min = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function fromDateTimeLocalValue(local: string): string {
  const trimmed = local.trim()
  if (!trimmed) return ''
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

function intOrU(text: string): number | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const value = Number.parseInt(trimmed, 10)
  return Number.isFinite(value) ? value : undefined
}

function numOrU(text: string): number | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : undefined
}

type OptionDefinitionDraft = {
  key: string
  label: string
  allowedValues: string[]
  required: boolean
}

type AvailabilityDraft = {
  channels: string[]
  countries: string[]
  locations: string[]
  stockType: 'FINITE' | 'INFINITE'
  stockQuantity: string
  startAt: string
  endAt: string
  timezone: string
}

type TranslationDraft = {
  locale: string
  title: string
  description: string
}

function TagInput(props: {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  helperText?: string
  disabled?: boolean
}) {
  const [next, setNext] = useState('')

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    props.onChange(uniq([...props.values, trimmed]))
    setNext('')
  }

  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          value={next}
          onChange={(e) => setNext(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commit(next)
            }
          }}
          placeholder={props.placeholder}
          disabled={props.disabled}
        />
        <Button type="button" variant="secondary" onClick={() => commit(next)} disabled={props.disabled}>
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>
      {props.values.length ? (
        <div className="flex flex-wrap gap-2">
          {props.values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button
                type="button"
                className="ml-1 rounded-sm hover:bg-muted"
                onClick={() => props.onChange(props.values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                disabled={props.disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : props.helperText ? (
        <div className="text-xs text-muted-foreground">{props.helperText}</div>
      ) : (
        <div className="text-xs text-muted-foreground">Press Enter or use Add to include multiple values.</div>
      )}
    </div>
  )
}

function MultiSelectAdd(props: {
  label: string
  placeholder?: string
  helperText?: string
  disabled?: boolean
  options: Array<{ value: string; label: string; disabled?: boolean }>
  values: string[]
  onChange: (next: string[]) => void
  onAdd?: (value: string) => void
}) {
  const [nextValue, setNextValue] = useState('')

  const add = (value: string) => {
    const v = value.trim()
    if (!v) return
    if (props.values.includes(v)) return
    props.onChange([...props.values, v])
  }

  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Select
        value={nextValue}
        onValueChange={(v) => {
          setNextValue('')
          if (props.onAdd) props.onAdd(v)
          else add(v)
        }}
        disabled={props.disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={props.placeholder || 'Select'} />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={Boolean(o.disabled)}>
              <span className="whitespace-pre">{o.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {props.values.length ? (
        <div className="flex flex-wrap gap-2">
          {props.values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button
                type="button"
                className="ml-1 rounded-sm hover:bg-muted"
                onClick={() => props.onChange(props.values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                disabled={props.disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : props.helperText ? (
        <div className="text-xs text-muted-foreground">{props.helperText}</div>
      ) : null}
    </div>
  )
}

type PriceDraft = {
  priceListId: string
  unitPrice: string
  compareAtPrice: string
  minQuantity: string
  maxQuantity: string
  validFrom: string
  validTo: string
}

type InventoryLocationDraft = {
  code: string
  onHand: string
  reserved: string
}

type SkuDraft = {
  title: string
  sku: string
  externalRef: string
  status: 'draft' | 'active' | 'archived'
  isDefault: boolean
  position: string
  options: Record<string, string>
  availabilityText: string
  inventoryLocations: InventoryLocationDraft[]
  images: string[]
  requiresShipping: boolean
  weight: string
  length: string
  width: string
  height: string
  dimensionUnit: 'cm' | 'in'
  weightUnit: 'kg' | 'lb'
  prices: PriceDraft[]
}

type CreateV1Draft = {
  title: string
  description: string
  slug: string
  seoTitle: string
  seoDescription: string
  status: 'draft' | 'active' | 'archived'
  externalRef: string
  brandId: string
  categoryIds: string[]
  optionDefinitions: OptionDefinitionDraft[]
  availability: AvailabilityDraft
  images: string[]
  translations: TranslationDraft[]
  skus: SkuDraft[]
  prices: PriceDraft[]
}

const blankPrice = (): PriceDraft => ({
  priceListId: '',
  unitPrice: '',
  compareAtPrice: '',
  minQuantity: '',
  maxQuantity: '',
  validFrom: '',
  validTo: '',
})

const blankSku = (): SkuDraft => ({
  title: '',
  sku: '',
  externalRef: '',
  status: 'active',
  isDefault: true,
  position: '1',
  options: {},
  availabilityText: '{\n\n}',
  inventoryLocations: [{ code: '', onHand: '', reserved: '' }],
  images: [],
  requiresShipping: true,
  weight: '',
  length: '',
  width: '',
  height: '',
  dimensionUnit: 'cm',
  weightUnit: 'kg',
  prices: [],
})

const blankDraft = (): CreateV1Draft => ({
  title: '',
  description: '',
  slug: '',
  seoTitle: '',
  seoDescription: '',
  status: 'draft',
  externalRef: '',
  brandId: '',
  categoryIds: [],
  optionDefinitions: [],
  availability: {
    channels: [],
    countries: [],
    locations: [],
    stockType: 'FINITE',
    stockQuantity: '',
    startAt: '',
    endAt: '',
    timezone: 'UTC',
  },
  images: [],
  translations: [{ locale: 'en', title: '', description: '' }],
  skus: [blankSku()],
  prices: [],
})

function CreateV1Form(props: {
  brands: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  token?: string | null
  disabled?: boolean
  onCreate: (payload: any) => Promise<void>
}) {
  const [tab, setTab] = useState<'basics' | 'availability' | 'options' | 'media' | 'translations' | 'skus' | 'pricing'>('basics')
  const [draft, setDraft] = useState<CreateV1Draft>(() => blankDraft())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const uploadRef = useRef<CommonUploadHandle | null>(null)
  const [pendingMediaCount, setPendingMediaCount] = useState(0)

  const { channels } = useChannels({ token: props.token })
  const { locations } = useLocations({ token: props.token })
  const { priceLists } = usePriceLists({ token: props.token })

  const locationOptions = useMemo(() => {
    type Loc = (typeof locations)[number]

    const byId = new Map<string, Loc>()
    const childrenByParent = new Map<string, Loc[]>()
    for (const l of locations) {
      byId.set(l.id, l)
    }

    const roots: Loc[] = []
    for (const l of locations) {
      const parentId = (l as any).parentId ? String((l as any).parentId) : ''
      const hasParent = parentId && byId.has(parentId)
      if (!hasParent) roots.push(l)
      else {
        const list = childrenByParent.get(parentId) || []
        list.push(l)
        childrenByParent.set(parentId, list)
      }
    }

    const sortByName = (a: Loc, b: Loc) => String(a.name || '').localeCompare(String(b.name || ''))
    roots.sort(sortByName)
    for (const list of childrenByParent.values()) list.sort(sortByName)

    const out: Array<{ value: string; label: string; countryCode?: string | null }> = []
    const visited = new Set<string>()

    const walk = (node: Loc, depth: number) => {
      if (!node?.id || visited.has(node.id)) return
      visited.add(node.id)
      const indent = depth > 0 ? `${'\u00A0\u00A0'.repeat(depth)}- ` : ''
      out.push({
        value: node.code,
        label: `${indent}${node.name}`,
        countryCode: (node as any).countryCode ?? null,
      })

      const kids = childrenByParent.get(node.id) || []
      for (const k of kids) walk(k, depth + 1)
    }

    for (const r of roots) walk(r, 0)

    // Include any disconnected nodes that weren't reached.
    if (out.length < locations.length) {
      const remaining = locations.filter((l) => !visited.has(l.id)).sort(sortByName)
      for (const r of remaining) walk(r, 0)
    }

    return out
  }, [locations])

  const locationByCode = useMemo(() => {
    const map = new Map<string, (typeof locations)[number]>()
    for (const l of locations) map.set(l.code, l)
    return map
  }, [locations])

  const categoriesSorted = useMemo(
    () => [...props.categories].sort((a, b) => a.name.localeCompare(b.name)),
    [props.categories]
  )
  const brandsSorted = useMemo(() => [...props.brands].sort((a, b) => a.name.localeCompare(b.name)), [props.brands])

  const selectedCategories = useMemo(() => {
    const map = new Map(props.categories.map((c) => [c.id, c]))
    return draft.categoryIds.map((id) => map.get(id)).filter(Boolean) as { id: string; name: string }[]
  }, [draft.categoryIds, props.categories])

  const tabCounts = useMemo(
    () => ({
      availability: draft.availability.channels.length + draft.availability.countries.length + draft.availability.locations.length,
      options: draft.optionDefinitions.length,
      media: draft.images.length + pendingMediaCount,
      translations: draft.translations.length,
      skus: draft.skus.length,
      pricing: draft.prices.length,
    }),
    [
      draft.availability.channels.length,
      draft.availability.countries.length,
      draft.availability.locations.length,
      draft.images.length,
      draft.optionDefinitions.length,
      pendingMediaCount,
      draft.prices.length,
      draft.skus.length,
      draft.translations.length,
    ]
  )

  const tabErrors = useMemo(() => {
    const next = {
      basics: 0,
      availability: 0,
      options: 0,
      media: 0,
      translations: 0,
      skus: 0,
      pricing: 0,
    }

    Object.keys(errors).forEach((key) => {
      if (key === 'title') next.basics += 1
      if (key.startsWith('availability')) next.availability += 1
      if (key.startsWith('translations')) next.translations += 1
      if (key.startsWith('skus')) next.skus += 1
      if (key.startsWith('prices')) next.pricing += 1
    })

    return next
  }, [errors])

  const addCategory = (id: string) => setDraft((p) => ({ ...p, categoryIds: uniq([...p.categoryIds, id]) }))
  const removeCategory = (id: string) => setDraft((p) => ({ ...p, categoryIds: p.categoryIds.filter((x) => x !== id) }))

  useEffect(() => {
    // helpful: if primary translation title is empty, mirror from root title
    setDraft((p) => {
      if (!p.translations.length) return p
      if (p.translations[0].title.trim()) return p
      if (!p.title.trim()) return p
      const next = [...p.translations]
      next[0] = { ...next[0], title: p.title }
      return { ...p, translations: next }
    })
  }, [draft.title])

  const setDefaultSkuIndex = (idx: number) => {
    setDraft((p) => ({
      ...p,
      skus: p.skus.map((s, i) => ({ ...s, isDefault: i === idx })),
    }))
  }

  const submit = async (override?: Partial<Pick<CreateV1Draft, 'status'>>) => {
    const nextErrors: Record<string, string> = {}
    const title = draft.title.trim()
    if (!title) nextErrors['title'] = 'Title is required.'

    const translations = draft.translations
      .map((t, idx) => ({ ...t, locale: t.locale.trim(), title: t.title.trim() }))
      .filter((t) => t.locale || t.title || t.description.trim())

    if (!translations.length) nextErrors['translations'] = 'At least one translation is required.'
    if (translations.length && (!translations[0].locale || !translations[0].title)) {
      nextErrors['translations.0'] = 'Primary translation requires locale and title.'
    }

    draft.skus.forEach((s, idx) => {
      const sku = s.sku.trim()
      if (!sku) nextErrors[`skus.${idx}.sku`] = 'SKU code is required.'
      const availability = parseJsonObject(s.availabilityText)
      if (!availability.ok) nextErrors[`skus.${idx}.availability`] = availability.error
      if (draft.optionDefinitions.some((o) => o.required)) {
        for (const o of draft.optionDefinitions.filter((x) => x.required)) {
          const key = o.key.trim()
          if (!key) continue
          const v = (s.options?.[key] || '').trim()
          if (!v) nextErrors[`skus.${idx}.options.${key}`] = `${o.label || key} is required.`
        }
      }
    })

    if (!draft.skus.length) nextErrors['skus'] = 'At least one SKU is required.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      // bring user to the most likely section
      if (nextErrors['title']) setTab('basics')
      else if (nextErrors['translations'] || nextErrors['translations.0']) setTab('translations')
      else if (Object.keys(nextErrors).some((k) => k.startsWith('availability'))) setTab('availability')
      else if (Object.keys(nextErrors).some((k) => k.startsWith('skus'))) setTab('skus')
      else if (Object.keys(nextErrors).some((k) => k.startsWith('prices'))) setTab('pricing')
      return
    }

    let uploadedUrls: string[] = []
    try {
      const pending = uploadRef.current?.getFiles() || []
      if (pending.length) {
        const result = await uploadRef.current!.upload()
        uploadedUrls = result.urls
      }
    } catch (e: any) {
      toast.error('Image upload failed', { description: e?.message || 'Please try again.' })
      setTab('media')
      return
    }

    const allImages = uniq([...draft.images.map((u) => u.trim()).filter(Boolean), ...uploadedUrls])
    if (uploadedUrls.length) {
      setDraft((p) => ({ ...p, images: allImages }))
    }

    const payload: any = {
      title,
      description: draft.description.trim() || undefined,
      slug: draft.slug.trim() || undefined,
      seoTitle: draft.seoTitle.trim() || undefined,
      seoDescription: draft.seoDescription.trim() || undefined,
      status: override?.status ?? draft.status,
      externalRef: draft.externalRef.trim() || undefined,
      brandId: draft.brandId.trim() || undefined,
      categoryIds: draft.categoryIds.length ? draft.categoryIds : undefined,
      optionDefinitions: draft.optionDefinitions
        .map((o) => ({
          key: o.key.trim(),
          label: o.label.trim(),
          allowedValues: o.allowedValues.map((v) => v.trim()).filter(Boolean),
          required: Boolean(o.required),
        }))
        .filter((o) => o.key && o.label),
      images: allImages.length ? allImages : undefined,
      translations: translations.map((t) => ({
        locale: t.locale,
        title: t.title,
        description: t.description.trim() || undefined,
      })),
    }

    const availabilityHasAny =
      draft.availability.channels.length ||
      draft.availability.countries.length ||
      draft.availability.locations.length ||
      draft.availability.stockQuantity.trim() ||
      draft.availability.startAt.trim() ||
      draft.availability.endAt.trim()

    if (availabilityHasAny) {
      const stockQty = intOrU(draft.availability.stockQuantity)
      payload.availability = {
        channels: draft.availability.channels,
        countries: draft.availability.countries,
        locations: draft.availability.locations,
        stock: {
          type: draft.availability.stockType,
          ...(draft.availability.stockType === 'FINITE' ? { quantity: stockQty ?? 0 } : {}),
        },
        schedule: {
          startAt: draft.availability.startAt.trim() || undefined,
          endAt: draft.availability.endAt.trim() || undefined,
          timezone: draft.availability.timezone.trim() || 'UTC',
        },
        meta: {},
      }
    }

    const hasSku = draft.skus.some((s) => s.sku.trim() || s.title.trim())
    if (hasSku) {
      const ensuredDefaultIndex = draft.skus.findIndex((s) => s.isDefault)
      const defaultIdx = ensuredDefaultIndex >= 0 ? ensuredDefaultIndex : 0
      payload.skus = draft.skus
        .map((s, idx) => {
          const availabilityParsed = parseJsonObject(s.availabilityText)
          const options: Record<string, string> = {}
          for (const [k, v] of Object.entries(s.options || {})) {
            const key = k.trim()
            const value = String(v ?? '').trim()
            if (key && value) options[key] = value
          }

          const invLocations: Record<string, { onHand?: number; reserved?: number }> = {}
          for (const row of s.inventoryLocations || []) {
            const code = row.code.trim()
            if (!code) continue
            const onHand = intOrU(row.onHand)
            const reserved = intOrU(row.reserved)
            invLocations[code] = {
              ...(typeof onHand === 'number' ? { onHand } : {}),
              ...(typeof reserved === 'number' ? { reserved } : {}),
            }
          }
          const inventory = Object.keys(invLocations).length ? { locations: invLocations } : undefined

          return {
            title: s.title.trim() || undefined,
            sku: s.sku.trim() || undefined,
            externalRef: s.externalRef.trim() || undefined,
            status: s.status,
            isDefault: idx === defaultIdx,
            position: intOrU(s.position) ?? undefined,
            attributes: options,
            options,
            availability: availabilityParsed.ok ? availabilityParsed.value : undefined,
            inventory,
            images: s.images.map((u) => u.trim()).filter(Boolean),
            requiresShipping: Boolean(s.requiresShipping),
            weight: numOrU(s.weight),
            length: numOrU(s.length),
            width: numOrU(s.width),
            height: numOrU(s.height),
            dimensionUnit: s.dimensionUnit,
            weightUnit: s.weightUnit,
            prices: s.prices
              .map((p) => {
                return {
                  priceListId: p.priceListId.trim() || undefined,
                  unitPrice: numOrU(p.unitPrice),
                  compareAtPrice: numOrU(p.compareAtPrice),
                  minQuantity: intOrU(p.minQuantity),
                  maxQuantity: intOrU(p.maxQuantity),
                  validFrom: p.validFrom.trim() || undefined,
                  validTo: p.validTo.trim() || undefined,
                  metaJson: {},
                }
              })
              .filter((p) => p.priceListId && typeof p.unitPrice === 'number'),
          }
        })
        .filter((s: any) => s.sku || s.title)
    }

    const topPrices = draft.prices
      .map((p) => {
        return {
          priceListId: p.priceListId.trim() || undefined,
          unitPrice: numOrU(p.unitPrice),
          compareAtPrice: numOrU(p.compareAtPrice),
          minQuantity: intOrU(p.minQuantity),
          maxQuantity: intOrU(p.maxQuantity),
          validFrom: p.validFrom.trim() || undefined,
          validTo: p.validTo.trim() || undefined,
          metaJson: {},
        }
      })
      .filter((p) => p.priceListId && typeof p.unitPrice === 'number')

    if (topPrices.length) payload.prices = topPrices

    await props.onCreate(payload)
  }

  return (
    <div className="space-y-6 pb-24">
      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">Product setup</div>
            <div className="text-xs text-muted-foreground">Fill in the essentials, then publish when you're ready.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge
              variant={draft.status === 'active' ? 'default' : draft.status === 'archived' ? 'outline' : 'secondary'}
            >
              {draft.status}
            </Badge>
            <Badge variant={draft.title.trim() ? 'secondary' : 'outline'}>Title</Badge>
            <Badge variant={draft.translations[0]?.title?.trim() ? 'secondary' : 'outline'}>Primary translation</Badge>
            <Badge variant={draft.categoryIds.length ? 'secondary' : 'outline'}>
              {draft.categoryIds.length} {draft.categoryIds.length === 1 ? 'category' : 'categories'}
            </Badge>
            <Badge variant={draft.skus.length ? 'secondary' : 'outline'}>
              {draft.skus.length} {draft.skus.length === 1 ? 'SKU' : 'SKUs'}
            </Badge>
            <Badge variant={tabCounts.media ? 'secondary' : 'outline'}>
              {tabCounts.media} {tabCounts.media === 1 ? 'image' : 'images'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit lg:sticky lg:top-24">
          <CardContent className="p-2">
            <ScrollArea className="max-h-[360px] sm:max-h-[420px] lg:max-h-[calc(100vh-8rem)]">
              <div className="space-y-1 pr-2">
                <Button
                  type="button"
                  variant={tab === 'basics' ? 'secondary' : 'ghost'}
                  className="w-full justify-between items-start gap-3 px-3 py-2 h-auto text-left"
                  onClick={() => setTab('basics')}
                >
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium">Basics</span>
                    <span className="text-xs text-muted-foreground">Title, brand, categories</span>
                  </span>
                  {tabErrors.basics ? <Badge variant="destructive">{tabErrors.basics}</Badge> : null}
                </Button>

                <Button
                  type="button"
                  variant={tab === 'availability' ? 'secondary' : 'ghost'}
                  className="w-full justify-between items-start gap-3 px-3 py-2 h-auto text-left"
                  onClick={() => setTab('availability')}
                >
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium">Availability</span>
                    <span className="text-xs text-muted-foreground">Channels, stock, schedule</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {tabErrors.availability ? <Badge variant="destructive">{tabErrors.availability}</Badge> : null}
                    {tabCounts.availability ? <Badge variant="secondary">{tabCounts.availability}</Badge> : null}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant={tab === 'options' ? 'secondary' : 'ghost'}
                  className="w-full justify-between items-start gap-3 px-3 py-2 h-auto text-left"
                  onClick={() => setTab('options')}
                >
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium">Options</span>
                    <span className="text-xs text-muted-foreground">Variants & attributes</span>
                  </span>
                  {tabCounts.options ? <Badge variant="secondary">{tabCounts.options}</Badge> : null}
                </Button>

                <Button
                  type="button"
                  variant={tab === 'media' ? 'secondary' : 'ghost'}
                  className="w-full justify-between items-start gap-3 px-3 py-2 h-auto text-left"
                  onClick={() => setTab('media')}
                >
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium">Media</span>
                    <span className="text-xs text-muted-foreground">Images & galleries</span>
                  </span>
                  {tabCounts.media ? <Badge variant="secondary">{tabCounts.media}</Badge> : null}
                </Button>

                <Button
                  type="button"
                  variant={tab === 'translations' ? 'secondary' : 'ghost'}
                  className="w-full justify-between items-start gap-3 px-3 py-2 h-auto text-left"
                  onClick={() => setTab('translations')}
                >
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium">Translations</span>
                    <span className="text-xs text-muted-foreground">Locales & descriptions</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {tabErrors.translations ? <Badge variant="destructive">{tabErrors.translations}</Badge> : null}
                    {tabCounts.translations ? <Badge variant="secondary">{tabCounts.translations}</Badge> : null}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant={tab === 'skus' ? 'secondary' : 'ghost'}
                  className="w-full justify-between items-start gap-3 px-3 py-2 h-auto text-left"
                  onClick={() => setTab('skus')}
                >
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium">SKUs</span>
                    <span className="text-xs text-muted-foreground">Inventory & pricing</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {tabErrors.skus ? <Badge variant="destructive">{tabErrors.skus}</Badge> : null}
                    {tabCounts.skus ? <Badge variant="secondary">{tabCounts.skus}</Badge> : null}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant={tab === 'pricing' ? 'secondary' : 'ghost'}
                  className="w-full justify-between items-start gap-3 px-3 py-2 h-auto text-left"
                  onClick={() => setTab('pricing')}
                >
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-medium">Pricing</span>
                    <span className="text-xs text-muted-foreground">Top-level prices</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {tabErrors.pricing ? <Badge variant="destructive">{tabErrors.pricing}</Badge> : null}
                    {tabCounts.pricing ? <Badge variant="secondary">{tabCounts.pricing}</Badge> : null}
                  </span>
                </Button>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <TabsContent value="basics" className="mt-0">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Basics</CardTitle>
                <CardDescription>Core identity and catalog grouping.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Product title</Label>
                  <Input
                    value={draft.title}
                    onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                    placeholder="iPhone 15 Pro"
                    disabled={props.disabled}
                  />
                  {errors['title'] ? <div className="text-xs text-destructive">{errors['title']}</div> : null}
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={draft.description}
                    onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Short product description…"
                    className="min-h-[120px]"
                    disabled={props.disabled}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input
                      value={draft.slug}
                      onChange={(e) => setDraft((p) => ({ ...p, slug: e.target.value }))}
                      placeholder="iphone-15"
                      disabled={props.disabled}
                    />
                    <div className="text-xs text-muted-foreground">Used for product URLs.</div>
                  </div>
                  <div className="space-y-2">
                    <Label>SEO title</Label>
                    <Input
                      value={draft.seoTitle}
                      onChange={(e) => setDraft((p) => ({ ...p, seoTitle: e.target.value }))}
                      placeholder="iPhone 15 | Shop"
                      disabled={props.disabled}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>SEO description</Label>
                  <Textarea
                    value={draft.seoDescription}
                    onChange={(e) => setDraft((p) => ({ ...p, seoDescription: e.target.value }))}
                    placeholder="Flagship smartphone with pro-grade camera and long battery life."
                    className="min-h-[100px]"
                    disabled={props.disabled}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>External reference</Label>
                    <Input
                      value={draft.externalRef}
                      onChange={(e) => setDraft((p) => ({ ...p, externalRef: e.target.value }))}
                      placeholder="erp-1234"
                      disabled={props.disabled}
                    />
                    <div className="text-xs text-muted-foreground">Optional ID from ERP/PIM.</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Select
                      value={draft.brandId || '__none__'}
                      onValueChange={(v) => setDraft((p) => ({ ...p, brandId: v === '__none__' ? '' : v }))}
                      disabled={props.disabled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No brand</SelectItem>
                        {brandsSorted.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">Optional, helps shoppers browse.</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Categories</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between" disabled={props.disabled}>
                        {draft.categoryIds.length ? `${draft.categoryIds.length} selected` : 'Select categories'}
                        <span className="text-muted-foreground">Search</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(520px,calc(100vw-2rem))] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search categories…" />
                        <CommandEmpty>No categories found.</CommandEmpty>
                        <CommandList>
                          <ScrollArea className="h-[280px]">
                            {categoriesSorted.map((c) => {
                              const selected = draft.categoryIds.includes(c.id)
                              return (
                                <CommandItem
                                  key={c.id}
                                  value={`${c.name} ${c.id}`}
                                  onSelect={() => (selected ? removeCategory(c.id) : addCategory(c.id))}
                                >
                                  <div className={cn('flex-1', selected ? 'font-medium' : '')}>{c.name}</div>
                                  {selected ? <Badge variant="secondary">Selected</Badge> : null}
                                </CommandItem>
                              )
                            })}
                          </ScrollArea>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="text-xs text-muted-foreground">Use categories to group and filter products.</div>
                </div>

                {selectedCategories.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedCategories.map((c) => (
                      <Badge key={c.id} variant="secondary" className="gap-1">
                        {c.name}
                        <button
                          type="button"
                          className="ml-1 rounded-sm hover:bg-muted"
                          onClick={() => removeCategory(c.id)}
                          aria-label={`Remove ${c.name}`}
                          disabled={props.disabled}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="availability" className="mt-0">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Availability</CardTitle>
                <CardDescription>Channels, regions, stock rules, and scheduling.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <MultiSelectAdd
                    label="Channels"
                    values={draft.availability.channels}
                    onChange={(channels) => setDraft((p) => ({ ...p, availability: { ...p.availability, channels } }))}
                    placeholder="Select a channel"
                    helperText="Choose one or more channels"
                    disabled={props.disabled}
                    options={channels.map((c) => ({
                      value: c.code,
                      label: c.name,
                      disabled: c.isActive === false,
                    }))}
                  />
                  <TagInput
                    label="Countries"
                    values={draft.availability.countries}
                    onChange={(countries) => setDraft((p) => ({ ...p, availability: { ...p.availability, countries } }))}
                    placeholder="KE"
                    helperText="ISO-2 codes, e.g. KE, TZ"
                    disabled={props.disabled}
                  />
                  <MultiSelectAdd
                    label="Locations"
                    values={draft.availability.locations}
                    onChange={(locs) => setDraft((p) => ({ ...p, availability: { ...p.availability, locations: locs } }))}
                    onAdd={(code) =>
                      setDraft((p) => {
                        const nextLocations = p.availability.locations.includes(code)
                          ? p.availability.locations
                          : [...p.availability.locations, code]

                        const country = String((locationByCode.get(code) as any)?.countryCode ?? '').trim()
                        const nextCountries = country ? uniq([...p.availability.countries, country]) : p.availability.countries

                        return {
                          ...p,
                          availability: {
                            ...p.availability,
                            locations: nextLocations,
                            countries: nextCountries,
                          },
                        }
                      })
                    }
                    placeholder="Select a location"
                    helperText="Choosing a location auto-adds its country (when available)"
                    disabled={props.disabled}
                    options={locationOptions.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Stock type</Label>
                  <Select
                    value={draft.availability.stockType}
                    onValueChange={(v) => setDraft((p) => ({ ...p, availability: { ...p.availability, stockType: v as any } }))}
                    disabled={props.disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FINITE">FINITE</SelectItem>
                      <SelectItem value="INFINITE">INFINITE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Stock quantity</Label>
                  <Input
                    type="number"
                    min={0}
                    value={draft.availability.stockQuantity}
                    onChange={(e) => setDraft((p) => ({ ...p, availability: { ...p.availability, stockQuantity: e.target.value } }))}
                    disabled={props.disabled || draft.availability.stockType !== 'FINITE'}
                    placeholder="20"
                  />
                  <div className="text-xs text-muted-foreground">Only required for FINITE.</div>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input
                    value={draft.availability.timezone}
                    onChange={(e) => setDraft((p) => ({ ...p, availability: { ...p.availability, timezone: e.target.value } }))}
                    placeholder="UTC"
                    disabled={props.disabled}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start at</Label>
                  <Input
                    type="datetime-local"
                    value={toDateTimeLocalValue(draft.availability.startAt)}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, availability: { ...p.availability, startAt: fromDateTimeLocalValue(e.target.value) } }))
                    }
                    disabled={props.disabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End at</Label>
                  <Input
                    type="datetime-local"
                    value={toDateTimeLocalValue(draft.availability.endAt)}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, availability: { ...p.availability, endAt: fromDateTimeLocalValue(e.target.value) } }))
                    }
                    disabled={props.disabled}
                  />
                </div>
              </div>

              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                Leave fields empty to apply availability everywhere.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="options" className="mt-0">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Option definitions</CardTitle>
              <CardDescription>Define selectable options like color, size, storage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDraft((p) => ({ ...p, optionDefinitions: [...p.optionDefinitions, { key: '', label: '', allowedValues: [], required: false }] }))}
                  disabled={props.disabled}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add option
                </Button>
              </div>

              {draft.optionDefinitions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No options defined.</div>
              ) : (
                <div className="space-y-3">
                  {draft.optionDefinitions.map((o, idx) => (
                    <div key={idx} className="rounded-md border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">Option #{idx + 1}</div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDraft((p) => ({ ...p, optionDefinitions: p.optionDefinitions.filter((_, i) => i !== idx) }))}
                          disabled={props.disabled}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Key</Label>
                          <Input
                            value={o.key}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                optionDefinitions: p.optionDefinitions.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x)),
                              }))
                            }
                            placeholder="color"
                            disabled={props.disabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Label</Label>
                          <Input
                            value={o.label}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                optionDefinitions: p.optionDefinitions.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                              }))
                            }
                            placeholder="Color"
                            disabled={props.disabled}
                          />
                        </div>
                      </div>

                      <TagInput
                        label="Allowed values"
                        values={o.allowedValues}
                        onChange={(allowedValues) =>
                          setDraft((p) => ({
                            ...p,
                            optionDefinitions: p.optionDefinitions.map((x, i) => (i === idx ? { ...x, allowedValues } : x)),
                          }))
                        }
                        placeholder="black"
                        disabled={props.disabled}
                      />

                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <div className="text-sm font-medium">Required</div>
                          <div className="text-xs text-muted-foreground">Must be selected for SKUs.</div>
                        </div>
                        <Switch
                          checked={o.required}
                          onCheckedChange={(required) =>
                            setDraft((p) => ({
                              ...p,
                              optionDefinitions: p.optionDefinitions.map((x, i) => (i === idx ? { ...x, required } : x)),
                            }))
                          }
                          disabled={props.disabled}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="mt-0">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Media</CardTitle>
              <CardDescription>Product-level images.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CommonUpload
                ref={uploadRef}
                mode="deferred"
                label="Images"
                description="Choose images now; they upload when you submit the product. Drag thumbnails to reorder."
                folder="products"
                multiple
                accept="image/*"
                imagesOnly
                isPublic
                token={props.token}
                onFilesChange={(files) => setPendingMediaCount(files.length)}
                onUploaded={() => {}}
                disabled={props.disabled}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="translations" className="mt-0">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Translations</CardTitle>
              <CardDescription>Localized titles and descriptions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDraft((p) => ({ ...p, translations: [...p.translations, { locale: '', title: '', description: '' }] }))}
                  disabled={props.disabled}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add translation
                </Button>
              </div>

              {errors['translations'] || errors['translations.0'] ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {errors['translations'] || errors['translations.0']}
                </div>
              ) : null}

              <div className="space-y-3">
                {draft.translations.map((t, idx) => (
                  <div key={idx} className={cn('rounded-md border p-3 space-y-3', idx === 0 ? 'bg-muted/10' : '')}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{idx === 0 ? 'Primary' : `Translation #${idx + 1}`}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={props.disabled || draft.translations.length <= 1}
                        onClick={() => setDraft((p) => ({ ...p, translations: p.translations.filter((_, i) => i !== idx) }))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Locale</Label>
                        <Input
                          value={t.locale}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              translations: p.translations.map((x, i) => (i === idx ? { ...x, locale: e.target.value } : x)),
                            }))
                          }
                          placeholder="en"
                          disabled={props.disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={t.title}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              translations: p.translations.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                            }))
                          }
                          placeholder="iPhone 15"
                          disabled={props.disabled}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={t.description}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            translations: p.translations.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)),
                          }))
                        }
                        placeholder="string"
                        disabled={props.disabled}
                      />
                    </div>


                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skus" className="mt-0">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>SKUs</CardTitle>
              <CardDescription>Variants, inventory, and SKU-level pricing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Mark one SKU as default.</div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDraft((p) => ({ ...p, skus: [...p.skus, { ...blankSku(), isDefault: p.skus.length === 0 }] }))}
                  disabled={props.disabled}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add SKU
                </Button>
              </div>

              {errors['skus'] ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {errors['skus']}
                </div>
              ) : null}

              <div className="space-y-4">
                {draft.skus.map((s, idx) => (
                  <div key={idx} className="rounded-md border p-3 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">SKU #{idx + 1}</div>
                        {s.isDefault ? <Badge>Default</Badge> : <Badge variant="secondary">Secondary</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDefaultSkuIndex(idx)}
                          disabled={props.disabled || s.isDefault}
                        >
                          Set default
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDraft((p) => {
                              const next = p.skus.filter((_, i) => i !== idx)
                              if (next.length && !next.some((x) => x.isDefault)) next[0].isDefault = true
                              return { ...p, skus: next.length ? next : [blankSku()] }
                            })
                          }
                          disabled={props.disabled}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={s.title}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                            }))
                          }
                          placeholder="Black / 128 GB"
                          disabled={props.disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SKU</Label>
                        <Input
                          value={s.sku}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)),
                            }))
                          }
                          placeholder="IPH-15-BLK-128"
                          disabled={props.disabled}
                        />
                        {errors[`skus.${idx}.sku`] ? <div className="text-xs text-destructive">{errors[`skus.${idx}.sku`]}</div> : null}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>External ref</Label>
                        <Input
                          value={s.externalRef}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, externalRef: e.target.value } : x)),
                            }))
                          }
                          placeholder="shopify-sku-123"
                          disabled={props.disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Position</Label>
                        <Input
                          type="number"
                          min={1}
                          value={s.position}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, position: e.target.value } : x)),
                            }))
                          }
                          disabled={props.disabled}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={s.status}
                          onValueChange={(value) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, status: value as any } : x)),
                            }))
                          }
                          disabled={props.disabled}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Availability (JSON)</Label>
                        <Textarea
                          value={s.availabilityText}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, availabilityText: e.target.value } : x)),
                            }))
                          }
                          className={cn('min-h-[120px] font-mono text-xs', errors[`skus.${idx}.availability`] ? 'border-destructive' : '')}
                          placeholder={`{\n  "channels": ["WEB"],\n  "stock": {"type": "FINITE", "quantity": 20}\n}`}
                          disabled={props.disabled}
                        />
                        {errors[`skus.${idx}.availability`] ? (
                          <div className="text-xs text-destructive">{errors[`skus.${idx}.availability`]}</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">Requires shipping</div>
                      </div>
                      <Switch
                        checked={s.requiresShipping}
                        onCheckedChange={(requiresShipping) =>
                          setDraft((p) => ({
                            ...p,
                            skus: p.skus.map((x, i) => (i === idx ? { ...x, requiresShipping } : x)),
                          }))
                        }
                        disabled={props.disabled}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Weight</Label>
                        <Input
                          type="number"
                          value={s.weight}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, weight: e.target.value } : x)),
                            }))
                          }
                          placeholder="0.2"
                          disabled={props.disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Weight unit</Label>
                        <Select
                          value={s.weightUnit}
                          onValueChange={(v) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, weightUnit: v as any } : x)),
                            }))
                          }
                          disabled={props.disabled}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="lb">lb</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Dimension unit</Label>
                        <Select
                          value={s.dimensionUnit}
                          onValueChange={(v) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, dimensionUnit: v as any } : x)),
                            }))
                          }
                          disabled={props.disabled}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cm">cm</SelectItem>
                            <SelectItem value="in">in</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Length</Label>
                        <Input
                          type="number"
                          value={s.length}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, length: e.target.value } : x)),
                            }))
                          }
                          placeholder="10.5"
                          disabled={props.disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Width</Label>
                        <Input
                          type="number"
                          value={s.width}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, width: e.target.value } : x)),
                            }))
                          }
                          placeholder="5.25"
                          disabled={props.disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Height</Label>
                        <Input
                          type="number"
                          value={s.height}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, height: e.target.value } : x)),
                            }))
                          }
                          placeholder="2.75"
                          disabled={props.disabled}
                        />
                      </div>
                    </div>

                    {draft.optionDefinitions.length ? (
                      <div className="space-y-2">
                        <Label>Options</Label>
                        <div className="grid gap-4 sm:grid-cols-3">
                          {draft.optionDefinitions
                            .map((o) => ({ ...o, key: o.key.trim(), label: o.label.trim() }))
                            .filter((o) => o.key)
                            .map((o) => {
                              const key = o.key
                              const label = o.label || key
                              const allowed = (o.allowedValues || []).map((v) => v.trim()).filter(Boolean)
                              const value = (s.options?.[key] || '').trim()
                              const errKey = `skus.${idx}.options.${key}`
                              return (
                                <div key={key} className="space-y-2">
                                  <Label>{label}{o.required ? ' *' : ''}</Label>
                                  {allowed.length ? (
                                    <Select
                                      value={value || '__none__'}
                                      onValueChange={(v) =>
                                        setDraft((p) => ({
                                          ...p,
                                          skus: p.skus.map((x, i) =>
                                            i === idx
                                              ? {
                                                  ...x,
                                                  options: {
                                                    ...(x.options || {}),
                                                    [key]: v === '__none__' ? '' : v,
                                                  },
                                                }
                                              : x
                                          ),
                                        }))
                                      }
                                      disabled={props.disabled}
                                    >
                                      <SelectTrigger className={errors[errKey] ? 'border-destructive' : undefined}>
                                        <SelectValue placeholder={`Select ${label}`} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">None</SelectItem>
                                        {allowed.map((v) => (
                                          <SelectItem key={v} value={v}>
                                            {v}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      value={value}
                                      onChange={(e) =>
                                        setDraft((p) => ({
                                          ...p,
                                          skus: p.skus.map((x, i) =>
                                            i === idx
                                              ? {
                                                  ...x,
                                                  options: {
                                                    ...(x.options || {}),
                                                    [key]: e.target.value,
                                                  },
                                                }
                                              : x
                                          ),
                                        }))
                                      }
                                      placeholder={`Enter ${label}`}
                                      className={errors[errKey] ? 'border-destructive' : undefined}
                                      disabled={props.disabled}
                                    />
                                  )}
                                  {errors[errKey] ? <div className="text-xs text-destructive">{errors[errKey]}</div> : null}
                                </div>
                              )
                            })}
                        </div>
                        <div className="text-xs text-muted-foreground">Options are used to generate both `options` and `attributes` for the SKU.</div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No option definitions. Add options in the “Options” tab to enable variant selection here.</div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Inventory by location</Label>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) =>
                                i === idx
                                  ? { ...x, inventoryLocations: [...(x.inventoryLocations || []), { code: '', onHand: '', reserved: '' }] }
                                  : x
                              ),
                            }))
                          }
                          disabled={props.disabled}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add location
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {(s.inventoryLocations || []).map((row, rowIdx) => (
                          <div key={rowIdx} className="rounded-md border bg-card/70 p-3">
                            <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr_0.8fr_auto] items-end">
                              <div className="space-y-2">
                                <Label>Location code</Label>
                                <Select
                                  value={row.code}
                                  onValueChange={(value) =>
                                    setDraft((p) => ({
                                      ...p,
                                      skus: p.skus.map((x, i) =>
                                        i === idx
                                          ? {
                                              ...x,
                                              inventoryLocations: (x.inventoryLocations || []).map((r, j) =>
                                                j === rowIdx ? { ...r, code: value } : r
                                              ),
                                            }
                                          : x
                                      ),
                                    }))
                                  }
                                  disabled={props.disabled}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select location" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {locationOptions.map((o) => (
                                      <SelectItem key={o.value} value={o.value}>
                                        <span className="whitespace-pre">{o.label}</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>On hand</Label>
                                <Input
                                  type="number"
                                  value={row.onHand}
                                  onChange={(e) =>
                                    setDraft((p) => ({
                                      ...p,
                                      skus: p.skus.map((x, i) =>
                                        i === idx
                                          ? {
                                              ...x,
                                              inventoryLocations: (x.inventoryLocations || []).map((r, j) =>
                                                j === rowIdx ? { ...r, onHand: e.target.value } : r
                                              ),
                                            }
                                          : x
                                      ),
                                    }))
                                  }
                                  placeholder="10"
                                  disabled={props.disabled}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Reserved</Label>
                                <Input
                                  type="number"
                                  value={row.reserved}
                                  onChange={(e) =>
                                    setDraft((p) => ({
                                      ...p,
                                      skus: p.skus.map((x, i) =>
                                        i === idx
                                          ? {
                                              ...x,
                                              inventoryLocations: (x.inventoryLocations || []).map((r, j) =>
                                                j === rowIdx ? { ...r, reserved: e.target.value } : r
                                              ),
                                            }
                                          : x
                                      ),
                                    }))
                                  }
                                  placeholder="2"
                                  disabled={props.disabled}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setDraft((p) => ({
                                    ...p,
                                    skus: p.skus.map((x, i) =>
                                      i === idx
                                        ? {
                                            ...x,
                                            inventoryLocations: (x.inventoryLocations || []).filter((_, j) => j !== rowIdx),
                                          }
                                        : x
                                    ),
                                  }))
                                }
                                disabled={props.disabled}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="text-xs text-muted-foreground">Optional. Leave blank to manage inventory later.</div>
                    </div>

                    <div className="rounded-md border bg-muted/10 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">SKU prices</div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setDraft((p) => ({
                              ...p,
                              skus: p.skus.map((x, i) => (i === idx ? { ...x, prices: [...x.prices, blankPrice()] } : x)),
                            }))
                          }
                          disabled={props.disabled}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add price
                        </Button>
                      </div>

                      {s.prices.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No SKU prices.</div>
                      ) : (
                        <div className="space-y-3">
                          {s.prices.map((pRow, pIdx) => (
                            <div key={pIdx} className="rounded-md border bg-card/70 p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium">Price #{pIdx + 1}</div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setDraft((prev) => ({
                                      ...prev,
                                      skus: prev.skus.map((x, i) =>
                                        i === idx ? { ...x, prices: x.prices.filter((_, j) => j !== pIdx) } : x
                                      ),
                                    }))
                                  }
                                  disabled={props.disabled}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-2">
                                  <Label>Price list</Label>
                                  <Select
                                    value={pRow.priceListId}
                                    onValueChange={(value) =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        skus: prev.skus.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                prices: x.prices.map((pr, j) => (j === pIdx ? { ...pr, priceListId: value } : pr)),
                                              }
                                            : x
                                        ),
                                      }))
                                    }
                                    disabled={props.disabled}
                                  >
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
                                  <Label>Unit price</Label>
                                  <Input
                                    type="number"
                                    value={pRow.unitPrice}
                                    onChange={(e) =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        skus: prev.skus.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                prices: x.prices.map((pr, j) => (j === pIdx ? { ...pr, unitPrice: e.target.value } : pr)),
                                              }
                                            : x
                                        ),
                                      }))
                                    }
                                    placeholder="1999.99"
                                    disabled={props.disabled}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Compare at</Label>
                                  <Input
                                    type="number"
                                    value={pRow.compareAtPrice}
                                    onChange={(e) =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        skus: prev.skus.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                prices: x.prices.map((pr, j) => (j === pIdx ? { ...pr, compareAtPrice: e.target.value } : pr)),
                                              }
                                            : x
                                        ),
                                      }))
                                    }
                                    placeholder="2499.99"
                                    disabled={props.disabled}
                                  />
                                </div>
                              </div>

                              <div className="grid gap-4 sm:grid-cols-4">
                                <div className="space-y-2">
                                  <Label>Min qty</Label>
                                  <Input
                                    type="number"
                                    value={pRow.minQuantity}
                                    onChange={(e) =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        skus: prev.skus.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                prices: x.prices.map((pr, j) => (j === pIdx ? { ...pr, minQuantity: e.target.value } : pr)),
                                              }
                                            : x
                                        ),
                                      }))
                                    }
                                    placeholder="1"
                                    disabled={props.disabled}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Max qty</Label>
                                  <Input
                                    type="number"
                                    value={pRow.maxQuantity}
                                    onChange={(e) =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        skus: prev.skus.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                prices: x.prices.map((pr, j) => (j === pIdx ? { ...pr, maxQuantity: e.target.value } : pr)),
                                              }
                                            : x
                                        ),
                                      }))
                                    }
                                    placeholder="10"
                                    disabled={props.disabled}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Valid from</Label>
                                  <Input
                                    type="datetime-local"
                                    value={toDateTimeLocalValue(pRow.validFrom)}
                                    onChange={(e) =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        skus: prev.skus.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                prices: x.prices.map((pr, j) => (j === pIdx ? { ...pr, validFrom: fromDateTimeLocalValue(e.target.value) } : pr)),
                                              }
                                            : x
                                        ),
                                      }))
                                    }
                                    disabled={props.disabled}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Valid to</Label>
                                  <Input
                                    type="datetime-local"
                                    value={toDateTimeLocalValue(pRow.validTo)}
                                    onChange={(e) =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        skus: prev.skus.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                prices: x.prices.map((pr, j) => (j === pIdx ? { ...pr, validTo: fromDateTimeLocalValue(e.target.value) } : pr)),
                                              }
                                            : x
                                        ),
                                      }))
                                    }
                                    disabled={props.disabled}
                                  />
                                </div>
                              </div>


                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-0">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Product prices</CardTitle>
              <CardDescription>Optional top-level prices (applies broadly unless overridden by SKU prices).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDraft((p) => ({ ...p, prices: [...p.prices, blankPrice()] }))}
                  disabled={props.disabled}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add price
                </Button>
              </div>

              {draft.prices.length === 0 ? (
                <div className="text-sm text-muted-foreground">No product-level prices.</div>
              ) : (
                <div className="space-y-3">
                  {draft.prices.map((pRow, idx) => (
                    <div key={idx} className="rounded-md border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Price #{idx + 1}</div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDraft((p) => ({ ...p, prices: p.prices.filter((_, i) => i !== idx) }))}
                          disabled={props.disabled}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Price list</Label>
                          <Select
                            value={pRow.priceListId}
                            onValueChange={(value) =>
                              setDraft((p) => ({
                                ...p,
                                prices: p.prices.map((x, i) => (i === idx ? { ...x, priceListId: value } : x)),
                              }))
                            }
                            disabled={props.disabled}
                          >
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
                          <Label>Unit price</Label>
                          <Input
                            type="number"
                            value={pRow.unitPrice}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                prices: p.prices.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)),
                              }))
                            }
                            placeholder="1999.99"
                            disabled={props.disabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Compare at</Label>
                          <Input
                            type="number"
                            value={pRow.compareAtPrice}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                prices: p.prices.map((x, i) => (i === idx ? { ...x, compareAtPrice: e.target.value } : x)),
                              }))
                            }
                            placeholder="2499.99"
                            disabled={props.disabled}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-4">
                        <div className="space-y-2">
                          <Label>Min qty</Label>
                          <Input
                            type="number"
                            value={pRow.minQuantity}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                prices: p.prices.map((x, i) => (i === idx ? { ...x, minQuantity: e.target.value } : x)),
                              }))
                            }
                            placeholder="1"
                            disabled={props.disabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Max qty</Label>
                          <Input
                            type="number"
                            value={pRow.maxQuantity}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                prices: p.prices.map((x, i) => (i === idx ? { ...x, maxQuantity: e.target.value } : x)),
                              }))
                            }
                            placeholder="10"
                            disabled={props.disabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valid from</Label>
                          <Input
                            type="datetime-local"
                            value={toDateTimeLocalValue(pRow.validFrom)}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                prices: p.prices.map((x, i) => (i === idx ? { ...x, validFrom: fromDateTimeLocalValue(e.target.value) } : x)),
                              }))
                            }
                            disabled={props.disabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valid to</Label>
                          <Input
                            type="datetime-local"
                            value={toDateTimeLocalValue(pRow.validTo)}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                prices: p.prices.map((x, i) => (i === idx ? { ...x, validTo: fromDateTimeLocalValue(e.target.value) } : x)),
                              }))
                            }
                            disabled={props.disabled}
                          />
                        </div>
                      </div>


                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </div>
    </Tabs>

    <div className="sticky bottom-4 z-10">
      <Card className="border bg-background/95 shadow-sm backdrop-blur">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="text-xs text-muted-foreground">
            Create the product as a draft, or publish immediately.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => submit({ status: 'active' })}
              disabled={props.disabled}
            >
              Create & publish
            </Button>
            <Button type="button" onClick={() => submit({ status: 'draft' })} disabled={props.disabled}>
              Create as draft
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
  )
}

export function AdminProductAddPage() {
  const [, setLocation] = useLocation()
  const { accessToken } = useAdminAuth()

  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])

  const { categories, isLoading: isLoadingCategories, error: categoriesError } = useCatalogCategories({
    token: accessToken,
    fallbackToMock: false,
  })
  const { brands, isLoading: isLoadingBrands, error: brandsError } = useCatalogBrands({ token: accessToken })

  const [isSaving, setIsSaving] = useState(false)
  const [createMode, setCreateMode] = useState<'guided' | 'raw'>('guided')

  const [extraFieldsText, setExtraFieldsText] = useState('{\n\n}')
  const [extraFieldsError, setExtraFieldsError] = useState<string | null>(null)

  const [rawPayloadText, setRawPayloadText] = useState('')
  const [rawPayloadError, setRawPayloadError] = useState<string | null>(null)

  const isLoading = isLoadingCategories || isLoadingBrands
  const loadError = categoriesError || brandsError

  const onCreateV1 = useMemo(() => {
    return async (basePayload: any) => {
      setIsSaving(true)
      try {
        const extra = parseJsonObject(extraFieldsText)
        setExtraFieldsError(extra.ok ? null : extra.error)
        if (!extra.ok) throw new Error('Extra fields JSON is invalid')

        // Extra fields can augment/override top-level keys (only include fields present in Swagger).
        const merged = { ...basePayload, ...extra.value }
        const finalPayload = stripVariantIds(merged)

        const createdRaw = await api.post<any>(endpoints.catalog.products(), finalPayload)
        const created = normalizeCreateResponse(createdRaw)
        if (!created?.id) throw new Error('Create failed (missing product id in response)')
        toast.success('Product created')
        setLocation(`/axis/products/${encodeURIComponent(created.id)}/edit`)
      } catch (e: any) {
        toast.error('Failed to create product', { description: e?.message || 'Please try again.' })
      } finally {
        setIsSaving(false)
      }
    }
  }, [api, extraFieldsText, setLocation])

  const saveRaw = async () => {
    setIsSaving(true)
    setRawPayloadError(null)
    try {
      const parsed = parseJsonObject(rawPayloadText)
      if (!parsed.ok) {
        setRawPayloadError(parsed.error)
        throw new Error('Raw payload JSON is invalid')
      }

      const finalPayload = stripVariantIds(parsed.value)
      const createdRaw = await api.post<any>(endpoints.catalog.products(), finalPayload)
      const created = normalizeCreateResponse(createdRaw)
      if (!created?.id) throw new Error('Create failed (missing product id in response)')
      toast.success('Product created')
      setLocation(`/axis/products/${encodeURIComponent(created.id)}/edit`)
    } catch (e: any) {
      toast.error('Failed to create product', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (createMode !== 'raw') return
    if (rawPayloadText.trim()) return

    // Starter template that matches ProductController_create_v1 sample body.
    setRawPayloadText(
      JSON.stringify(
        {
          title: 'iPhone 15',
          description: 'string',
          seoTitle: 'iPhone 15 | Shop',
          seoDescription: 'Flagship smartphone with pro-grade camera and long battery life.',
          status: 'draft',
          slug: 'string',
          externalRef: 'erp-1234',
          brandId: 'string',
          categoryIds: ['string'],
          optionDefinitions: [
            {
              key: 'color',
              label: 'Color',
              allowedValues: ['black', 'white'],
              required: false,
            },
          ],
          availability: {
            channels: ['app', 'ussd'],
            countries: ['KE', 'TZ'],
            locations: ['Nairobi'],
            stock: { type: 'FINITE', quantity: 20 },
            schedule: {
              startAt: '2025-01-01T00:00:00Z',
              endAt: '2025-12-31T23:59:59Z',
              timezone: 'UTC',
            },
            meta: {},
          },
          images: ['https://cdn.example.com/img.png'],
          translations: [
            {
              locale: 'en',
              title: 'iPhone 15',
              description: 'string',
              metaJson: { tagline: 'New' },
            },
          ],
          skus: [
            {
              title: 'Black / 128 GB',
              sku: 'IPH-15-BLK-128',
              externalRef: 'shopify-sku-123',
              status: 'active',
              isDefault: true,
              position: 1,
              attributes: { color: 'black', size: 'M' },
              options: { color: 'black', size: 'M' },
              inventory: {
                locations: {
                  NAIROBI: { onHand: 10, reserved: 2 },
                },
              },
              images: ['https://cdn.example.com/1.png'],
              requiresShipping: true,
              weight: 0.2,
              length: 10.5,
              width: 5.25,
              height: 2.75,
              dimensionUnit: 'cm',
              weightUnit: 'kg',
              metaJson: { preorder: true },
              prices: [
                {
                  priceListId: 'uuid',
                  unitPrice: 1999.99,
                  compareAtPrice: 2499.99,
                  minQuantity: 1,
                  maxQuantity: 10,
                  validFrom: '2025-01-01T00:00:00Z',
                  validTo: '2025-02-01T00:00:00Z',
                  metaJson: { reason: 'promo' },
                },
              ],
            },
          ],
          prices: [
            {
              priceListId: 'uuid',
              unitPrice: 1999.99,
              compareAtPrice: 2499.99,
              minQuantity: 1,
              maxQuantity: 10,
              validFrom: '2025-01-01T00:00:00Z',
              validTo: '2025-02-01T00:00:00Z',
              metaJson: { reason: 'promo' },
            },
          ],
          metaJson: {},
        },
        null,
        2
      )
    )
  }, [createMode, rawPayloadText])

  return (
    <AdminLayout
      title="Add Product"
      description="Create a product (v1) with options, availability, translations, SKUs, and prices."
      actions={
        <Link href="/axis/products">
          <Button variant="outline" size="sm">
            <CornerDownRight className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </Link>
      }
    >
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : loadError ? (
        <div className="text-sm text-destructive">{loadError}</div>
      ) : (
        <Tabs value={createMode} onValueChange={(v) => setCreateMode(v as any)}>
          <TabsList>
            <TabsTrigger value="guided">Guided</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON (v1)</TabsTrigger>
          </TabsList>

          <TabsContent value="guided" className="mt-4 space-y-4">
            <CreateV1Form
              brands={brands}
              categories={categories}
              token={accessToken}
              disabled={isSaving}
              onCreate={onCreateV1}
            />

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Extra fields (advanced)</CardTitle>
                <CardDescription>
                  Only include fields that are explicitly listed in Swagger for `ProductController_create_v1`. Unknown fields are rejected.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label>Extra fields (JSON object)</Label>
                <Textarea
                  value={extraFieldsText}
                  onChange={(e) => setExtraFieldsText(e.target.value)}
                  className={extraFieldsError ? 'min-h-[240px] font-mono text-xs border-destructive' : 'min-h-[240px] font-mono text-xs'}
                  placeholder={`{\n  "someSwaggerField": true\n}`}
                />
                {extraFieldsError ? <div className="text-xs text-destructive">{extraFieldsError}</div> : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create payload (Swagger v1)</CardTitle>
                <CardDescription>
                  Paste the exact request body from the Swagger docs. This will be sent as-is (except variant `id` keys are stripped).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Raw JSON payload</Label>
                  <Textarea
                    value={rawPayloadText}
                    onChange={(e) => setRawPayloadText(e.target.value)}
                    className={rawPayloadError ? 'min-h-[520px] font-mono text-xs border-destructive' : 'min-h-[520px] font-mono text-xs'}
                    placeholder="{ ... }"
                  />
                  {rawPayloadError ? <div className="text-xs text-destructive">{rawPayloadError}</div> : null}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    If your backend enforces more fields than the guided UI exposes, use this mode.
                  </div>
                  <Button onClick={saveRaw} disabled={isSaving}>
                    Create product
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </AdminLayout>
  )
}
