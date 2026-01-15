import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AxisField, AxisSection, AxisStat } from '@/components/admin/axis-ui'
import { cn } from '@/lib/utils'
import type { Brand, Category } from '@/types'
import type { CatalogProductStatus } from '@/types/catalog'
import { useChannels } from '@/hooks/use-channels'
import { useLocations } from '@/hooks/use-locations'
import { usePriceLists } from '@/hooks/use-pricing'
import { CommonUpload, type CommonUploadHandle } from '@/components/common/common-upload'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Globe,
  Images,
  Languages,
  Layers,
  Package,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

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
  availability: AvailabilityDraft
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

type ProductEditorDraft = {
  title: string
  description: string
  seoTitle: string
  seoDescription: string
  status: CatalogProductStatus
  slug: string
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

function uniq(list: string[]): string[] {
  return Array.from(new Set(list))
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
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

const blankPrice = (): PriceDraft => ({
  priceListId: '',
  unitPrice: '',
  compareAtPrice: '',
  minQuantity: '',
  maxQuantity: '',
  validFrom: '',
  validTo: '',
})

const blankAvailability = (): AvailabilityDraft => ({
  channels: [],
  countries: [],
  locations: [],
  stockType: 'FINITE',
  stockQuantity: '',
  startAt: '',
  endAt: '',
  timezone: 'UTC',
})

const blankSku = (): SkuDraft => ({
  title: '',
  sku: '',
  externalRef: '',
  status: 'active',
  isDefault: true,
  position: '1',
  options: {},
  availability: blankAvailability(),
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

function toDraft(product?: any): ProductEditorDraft {
  return {
    title: product?.title ?? '',
    description: product?.description ?? '',
    seoTitle: product?.seoTitle ?? '',
    seoDescription: product?.seoDescription ?? '',
    status: product?.status ?? 'draft',
    slug: product?.slug ?? '',
    externalRef: product?.externalRef ?? '',
    brandId: product?.brandId ?? '',
    categoryIds: Array.isArray(product?.categoryIds) ? [...product.categoryIds] : [],
    optionDefinitions: Array.isArray(product?.optionDefinitions)
      ? product.optionDefinitions.map((o: any) => ({
          key: o.key || '',
          label: o.label || '',
          allowedValues: Array.isArray(o.allowedValues) ? o.allowedValues : [],
          required: Boolean(o.required),
        }))
      : [],
    availability: product?.availability
      ? {
          channels: Array.isArray(product.availability.channels) ? product.availability.channels : [],
          countries: Array.isArray(product.availability.countries) ? product.availability.countries : [],
          locations: Array.isArray(product.availability.locations) ? product.availability.locations : [],
          stockType: product.availability.stock?.type === 'INFINITE' ? 'INFINITE' : 'FINITE',
          stockQuantity: typeof product.availability.stock?.quantity === 'number' ? String(product.availability.stock.quantity) : '',
          startAt: product.availability.schedule?.startAt || '',
          endAt: product.availability.schedule?.endAt || '',
          timezone: product.availability.schedule?.timezone || 'UTC',
        }
      : blankAvailability(),
    images: Array.isArray(product?.images) ? product.images : [],
    translations: Array.isArray(product?.translations) && product.translations.length
      ? product.translations.map((t: any) => ({ locale: t.locale || '', title: t.title || '', description: t.description || '' }))
      : [{ locale: 'en', title: '', description: '' }],
    skus: Array.isArray(product?.skus) && product.skus.length
      ? product.skus.map((s: any) => ({
          title: s.title || '',
          sku: s.sku || '',
          externalRef: s.externalRef || '',
          status: s.status || 'active',
          isDefault: Boolean(s.isDefault),
          position: typeof s.position === 'number' ? String(s.position) : '1',
          options: s.options && typeof s.options === 'object' ? s.options : {},
          availability: s.availability
            ? {
                channels: Array.isArray(s.availability.channels) ? s.availability.channels : [],
                countries: Array.isArray(s.availability.countries) ? s.availability.countries : [],
                locations: Array.isArray(s.availability.locations) ? s.availability.locations : [],
                stockType: s.availability.stock?.type === 'INFINITE' ? 'INFINITE' : 'FINITE',
                stockQuantity: typeof s.availability.stock?.quantity === 'number' ? String(s.availability.stock.quantity) : '',
                startAt: s.availability.schedule?.startAt || '',
                endAt: s.availability.schedule?.endAt || '',
                timezone: s.availability.schedule?.timezone || 'UTC',
              }
            : blankAvailability(),
          inventoryLocations: s.inventory?.locations
            ? Object.entries(s.inventory.locations).map(([code, row]: any) => ({
                code,
                onHand: row?.onHand !== undefined ? String(row.onHand) : '',
                reserved: row?.reserved !== undefined ? String(row.reserved) : '',
              }))
            : [{ code: '', onHand: '', reserved: '' }],
          images: Array.isArray(s.images) ? s.images : [],
          requiresShipping: typeof s.requiresShipping === 'boolean' ? s.requiresShipping : true,
          weight: s.weight !== undefined ? String(s.weight) : '',
          length: s.length !== undefined ? String(s.length) : '',
          width: s.width !== undefined ? String(s.width) : '',
          height: s.height !== undefined ? String(s.height) : '',
          dimensionUnit: s.dimensionUnit === 'in' ? 'in' : 'cm',
          weightUnit: s.weightUnit === 'lb' ? 'lb' : 'kg',
          prices: Array.isArray(s.prices)
            ? s.prices.map((p: any) => ({
                priceListId: p.priceListId || '',
                unitPrice: p.unitPrice !== undefined ? String(p.unitPrice) : '',
                compareAtPrice: p.compareAtPrice !== undefined ? String(p.compareAtPrice) : '',
                minQuantity: p.minQuantity !== undefined ? String(p.minQuantity) : '',
                maxQuantity: p.maxQuantity !== undefined ? String(p.maxQuantity) : '',
                validFrom: p.validFrom || '',
                validTo: p.validTo || '',
              }))
            : [],
        }))
      : [blankSku()],
    prices: Array.isArray(product?.prices)
      ? product.prices.map((p: any) => ({
          priceListId: p.priceListId || '',
          unitPrice: p.unitPrice !== undefined ? String(p.unitPrice) : '',
          compareAtPrice: p.compareAtPrice !== undefined ? String(p.compareAtPrice) : '',
          minQuantity: p.minQuantity !== undefined ? String(p.minQuantity) : '',
          maxQuantity: p.maxQuantity !== undefined ? String(p.maxQuantity) : '',
          validFrom: p.validFrom || '',
          validTo: p.validTo || '',
        }))
      : [],
  }
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
      <label className="text-sm font-medium">{props.label}</label>
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
      <label className="text-sm font-medium">{props.label}</label>
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

const tabs = [
  { key: 'basics', label: 'Basics', desc: 'Title, brand, categories' },
  { key: 'availability', label: 'Availability', desc: 'Channels, stock, schedule' },
  { key: 'options', label: 'Options', desc: 'Variants & attributes' },
  { key: 'media', label: 'Media', desc: 'Images & galleries' },
  { key: 'translations', label: 'Translations', desc: 'Locales & descriptions' },
  { key: 'skus', label: 'SKUs', desc: 'Inventory & pricing' },
  { key: 'pricing', label: 'Pricing', desc: 'Top-level prices' },
] as const

type TabKey = (typeof tabs)[number]['key']

export function ProductEditorV2(props: {
  mode: 'create' | 'edit'
  product?: any
  brands: Brand[]
  categories: Category[]
  token?: string
  isSaving?: boolean
  onSave: (payload: any) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [draft, setDraft] = useState<ProductEditorDraft>(() => toDraft(props.product))
  const [tab, setTab] = useState<TabKey>('basics')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const uploadRef = useRef<CommonUploadHandle | null>(null)
  const [pendingMediaCount, setPendingMediaCount] = useState(0)

  const { channels } = useChannels({ token: props.token })
  const { locations } = useLocations({ token: props.token })
  const { priceLists } = usePriceLists({ token: props.token })

  useEffect(() => {
    setDraft(toDraft(props.product))
    setErrors({})
    setIsDirty(false)
  }, [props.product?.id])

  const brandsSorted = useMemo(() => [...props.brands].sort((a, b) => a.name.localeCompare(b.name)), [props.brands])
  const categoriesSorted = useMemo(() => [...props.categories].sort((a, b) => a.name.localeCompare(b.name)), [props.categories])

  const locationOptions = useMemo(() => {
    type Loc = (typeof locations)[number]
    const byId = new Map<string, Loc>()
    const childrenByParent = new Map<string, Loc[]>()
    for (const l of locations) byId.set(l.id, l)

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

  const selectedCategories = useMemo(() => {
    const map = new Map(props.categories.map((c) => [c.id, c]))
    return draft.categoryIds.map((id) => map.get(id)).filter(Boolean) as { id: string; name: string }[]
  }, [draft.categoryIds, props.categories])

  const primaryTranslation = draft.translations[0]
  const hasPrimaryTranslation = Boolean(primaryTranslation?.locale.trim() && primaryTranslation?.title.trim())
  const hasSku = draft.skus.some((s) => s.sku.trim())
  const hasImages = draft.images.length > 0 || pendingMediaCount > 0
  const hasPricing = draft.prices.some((p) => p.priceListId.trim() && p.unitPrice.trim())
  const availabilityConfigured =
    draft.availability.channels.length ||
    draft.availability.countries.length ||
    draft.availability.locations.length ||
    draft.availability.stockQuantity.trim() ||
    draft.availability.startAt.trim() ||
    draft.availability.endAt.trim()

  const sectionStatus = useMemo(() => {
    const optionDefinitionsValid = draft.optionDefinitions.length
      ? draft.optionDefinitions.every((o) => o.key.trim() && o.label.trim())
      : true

    return {
      basics: {
        complete: Boolean(draft.title.trim()),
        error: Boolean(errors.title),
      },
      availability: {
        complete: Boolean(availabilityConfigured),
        error: Object.keys(errors).some((k) => k.startsWith('availability')),
      },
      options: {
        complete: optionDefinitionsValid,
        error: Object.keys(errors).some((k) => k.startsWith('options')),
      },
      media: {
        complete: hasImages,
        error: Object.keys(errors).some((k) => k.startsWith('images')),
      },
      translations: {
        complete: hasPrimaryTranslation,
        error: Boolean(errors.translations || errors['translations.0']),
      },
      skus: {
        complete: hasSku,
        error: Object.keys(errors).some((k) => k.startsWith('skus')),
      },
      pricing: {
        complete: hasPricing,
        error: Object.keys(errors).some((k) => k.startsWith('prices')),
      },
    }
  }, [availabilityConfigured, draft.optionDefinitions, draft.title, errors, hasImages, hasPricing, hasPrimaryTranslation, hasSku])

  const coreChecks = [
    { label: 'Title set', ok: Boolean(draft.title.trim()) },
    { label: 'Primary translation', ok: hasPrimaryTranslation },
    { label: 'At least one SKU', ok: hasSku },
  ]
  const optionalChecks = [
    { label: 'Images added', ok: hasImages, optional: true },
    { label: 'Pricing configured', ok: hasPricing, optional: true },
  ]
  const coreReadyCount = coreChecks.filter((c) => c.ok).length
  const coreProgress = Math.round((coreReadyCount / coreChecks.length) * 100)

  const setDefaultSkuIndex = (idx: number) => {
    setDraft((p) => ({ ...p, skus: p.skus.map((s, i) => ({ ...s, isDefault: i === idx })) }))
    setIsDirty(true)
  }

  const submit = async () => {
    const nextErrors: Record<string, string> = {}
    const title = draft.title.trim()
    if (!title) nextErrors.title = 'Title is required.'

    const translations = draft.translations
      .map((t) => ({ ...t, locale: t.locale.trim(), title: t.title.trim() }))
      .filter((t) => t.locale || t.title || t.description.trim())

    if (!translations.length) nextErrors.translations = 'At least one translation is required.'
    if (translations.length && (!translations[0].locale || !translations[0].title)) {
      nextErrors['translations.0'] = 'Primary translation requires locale and title.'
    }

    draft.skus.forEach((s, idx) => {
      const sku = s.sku.trim()
      if (!sku) nextErrors[`skus.${idx}.sku`] = 'SKU code is required.'
      if (draft.optionDefinitions.some((o) => o.required)) {
        for (const o of draft.optionDefinitions.filter((x) => x.required)) {
          const key = o.key.trim()
          if (!key) continue
          const v = (s.options?.[key] || '').trim()
          if (!v) nextErrors[`skus.${idx}.options.${key}`] = `${o.label || key} is required.`
        }
      }
    })

    if (!draft.skus.length) nextErrors.skus = 'At least one SKU is required.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      if (nextErrors.title) setTab('basics')
      else if (nextErrors.translations || nextErrors['translations.0']) setTab('translations')
      else if (Object.keys(nextErrors).some((k) => k.startsWith('availability'))) setTab('availability')
      else if (Object.keys(nextErrors).some((k) => k.startsWith('skus'))) setTab('skus')
      else if (Object.keys(nextErrors).some((k) => k.startsWith('prices'))) setTab('pricing')
      return
    }

    let uploadedUrls: string[] = []
    const pending = uploadRef.current?.getFiles() || []
    if (pending.length) {
      const result = await uploadRef.current!.upload()
      uploadedUrls = result.urls
    }

    const allImages = uniq([...draft.images.map((u) => u.trim()).filter(Boolean), ...uploadedUrls])
    if (uploadedUrls.length) {
      setDraft((p) => ({ ...p, images: allImages }))
    }

    const availabilityHasAny =
      draft.availability.channels.length ||
      draft.availability.countries.length ||
      draft.availability.locations.length ||
      draft.availability.stockQuantity.trim() ||
      draft.availability.startAt.trim() ||
      draft.availability.endAt.trim()

    const payload: any = {
      title,
      description: draft.description.trim() || undefined,
      seoTitle: draft.seoTitle.trim() || undefined,
      seoDescription: draft.seoDescription.trim() || undefined,
      status: draft.status,
      slug: draft.slug.trim() || undefined,
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

    const ensuredDefaultIndex = draft.skus.findIndex((s) => s.isDefault)
    const defaultIdx = ensuredDefaultIndex >= 0 ? ensuredDefaultIndex : 0
    payload.skus = draft.skus
      .map((s, idx) => {
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

        const skuAvailabilityHasAny =
          s.availability.channels.length ||
          s.availability.countries.length ||
          s.availability.locations.length ||
          s.availability.stockQuantity.trim() ||
          s.availability.startAt.trim() ||
          s.availability.endAt.trim()

        return {
          title: s.title.trim() || undefined,
          sku: s.sku.trim() || undefined,
          externalRef: s.externalRef.trim() || undefined,
          status: s.status,
          isDefault: idx === defaultIdx,
          position: intOrU(s.position) ?? undefined,
          attributes: options,
          options,
          availability: skuAvailabilityHasAny
            ? {
                channels: s.availability.channels,
                countries: s.availability.countries,
                locations: s.availability.locations,
                stock: {
                  type: s.availability.stockType,
                  ...(s.availability.stockType === 'FINITE' ? { quantity: intOrU(s.availability.stockQuantity) ?? 0 } : {}),
                },
                schedule: {
                  startAt: s.availability.startAt.trim() || undefined,
                  endAt: s.availability.endAt.trim() || undefined,
                  timezone: s.availability.timezone.trim() || 'UTC',
                },
                meta: {},
              }
            : undefined,
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
            .map((p) => ({
              priceListId: p.priceListId.trim() || undefined,
              unitPrice: numOrU(p.unitPrice),
              compareAtPrice: numOrU(p.compareAtPrice),
              minQuantity: intOrU(p.minQuantity),
              maxQuantity: intOrU(p.maxQuantity),
              validFrom: p.validFrom.trim() || undefined,
              validTo: p.validTo.trim() || undefined,
              metaJson: {},
            }))
            .filter((p) => p.priceListId && typeof p.unitPrice === 'number'),
        }
      })
      .filter((s: any) => s.sku || s.title)

    const topPrices = draft.prices
      .map((p) => ({
        priceListId: p.priceListId.trim() || undefined,
        unitPrice: numOrU(p.unitPrice),
        compareAtPrice: numOrU(p.compareAtPrice),
        minQuantity: intOrU(p.minQuantity),
        maxQuantity: intOrU(p.maxQuantity),
        validFrom: p.validFrom.trim() || undefined,
        validTo: p.validTo.trim() || undefined,
        metaJson: {},
      }))
      .filter((p) => p.priceListId && typeof p.unitPrice === 'number')

    if (topPrices.length) payload.prices = topPrices

    await props.onSave(payload)
    setIsDirty(false)
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="border-muted/60 bg-card/80 shadow-sm">
          <CardContent className="p-4 lg:p-6 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{props.mode === 'create' ? 'New product' : 'Edit product'}</Badge>
                  <Badge variant="secondary" className="capitalize">
                    {draft.status}
                  </Badge>
                  <AnimatePresence>
                    {isDirty ? (
                      <motion.div
                        key="dirty"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        <Badge variant="secondary">Unsaved</Badge>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  {pendingMediaCount ? (
                    <Badge variant="outline">{pendingMediaCount} pending upload{pendingMediaCount === 1 ? '' : 's'}</Badge>
                  ) : null}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">{draft.title.trim() || 'Untitled product'}</h2>
                  <p className="text-sm text-muted-foreground">
                    Build a complete catalog record with variants, pricing, availability, and localized copy.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={submit} disabled={props.isSaving || !isDirty}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                {props.onDelete ? (
                  <Button variant="outline" onClick={() => props.onDelete?.()} disabled={props.isSaving}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
            <Separator />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AxisStat
                label="Categories"
                value={draft.categoryIds.length}
                description="Assigned groups"
                icon={<Layers className="h-4 w-4" />}
              />
              <AxisStat
                label="Images"
                value={draft.images.length + pendingMediaCount}
                description={hasImages ? 'Media attached' : 'No media yet'}
                icon={<Images className="h-4 w-4" />}
              />
              <AxisStat
                label="SKUs"
                value={draft.skus.length}
                description={hasSku ? 'Variants defined' : 'Add at least one'}
                icon={<Package className="h-4 w-4" />}
              />
              <AxisStat
                label="Translations"
                value={draft.translations.length}
                description={hasPrimaryTranslation ? 'Primary ready' : 'Primary needed'}
                icon={<Languages className="h-4 w-4" />}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_320px]">
          <div className="order-2 lg:order-1">
            <Card className="lg:sticky lg:top-24">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sections</CardTitle>
                <CardDescription>Track completion and jump to updates.</CardDescription>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <ScrollArea className="max-h-[320px] sm:max-h-[420px] lg:max-h-[calc(100vh-10rem)]">
                  <TabsList className="flex h-auto w-full flex-col gap-1 bg-transparent p-0">
                    {tabs.map((item) => {
                      const status = sectionStatus[item.key]
                      const Icon = status.error ? AlertTriangle : status.complete ? CheckCircle2 : CircleDashed
                      const iconClass = status.error
                        ? 'text-destructive'
                        : status.complete
                          ? 'text-emerald-500'
                          : 'text-muted-foreground'

                      return (
                        <TabsTrigger
                          key={item.key}
                          value={item.key}
                          className={cn(
                            'w-full flex-none items-start justify-between gap-3 rounded-lg border border-transparent px-3 py-2 text-left',
                            'data-[state=active]:border-border data-[state=active]:bg-muted/60 data-[state=active]:shadow-sm'
                          )}
                        >
                          <span className="flex flex-col items-start">
                            <span className="text-sm font-medium">{item.label}</span>
                            <span className="text-xs text-muted-foreground">{item.desc}</span>
                          </span>
                          <span className="flex items-center gap-2 text-xs">
                            <Icon className={cn('h-4 w-4', iconClass)} />
                          </span>
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="order-1 lg:order-2 space-y-6">
            <TabsContent value="basics" className="mt-0">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <AxisSection
                  title="Basics"
                  description="Core identity, merchandising, and discovery metadata."
                  icon={<Layers className="h-4 w-4" />}
                >
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-6">
                      <AxisField label="Product title" required error={errors.title}>
                        <Input
                          value={draft.title}
                          onChange={(e) => {
                            setDraft((p) => ({ ...p, title: e.target.value }))
                            setIsDirty(true)
                          }}
                          placeholder="iPhone 15 Pro"
                          disabled={props.isSaving}
                        />
                      </AxisField>

                      <AxisField
                        label="Description"
                        description="Write a concise, benefit-led summary for listings and detail pages."
                      >
                        <Textarea
                          value={draft.description}
                          onChange={(e) => {
                            setDraft((p) => ({ ...p, description: e.target.value }))
                            setIsDirty(true)
                          }}
                          placeholder="Short product description…"
                          className="min-h-[120px]"
                          disabled={props.isSaving}
                        />
                      </AxisField>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <AxisField label="Status">
                          <Select
                            value={draft.status}
                            onValueChange={(v) => {
                              setDraft((p) => ({ ...p, status: v as CatalogProductStatus }))
                              setIsDirty(true)
                            }}
                            disabled={props.isSaving}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                        </AxisField>
                        <AxisField label="Slug" description="Used for product URLs and indexing.">
                          <div className="flex gap-2">
                            <Input
                              value={draft.slug}
                              onChange={(e) => {
                                setDraft((p) => ({ ...p, slug: e.target.value }))
                                setIsDirty(true)
                              }}
                              placeholder="iphone-15"
                              disabled={props.isSaving}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const nextSlug = slugify(draft.title || draft.slug)
                                setDraft((p) => ({ ...p, slug: nextSlug }))
                                setIsDirty(true)
                              }}
                              disabled={props.isSaving || !draft.title.trim()}
                            >
                              Generate
                            </Button>
                          </div>
                        </AxisField>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <AxisField label="Brand">
                          <Select
                            value={draft.brandId || '__none__'}
                            onValueChange={(v) => {
                              setDraft((p) => ({ ...p, brandId: v === '__none__' ? '' : v }))
                              setIsDirty(true)
                            }}
                            disabled={props.isSaving}
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
                        </AxisField>
                        <AxisField label="External reference" description="ERP, PIM, or legacy system ID.">
                          <Input
                            value={draft.externalRef}
                            onChange={(e) => {
                              setDraft((p) => ({ ...p, externalRef: e.target.value }))
                              setIsDirty(true)
                            }}
                            placeholder="erp-1234"
                            disabled={props.isSaving}
                          />
                        </AxisField>
                      </div>

                      <AxisField label="Categories" description="Assign categories to improve navigation and discovery.">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between" disabled={props.isSaving}>
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
                                        onSelect={() => {
                                          setDraft((p) => ({
                                            ...p,
                                            categoryIds: selected
                                              ? p.categoryIds.filter((x) => x !== c.id)
                                              : [...p.categoryIds, c.id],
                                          }))
                                          setIsDirty(true)
                                        }}
                                      >
                                        <div className={cn('flex-1', selected ? 'font-medium' : '')}>{c.name}</div>
                                        {selected ? <Badge variant="secondary">Selected</Badge> : null}
                                      </CommandItem>
                                    )
                                  })}
                                </ScrollArea>
                              </CommandList>
                              <div className="flex items-center justify-between border-t px-3 py-2">
                                <p className="text-xs text-muted-foreground">{draft.categoryIds.length} selected</p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={!draft.categoryIds.length}
                                  onClick={() => {
                                    setDraft((p) => ({ ...p, categoryIds: [] }))
                                    setIsDirty(true)
                                  }}
                                >
                                  Clear
                                </Button>
                              </div>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </AxisField>

                      {selectedCategories.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedCategories.map((c) => (
                            <Badge key={c.id} variant="secondary" className="gap-1">
                              {c.name}
                              <button
                                type="button"
                                className="ml-1 rounded-sm hover:bg-muted"
                                onClick={() => {
                                  setDraft((p) => ({
                                    ...p,
                                    categoryIds: p.categoryIds.filter((x) => x !== c.id),
                                  }))
                                  setIsDirty(true)
                                }}
                                aria-label={`Remove ${c.name}`}
                                disabled={props.isSaving}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                        <div>
                          <p className="text-sm font-medium">Search optimization</p>
                          <p className="text-xs text-muted-foreground">Control how the product appears in search previews.</p>
                        </div>
                        <AxisField label="SEO title">
                          <Input
                            value={draft.seoTitle}
                            onChange={(e) => {
                              setDraft((p) => ({ ...p, seoTitle: e.target.value }))
                              setIsDirty(true)
                            }}
                            placeholder="iPhone 15 | Shop"
                            disabled={props.isSaving}
                          />
                        </AxisField>
                        <AxisField label="SEO description">
                          <Input
                            value={draft.seoDescription}
                            onChange={(e) => {
                              setDraft((p) => ({ ...p, seoDescription: e.target.value }))
                              setIsDirty(true)
                            }}
                            placeholder="Flagship smartphone with pro-grade camera and long battery life."
                            disabled={props.isSaving}
                          />
                        </AxisField>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Globe className="h-4 w-4" />
                          Publishing targets
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Availability, channels, and scheduling are configured in the Availability section.
                        </p>
                      </div>
                    </div>
                  </div>
                </AxisSection>
              </motion.div>
            </TabsContent>

            <TabsContent value="media" className="mt-0">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <AxisSection
                  title="Media"
                  description="Product-level images used across listings and galleries."
                  icon={<Images className="h-4 w-4" />}
                >
                  {draft.images.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {draft.images.map((url) => (
                        <div key={url} className="group relative overflow-hidden rounded-lg border bg-muted/20">
                          <AspectRatio ratio={4 / 3}>
                            <img src={url} alt="Product" className="h-full w-full object-cover" />
                          </AspectRatio>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                            <p className="text-xs text-white/80 truncate">{url}</p>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="absolute right-2 top-2 rounded-full bg-background/90 p-1 text-muted-foreground shadow transition hover:text-foreground"
                                onClick={() => {
                                  setDraft((p) => ({ ...p, images: p.images.filter((x) => x !== url) }))
                                  setIsDirty(true)
                                }}
                                aria-label="Remove image"
                                disabled={props.isSaving}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>Remove image</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No images yet. Add hero and gallery shots for this product.
                    </div>
                  )}

                  <CommonUpload
                    ref={uploadRef}
                    mode="deferred"
                    label="Upload images"
                    description="Choose images now; they upload when you save."
                    folder="products"
                    multiple
                    accept="image/*"
                    imagesOnly
                    isPublic
                    token={props.token}
                    onFilesChange={(files) => {
                      setPendingMediaCount(files.length)
                      if (files.length) setIsDirty(true)
                    }}
                    onUploaded={() => {}}
                    disabled={props.isSaving}
                  />
                  <div className="text-xs text-muted-foreground">Pending uploads: {pendingMediaCount}</div>
                </AxisSection>
              </motion.div>
            </TabsContent>

            <TabsContent value="options" className="mt-0">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <AxisSection
                  title="Option definitions"
                  description="Define selectable options like color, size, storage, or material."
                  icon={<Layers className="h-4 w-4" />}
                  actions={
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setDraft((p) => ({
                          ...p,
                          optionDefinitions: [...p.optionDefinitions, { key: '', label: '', allowedValues: [], required: false }],
                        }))
                        setIsDirty(true)
                      }}
                      disabled={props.isSaving}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add option
                    </Button>
                  }
                >
                  {draft.optionDefinitions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No options defined.</div>
                  ) : (
                    <Accordion type="multiple" className="rounded-lg border bg-muted/20">
                      {draft.optionDefinitions.map((o, idx) => (
                        <AccordionItem key={idx} value={`option-${idx}`} className="border-b last:border-b-0">
                          <AccordionTrigger className="px-4">
                            <div className="flex w-full items-center justify-between">
                              <div className="flex flex-col items-start">
                                <span className="text-sm font-medium">{o.label || `Option #${idx + 1}`}</span>
                                <span className="text-xs text-muted-foreground">{o.key || 'No key yet'}</span>
                              </div>
                              {o.required ? <Badge variant="secondary">Required</Badge> : null}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium">Option details</div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setDraft((p) => ({
                                      ...p,
                                      optionDefinitions: p.optionDefinitions.filter((_, i) => i !== idx),
                                    }))
                                    setIsDirty(true)
                                  }}
                                  disabled={props.isSaving}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <AxisField label="Key" description="Used in APIs and SKU option mapping.">
                                  <Input
                                    value={o.key}
                                    onChange={(e) => {
                                      setDraft((p) => ({
                                        ...p,
                                        optionDefinitions: p.optionDefinitions.map((x, i) =>
                                          i === idx ? { ...x, key: e.target.value } : x,
                                        ),
                                      }))
                                      setIsDirty(true)
                                    }}
                                    placeholder="color"
                                    disabled={props.isSaving}
                                  />
                                </AxisField>
                                <AxisField label="Label" description="Customer-facing option name.">
                                  <Input
                                    value={o.label}
                                    onChange={(e) => {
                                      setDraft((p) => ({
                                        ...p,
                                        optionDefinitions: p.optionDefinitions.map((x, i) =>
                                          i === idx ? { ...x, label: e.target.value } : x,
                                        ),
                                      }))
                                      setIsDirty(true)
                                    }}
                                    placeholder="Color"
                                    disabled={props.isSaving}
                                  />
                                </AxisField>
                              </div>

                              <TagInput
                                label="Allowed values"
                                values={o.allowedValues}
                                onChange={(allowedValues) => {
                                  setDraft((p) => ({
                                    ...p,
                                    optionDefinitions: p.optionDefinitions.map((x, i) =>
                                      i === idx ? { ...x, allowedValues } : x,
                                    ),
                                  }))
                                  setIsDirty(true)
                                }}
                                placeholder="black"
                                disabled={props.isSaving}
                              />

                              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                <div>
                                  <div className="text-sm font-medium">Required</div>
                                  <div className="text-xs text-muted-foreground">Must be selected for SKUs.</div>
                                </div>
                                <Switch
                                  checked={o.required}
                                  onCheckedChange={(required) => {
                                    setDraft((p) => ({
                                      ...p,
                                      optionDefinitions: p.optionDefinitions.map((x, i) =>
                                        i === idx ? { ...x, required } : x,
                                      ),
                                    }))
                                    setIsDirty(true)
                                  }}
                                  disabled={props.isSaving}
                                />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </AxisSection>
              </motion.div>
            </TabsContent>

            <TabsContent value="availability" className="mt-0">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <AxisSection
                  title="Availability"
                  description="Control channels, regions, stock policy, and scheduling."
                  icon={<Globe className="h-4 w-4" />}
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <MultiSelectAdd
                      label="Channels"
                      values={draft.availability.channels}
                      onChange={(channels) => {
                        setDraft((p) => ({ ...p, availability: { ...p.availability, channels } }))
                        setIsDirty(true)
                      }}
                      placeholder="Select a channel"
                      helperText="Choose one or more channels"
                      disabled={props.isSaving}
                      options={channels.map((c) => ({ value: c.code, label: c.name, disabled: c.isActive === false }))}
                    />
                    <TagInput
                      label="Countries"
                      values={draft.availability.countries}
                      onChange={(countries) => {
                        setDraft((p) => ({ ...p, availability: { ...p.availability, countries } }))
                        setIsDirty(true)
                      }}
                      placeholder="KE"
                      helperText="ISO-2 codes, e.g. KE, TZ"
                      disabled={props.isSaving}
                    />
                    <MultiSelectAdd
                      label="Locations"
                      values={draft.availability.locations}
                      onChange={(locs) => {
                        setDraft((p) => ({ ...p, availability: { ...p.availability, locations: locs } }))
                        setIsDirty(true)
                      }}
                      onAdd={(code) => {
                        setDraft((p) => {
                          const nextLocations = p.availability.locations.includes(code)
                            ? p.availability.locations
                            : [...p.availability.locations, code]
                          const country = String((locationByCode.get(code) as any)?.countryCode ?? '').trim()
                          const nextCountries = country ? uniq([...p.availability.countries, country]) : p.availability.countries
                          return { ...p, availability: { ...p.availability, locations: nextLocations, countries: nextCountries } }
                        })
                        setIsDirty(true)
                      }}
                      placeholder="Select a location"
                      helperText="Choosing a location auto-adds its country (when available)"
                      disabled={props.isSaving}
                      options={locationOptions.map((o) => ({ value: o.value, label: o.label }))}
                    />
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <AxisField label="Stock type">
                      <Select
                        value={draft.availability.stockType}
                        onValueChange={(v) => {
                          setDraft((p) => ({ ...p, availability: { ...p.availability, stockType: v as any } }))
                          setIsDirty(true)
                        }}
                        disabled={props.isSaving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FINITE">FINITE</SelectItem>
                          <SelectItem value="INFINITE">INFINITE</SelectItem>
                        </SelectContent>
                      </Select>
                    </AxisField>
                    <AxisField label="Stock quantity" description="Required for FINITE inventory.">
                      <Input
                        type="number"
                        min={0}
                        value={draft.availability.stockQuantity}
                        onChange={(e) => {
                          setDraft((p) => ({ ...p, availability: { ...p.availability, stockQuantity: e.target.value } }))
                          setIsDirty(true)
                        }}
                        disabled={props.isSaving || draft.availability.stockType !== 'FINITE'}
                        placeholder="20"
                      />
                    </AxisField>
                    <AxisField label="Timezone">
                      <Input
                        value={draft.availability.timezone}
                        onChange={(e) => {
                          setDraft((p) => ({ ...p, availability: { ...p.availability, timezone: e.target.value } }))
                          setIsDirty(true)
                        }}
                        placeholder="UTC"
                        disabled={props.isSaving}
                      />
                    </AxisField>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <AxisField label="Start at">
                      <Input
                        type="datetime-local"
                        value={toDateTimeLocalValue(draft.availability.startAt)}
                        onChange={(e) => {
                          setDraft((p) => ({
                            ...p,
                            availability: { ...p.availability, startAt: fromDateTimeLocalValue(e.target.value) },
                          }))
                          setIsDirty(true)
                        }}
                        disabled={props.isSaving}
                      />
                    </AxisField>
                    <AxisField label="End at">
                      <Input
                        type="datetime-local"
                        value={toDateTimeLocalValue(draft.availability.endAt)}
                        onChange={(e) => {
                          setDraft((p) => ({
                            ...p,
                            availability: { ...p.availability, endAt: fromDateTimeLocalValue(e.target.value) },
                          }))
                          setIsDirty(true)
                        }}
                        disabled={props.isSaving}
                      />
                    </AxisField>
                  </div>
                </AxisSection>
              </motion.div>
            </TabsContent>

            <TabsContent value="translations" className="mt-0">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <AxisSection
                  title="Translations"
                  description="Localized titles and descriptions for global catalogs."
                  icon={<Languages className="h-4 w-4" />}
                  actions={
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setDraft((p) => ({
                          ...p,
                          translations: [...p.translations, { locale: '', title: '', description: '' }],
                        }))
                        setIsDirty(true)
                      }}
                      disabled={props.isSaving}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add translation
                    </Button>
                  }
                >
                  {errors.translations || errors['translations.0'] ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      {errors.translations || errors['translations.0']}
                    </div>
                  ) : null}

                  <Accordion type="multiple" defaultValue={['translation-0']} className="rounded-lg border bg-muted/20">
                    {draft.translations.map((t, idx) => (
                      <AccordionItem key={idx} value={`translation-${idx}`} className="border-b last:border-b-0">
                        <AccordionTrigger className="px-4">
                          <div className="flex w-full items-center justify-between">
                            <div className="flex flex-col items-start">
                              <span className="text-sm font-medium">{idx === 0 ? 'Primary translation' : `Translation #${idx + 1}`}</span>
                              <span className="text-xs text-muted-foreground">
                                {t.locale || 'Locale'} • {t.title || 'Title'}
                              </span>
                            </div>
                            {idx === 0 ? <Badge variant="secondary">Primary</Badge> : null}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={props.isSaving || draft.translations.length <= 1}
                                onClick={() => {
                                  setDraft((p) => ({
                                    ...p,
                                    translations: p.translations.filter((_, i) => i !== idx),
                                  }))
                                  setIsDirty(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <AxisField label="Locale" description="ISO language code, e.g. en, fr, sw.">
                                <Input
                                  value={t.locale}
                                  onChange={(e) => {
                                    setDraft((p) => ({
                                      ...p,
                                      translations: p.translations.map((x, i) => (i === idx ? { ...x, locale: e.target.value } : x)),
                                    }))
                                    setIsDirty(true)
                                  }}
                                  placeholder="en"
                                  disabled={props.isSaving}
                                />
                              </AxisField>
                              <AxisField label="Title">
                                <Input
                                  value={t.title}
                                  onChange={(e) => {
                                    setDraft((p) => ({
                                      ...p,
                                      translations: p.translations.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                                    }))
                                    setIsDirty(true)
                                  }}
                                  placeholder="iPhone 15"
                                  disabled={props.isSaving}
                                />
                              </AxisField>
                            </div>

                            <AxisField label="Description">
                              <Textarea
                                value={t.description}
                                onChange={(e) => {
                                  setDraft((p) => ({
                                    ...p,
                                    translations: p.translations.map((x, i) =>
                                      i === idx ? { ...x, description: e.target.value } : x,
                                    ),
                                  }))
                                  setIsDirty(true)
                                }}
                                placeholder="Localized description"
                                disabled={props.isSaving}
                              />
                            </AxisField>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </AxisSection>
              </motion.div>
            </TabsContent>

            <TabsContent value="skus" className="mt-0">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <AxisSection
                  title="SKUs"
                  description="Variants, inventory hooks, and SKU-level details."
                  icon={<Package className="h-4 w-4" />}
                  actions={
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setDraft((p) => ({ ...p, skus: [...p.skus, { ...blankSku(), isDefault: p.skus.length === 0 }] }))
                        setIsDirty(true)
                      }}
                      disabled={props.isSaving}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add SKU
                    </Button>
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Mark one SKU as default.</div>
                  </div>

                  {errors.skus ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      {errors.skus}
                    </div>
                  ) : null}

                  <Accordion type="multiple" className="rounded-lg border bg-muted/20">
                    {draft.skus.map((s, idx) => (
                      <AccordionItem key={idx} value={`sku-${idx}`} className="border-b last:border-b-0">
                        <AccordionTrigger className="px-4">
                          <div className="flex w-full items-center justify-between">
                            <div className="flex flex-col items-start">
                              <span className="text-sm font-medium">SKU #{idx + 1}</span>
                              <span className="text-xs text-muted-foreground">
                                {s.sku || 'No SKU yet'} • {s.title || 'No title'}
                              </span>
                            </div>
                            {s.isDefault ? <Badge>Default</Badge> : <Badge variant="secondary">Secondary</Badge>}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-medium">Identifiers</div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDefaultSkuIndex(idx)}
                                  disabled={props.isSaving || s.isDefault}
                                >
                                  Set default
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setDraft((p) => ({ ...p, skus: p.skus.filter((_, i) => i !== idx) }))
                                    setIsDirty(true)
                                  }}
                                  disabled={props.isSaving}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <AxisField label="Title">
                                <Input
                                  value={s.title}
                                  onChange={(e) => {
                                    setDraft((p) => ({
                                      ...p,
                                      skus: p.skus.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                                    }))
                                    setIsDirty(true)
                                  }}
                                  placeholder="Black / 128 GB"
                                  disabled={props.isSaving}
                                />
                              </AxisField>
                              <AxisField label="SKU" required error={errors[`skus.${idx}.sku`]}>
                                <Input
                                  value={s.sku}
                                  onChange={(e) => {
                                    setDraft((p) => ({
                                      ...p,
                                      skus: p.skus.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)),
                                    }))
                                    setIsDirty(true)
                                  }}
                                  placeholder="IPH-15-BLK-128"
                                  disabled={props.isSaving}
                                />
                              </AxisField>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <AxisField label="External ref">
                                <Input
                                  value={s.externalRef}
                                  onChange={(e) => {
                                    setDraft((p) => ({
                                      ...p,
                                      skus: p.skus.map((x, i) => (i === idx ? { ...x, externalRef: e.target.value } : x)),
                                    }))
                                    setIsDirty(true)
                                  }}
                                  placeholder="shopify-sku-123"
                                  disabled={props.isSaving}
                                />
                              </AxisField>
                              <AxisField label="Position">
                                <Input
                                  type="number"
                                  min={1}
                                  value={s.position}
                                  onChange={(e) => {
                                    setDraft((p) => ({
                                      ...p,
                                      skus: p.skus.map((x, i) => (i === idx ? { ...x, position: e.target.value } : x)),
                                    }))
                                    setIsDirty(true)
                                  }}
                                  disabled={props.isSaving}
                                />
                              </AxisField>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <AxisField label="Status">
                                <Select
                                  value={s.status}
                                  onValueChange={(value) => {
                                    setDraft((p) => ({
                                      ...p,
                                      skus: p.skus.map((x, i) => (i === idx ? { ...x, status: value as any } : x)),
                                    }))
                                    setIsDirty(true)
                                  }}
                                  disabled={props.isSaving}
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
                              </AxisField>
                              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                <div>
                                  <div className="text-sm font-medium">Requires shipping</div>
                                </div>
                                <Switch
                                  checked={s.requiresShipping}
                                  onCheckedChange={(requiresShipping) => {
                                    setDraft((p) => ({
                                      ...p,
                                      skus: p.skus.map((x, i) => (i === idx ? { ...x, requiresShipping } : x)),
                                    }))
                                    setIsDirty(true)
                                  }}
                                  disabled={props.isSaving}
                                />
                              </div>
                            </div>

                            {draft.optionDefinitions.length ? (
                              <div className="space-y-3">
                                <div className="text-sm font-medium">Option values</div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                  {draft.optionDefinitions.map((o) => {
                                    const key = o.key.trim()
                                    if (!key) return null
                                    const value = s.options?.[key] || ''
                                    const fieldError = errors[`skus.${idx}.options.${key}`]

                                    return (
                                      <AxisField key={key} label={o.label || key} required={o.required} error={fieldError}>
                                        {o.allowedValues.length ? (
                                          <Select
                                            value={value}
                                            onValueChange={(nextValue) => {
                                              setDraft((p) => ({
                                                ...p,
                                                skus: p.skus.map((x, i) =>
                                                  i === idx
                                                    ? { ...x, options: { ...x.options, [key]: nextValue } }
                                                    : x,
                                                ),
                                              }))
                                              setIsDirty(true)
                                            }}
                                            disabled={props.isSaving}
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder={`Select ${o.label || key}`} />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {o.allowedValues.map((val) => (
                                                <SelectItem key={val} value={val}>
                                                  {val}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        ) : (
                                          <Input
                                            value={value}
                                            onChange={(e) => {
                                              setDraft((p) => ({
                                                ...p,
                                                skus: p.skus.map((x, i) =>
                                                  i === idx
                                                    ? { ...x, options: { ...x.options, [key]: e.target.value } }
                                                    : x,
                                                ),
                                              }))
                                              setIsDirty(true)
                                            }}
                                            placeholder={`Enter ${o.label || key}`}
                                            disabled={props.isSaving}
                                          />
                                        )}
                                      </AxisField>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : null}

                            <div className="space-y-3">
                              <div className="text-sm font-medium">Shipping & dimensions</div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <AxisField label="Weight">
                                  <div className="flex gap-2">
                                    <Input
                                      type="number"
                                      value={s.weight}
                                      onChange={(e) => {
                                        setDraft((p) => ({
                                          ...p,
                                          skus: p.skus.map((x, i) => (i === idx ? { ...x, weight: e.target.value } : x)),
                                        }))
                                        setIsDirty(true)
                                      }}
                                      disabled={props.isSaving}
                                    />
                                    <Select
                                      value={s.weightUnit}
                                      onValueChange={(value) => {
                                        setDraft((p) => ({
                                          ...p,
                                          skus: p.skus.map((x, i) => (i === idx ? { ...x, weightUnit: value as any } : x)),
                                        }))
                                        setIsDirty(true)
                                      }}
                                      disabled={props.isSaving}
                                    >
                                      <SelectTrigger className="w-[96px]">
                                        <SelectValue placeholder="Unit" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="kg">kg</SelectItem>
                                        <SelectItem value="lb">lb</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </AxisField>
                                <AxisField label="Dimension unit">
                                  <Select
                                    value={s.dimensionUnit}
                                    onValueChange={(value) => {
                                      setDraft((p) => ({
                                        ...p,
                                        skus: p.skus.map((x, i) => (i === idx ? { ...x, dimensionUnit: value as any } : x)),
                                      }))
                                      setIsDirty(true)
                                    }}
                                    disabled={props.isSaving}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="cm">cm</SelectItem>
                                      <SelectItem value="in">in</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </AxisField>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-3">
                                <AxisField label="Length">
                                  <Input
                                    type="number"
                                    value={s.length}
                                    onChange={(e) => {
                                      setDraft((p) => ({
                                        ...p,
                                        skus: p.skus.map((x, i) => (i === idx ? { ...x, length: e.target.value } : x)),
                                      }))
                                      setIsDirty(true)
                                    }}
                                    disabled={props.isSaving}
                                  />
                                </AxisField>
                                <AxisField label="Width">
                                  <Input
                                    type="number"
                                    value={s.width}
                                    onChange={(e) => {
                                      setDraft((p) => ({
                                        ...p,
                                        skus: p.skus.map((x, i) => (i === idx ? { ...x, width: e.target.value } : x)),
                                      }))
                                      setIsDirty(true)
                                    }}
                                    disabled={props.isSaving}
                                  />
                                </AxisField>
                                <AxisField label="Height">
                                  <Input
                                    type="number"
                                    value={s.height}
                                    onChange={(e) => {
                                      setDraft((p) => ({
                                        ...p,
                                        skus: p.skus.map((x, i) => (i === idx ? { ...x, height: e.target.value } : x)),
                                      }))
                                      setIsDirty(true)
                                    }}
                                    disabled={props.isSaving}
                                  />
                                </AxisField>
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </AxisSection>
              </motion.div>
            </TabsContent>

            <TabsContent value="pricing" className="mt-0">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <AxisSection
                  title="Product pricing"
                  description="Top-level prices used when SKU pricing is missing."
                  icon={<Sparkles className="h-4 w-4" />}
                  actions={
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setDraft((p) => ({ ...p, prices: [...p.prices, blankPrice()] }))
                        setIsDirty(true)
                      }}
                      disabled={props.isSaving}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add price
                    </Button>
                  }
                >
                  {draft.prices.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No product prices.</div>
                  ) : (
                    <div className="space-y-4">
                      {draft.prices.map((pRow, idx) => (
                        <div key={idx} className="rounded-lg border bg-muted/20 p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">Price #{idx + 1}</div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDraft((p) => ({ ...p, prices: p.prices.filter((_, i) => i !== idx) }))
                                setIsDirty(true)
                              }}
                              disabled={props.isSaving}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-3">
                            <AxisField label="Price list" required>
                              <Select
                                value={pRow.priceListId}
                                onValueChange={(value) => {
                                  setDraft((p) => ({
                                    ...p,
                                    prices: p.prices.map((x, i) => (i === idx ? { ...x, priceListId: value } : x)),
                                  }))
                                  setIsDirty(true)
                                }}
                                disabled={props.isSaving}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {priceLists.map((pl) => (
                                    <SelectItem key={pl.id} value={pl.id}>
                                      {pl.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </AxisField>
                            <AxisField label="Unit price" required>
                              <Input
                                type="number"
                                value={pRow.unitPrice}
                                onChange={(e) => {
                                  setDraft((p) => ({
                                    ...p,
                                    prices: p.prices.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)),
                                  }))
                                  setIsDirty(true)
                                }}
                                disabled={props.isSaving}
                              />
                            </AxisField>
                            <AxisField label="Compare at">
                              <Input
                                type="number"
                                value={pRow.compareAtPrice}
                                onChange={(e) => {
                                  setDraft((p) => ({
                                    ...p,
                                    prices: p.prices.map((x, i) => (i === idx ? { ...x, compareAtPrice: e.target.value } : x)),
                                  }))
                                  setIsDirty(true)
                                }}
                                disabled={props.isSaving}
                              />
                            </AxisField>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AxisSection>
              </motion.div>
            </TabsContent>
          </div>

          <div className="order-3 space-y-4 2xl:sticky 2xl:top-24">
            <Card className="border-muted/60 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Readiness</CardTitle>
                <CardDescription>Core checks before publishing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Core readiness</span>
                    <Badge variant={coreProgress === 100 ? 'default' : 'secondary'}>{coreProgress}%</Badge>
                  </div>
                  <Progress value={coreProgress} />
                  <p className="text-xs text-muted-foreground">
                    {coreReadyCount} of {coreChecks.length} core checks complete.
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  {[...coreChecks, ...optionalChecks].map((check) => (
                    <div key={check.label} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2">
                        {check.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : check.optional ? (
                          <CircleDashed className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                        {check.label}
                      </span>
                      {check.optional ? (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">
                          Optional
                        </Badge>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-muted/60 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Friendly tips</CardTitle>
                <CardDescription>Optimise for conversion and operations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4" />
                  <span>Use benefit-led titles and keep descriptions under 2 short paragraphs.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4" />
                  <span>Add at least 3 images to improve shopper confidence and conversion.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4" />
                  <span>Align SKU codes with your ERP or warehouse naming conventions.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
