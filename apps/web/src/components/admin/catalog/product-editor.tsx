import { useEffect, useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'
import type { Brand, Category } from '@/types'
import type {
  CatalogProductAvailability,
  CatalogProductOptionDefinition,
  CatalogProductPrice,
  CatalogProductSku,
  CatalogProductStatus,
  CatalogProductTranslation,
} from '@/types/catalog'
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from 'lucide-react'

type CatalogProductType = string
type CatalogFulfillmentClass = string

type TranslationDraft = any

type VariantDraft = {
  id?: string
  sku: string
  title?: string
  isDefault?: boolean
  fulfillmentClass?: CatalogFulfillmentClass
  requiresShipping?: boolean
  weightKg?: string
  lengthCm?: string
  widthCm?: string
  heightCm?: string
  allowBackorder?: boolean
  allowPreorder?: boolean
  metaJsonText?: string
}

type ProductEditorDraftV1 = {
  title: string
  description: string
  seoTitle: string
  seoDescription: string
  status: CatalogProductStatus
  slug: string
  externalRef: string
  brandId: string
  categoryIdsText: string
  imagesText: string
  translationsText: string
  optionDefinitionsText: string
  availabilityText: string
  skusText: string
  pricesText: string
  metaJsonText: string
}

function toDraftV1(product?: any): ProductEditorDraftV1 {
  const translations = Array.isArray(product?.translations) && product.translations.length ? product.translations : [{ locale: 'en', title: '' }]
  const optionDefinitions = Array.isArray(product?.optionDefinitions) ? product.optionDefinitions : []
  const availability = product?.availability ?? {}
  const skus = Array.isArray(product?.skus) ? product.skus : []
  const prices = Array.isArray(product?.prices) ? product.prices : []
  const metaJson = product?.metaJson ?? {}

  return {
    title: product?.title ?? '',
    description: product?.description ?? '',
    seoTitle: product?.seoTitle ?? '',
    seoDescription: product?.seoDescription ?? '',
    status: product?.status ?? 'draft',
    slug: product?.slug ?? '',
    externalRef: product?.externalRef ?? '',
    brandId: product?.brandId ?? '',
    categoryIdsText: Array.isArray(product?.categoryIds) ? product.categoryIds.join(', ') : '',
    imagesText: Array.isArray(product?.images)
      ? product.images
          .map((img: any) => (typeof img === 'string' ? img : img?.url))
          .filter(Boolean)
          .join(', ')
      : '',
    translationsText: JSON.stringify(translations, null, 2),
    optionDefinitionsText: JSON.stringify(optionDefinitions, null, 2),
    availabilityText: JSON.stringify(availability, null, 2),
    skusText: JSON.stringify(skus, null, 2),
    pricesText: JSON.stringify(prices, null, 2),
    metaJsonText: JSON.stringify(metaJson, null, 2),
  }
}

export function ProductEditor(props: {
  mode: 'create' | 'edit'
  product?: any
  brands: Brand[]
  categories: Category[]
  isSaving?: boolean
  onSave: (payload: {
    title: string
    status: CatalogProductStatus
    description?: string
    seoTitle?: string
    seoDescription?: string
    slug?: string
    externalRef?: string
    brandId?: string | null
    categoryIds?: string[]
    images?: string[]
    translations?: CatalogProductTranslation[]
    optionDefinitions?: CatalogProductOptionDefinition[]
    availability?: CatalogProductAvailability
    skus?: CatalogProductSku[]
    prices?: CatalogProductPrice[]
    metaJson?: any
  }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [draft, setDraft] = useState<ProductEditorDraftV1>(() => toDraftV1(props.product))
  const [isDirty, setIsDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setDraft(toDraftV1(props.product))
    setIsDirty(false)
    setErrors({})
  }, [props.product?.id])

  const brandOptions = useMemo(() => [...props.brands].sort((a, b) => a.name.localeCompare(b.name)), [props.brands])
  const categoryOptions = useMemo(() => [...props.categories].sort((a, b) => a.name.localeCompare(b.name)), [props.categories])

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {}
    if (!draft.title.trim()) nextErrors.title = 'Title is required.'

    const translations = parseJson(draft.translationsText)
    if (!translations || !Array.isArray(translations)) nextErrors.translations = 'Translations JSON must be an array.'

    const optionDefinitions = parseJson(draft.optionDefinitionsText)
    if (optionDefinitions === null || (optionDefinitions && !Array.isArray(optionDefinitions))) {
      nextErrors.optionDefinitions = 'Option definitions JSON must be an array.'
    }

    const availability = parseJson(draft.availabilityText)
    if (availability === null || (availability && typeof availability !== 'object')) {
      nextErrors.availability = 'Availability JSON must be an object.'
    }

    const skus = parseJson(draft.skusText)
    if (skus === null || (skus && !Array.isArray(skus))) {
      nextErrors.skus = 'SKUs JSON must be an array.'
    }

    const prices = parseJson(draft.pricesText)
    if (prices === null || (prices && !Array.isArray(prices))) {
      nextErrors.prices = 'Prices JSON must be an array.'
    }

    const metaJson = parseJson(draft.metaJsonText)
    if (metaJson === null || (metaJson && typeof metaJson !== 'object')) {
      nextErrors.metaJson = 'Meta JSON must be an object.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    const categoryIds = draft.categoryIdsText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    const images = draft.imagesText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)

    await props.onSave({
      title: draft.title.trim(),
      status: draft.status,
      description: draft.description.trim() || undefined,
      seoTitle: draft.seoTitle.trim() || undefined,
      seoDescription: draft.seoDescription.trim() || undefined,
      slug: draft.slug.trim() || undefined,
      externalRef: draft.externalRef.trim() || undefined,
      brandId: draft.brandId.trim() || null,
      categoryIds: categoryIds.length ? categoryIds : undefined,
      images: images.length ? images : undefined,
      translations: Array.isArray(translations) ? translations : undefined,
      optionDefinitions: Array.isArray(optionDefinitions) ? optionDefinitions : undefined,
      availability: availability && typeof availability === 'object' ? availability : undefined,
      skus: Array.isArray(skus) ? skus : undefined,
      prices: Array.isArray(prices) ? prices : undefined,
      metaJson: metaJson && typeof metaJson === 'object' ? metaJson : undefined,
    })

    setIsDirty(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{props.mode === 'create' ? 'New' : 'Edit'}</Badge>
          {isDirty ? <Badge variant="secondary">Unsaved</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={props.isSaving || !isDirty}>
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>Title, slug, status, brand, and categories.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={draft.title}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, title: e.target.value }))
                  setIsDirty(true)
                }}
                placeholder="e.g. iPhone 15"
              />
              {errors.title ? <div className="text-xs text-destructive">{errors.title}</div> : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug</label>
              <Input
                value={draft.slug}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, slug: e.target.value }))
                  setIsDirty(true)
                }}
                placeholder="e.g. iphone-15"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={draft.status}
                onValueChange={(v) => {
                  setDraft((p) => ({ ...p, status: v as CatalogProductStatus }))
                  setIsDirty(true)
                }}
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
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand</label>
              <Select
                value={draft.brandId || '__none__'}
                onValueChange={(v) => {
                  setDraft((p) => ({ ...p, brandId: v === '__none__' ? '' : v }))
                  setIsDirty(true)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select brand (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No brand</SelectItem>
                  {brandOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">External Ref</label>
              <Input
                value={draft.externalRef}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, externalRef: e.target.value }))
                  setIsDirty(true)
                }}
                placeholder="e.g. erp-1234"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categories (comma separated IDs)</label>
              <Input
                value={draft.categoryIdsText}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, categoryIdsText: e.target.value }))
                  setIsDirty(true)
                }}
                placeholder={categoryOptions.slice(0, 3).map((c) => c.id).join(', ')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={draft.description}
              onChange={(e) => {
                setDraft((p) => ({ ...p, description: e.target.value }))
                setIsDirty(true)
              }}
              placeholder="Short product description"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">SEO title</label>
              <Input
                value={draft.seoTitle}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, seoTitle: e.target.value }))
                  setIsDirty(true)
                }}
                placeholder="e.g. iPhone 15 | Shop"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">SEO description</label>
              <Input
                value={draft.seoDescription}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, seoDescription: e.target.value }))
                  setIsDirty(true)
                }}
                placeholder="Flagship smartphone with pro-grade camera and long battery life."
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Images (comma separated URLs)</label>
            <Textarea
              value={draft.imagesText}
              onChange={(e) => {
                setDraft((p) => ({ ...p, imagesText: e.target.value }))
                setIsDirty(true)
              }}
              placeholder="https://cdn.example.com/image-1.png, https://cdn.example.com/image-2.png"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="translations" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="translations">Translations</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="skus">SKUs</TabsTrigger>
          <TabsTrigger value="prices">Prices</TabsTrigger>
          <TabsTrigger value="meta">Meta</TabsTrigger>
        </TabsList>

        <TabsContent value="translations">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Translations</CardTitle>
              <CardDescription>JSON array of locale, title, description, metaJson.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={draft.translationsText}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, translationsText: e.target.value }))
                  setIsDirty(true)
                }}
                className="min-h-[220px] font-mono text-xs"
              />
              {errors.translations ? <div className="text-xs text-destructive">{errors.translations}</div> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="options">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Option definitions</CardTitle>
              <CardDescription>JSON array of option definitions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={draft.optionDefinitionsText}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, optionDefinitionsText: e.target.value }))
                  setIsDirty(true)
                }}
                className="min-h-[200px] font-mono text-xs"
              />
              {errors.optionDefinitions ? <div className="text-xs text-destructive">{errors.optionDefinitions}</div> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Availability</CardTitle>
              <CardDescription>JSON object for channels, countries, stock, and schedule.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={draft.availabilityText}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, availabilityText: e.target.value }))
                  setIsDirty(true)
                }}
                className="min-h-[200px] font-mono text-xs"
              />
              {errors.availability ? <div className="text-xs text-destructive">{errors.availability}</div> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skus">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>SKUs</CardTitle>
              <CardDescription>JSON array of SKU objects with prices, inventory, and options.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={draft.skusText}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, skusText: e.target.value }))
                  setIsDirty(true)
                }}
                className="min-h-[260px] font-mono text-xs"
              />
              {errors.skus ? <div className="text-xs text-destructive">{errors.skus}</div> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prices">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Product prices</CardTitle>
              <CardDescription>JSON array of price list entries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={draft.pricesText}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, pricesText: e.target.value }))
                  setIsDirty(true)
                }}
                className="min-h-[200px] font-mono text-xs"
              />
              {errors.prices ? <div className="text-xs text-destructive">{errors.prices}</div> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Meta JSON</CardTitle>
              <CardDescription>Optional metadata object.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={draft.metaJsonText}
                onChange={(e) => {
                  setDraft((p) => ({ ...p, metaJsonText: e.target.value }))
                  setIsDirty(true)
                }}
                className="min-h-[180px] font-mono text-xs"
              />
              {errors.metaJson ? <div className="text-xs text-destructive">{errors.metaJson}</div> : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export type ProductEditorDraft = {
  id?: string
  handle: string
  status: CatalogProductStatus
  type: CatalogProductType
  publishedAt: string
  isFeatured: boolean
  brandId: string | null

  taxClassCode: string
  fulfillmentClass: CatalogFulfillmentClass | ''
  requiresShipping: boolean
  countryOfOrigin: string
  hsCode: string

  categoryIds: string[]
  translations: TranslationDraft[]
  variants: VariantDraft[]

  metaJsonText: string
}

function parseJson(text: string): any | null {
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
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

function nOrU(v: string): number | undefined {
  if (!v.trim()) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function toDraft(product?: any): ProductEditorDraft {
  const base: ProductEditorDraft = {
    id: product?.id,
    handle: product?.handle ?? '',
    status: product?.status ?? 'draft',
    type: product?.type ?? 'standard',
    publishedAt: (product?.publishedAt ?? '') || '',
    isFeatured: Boolean(product?.isFeatured),
    brandId: product?.brandId ?? null,

    taxClassCode: (product?.taxClassCode ?? '') || '',
    fulfillmentClass: (product?.fulfillmentClass as any) ?? '',
    requiresShipping: typeof product?.requiresShipping === 'boolean' ? product.requiresShipping : true,
    countryOfOrigin: (product?.countryOfOrigin ?? '') || '',
    hsCode: (product?.hsCode ?? '') || '',

    categoryIds: product?.categoryIds ? [...product.categoryIds] : [],
    translations: product?.translations?.length ? product.translations.map((t) => ({ ...t })) : [{ locale: 'en', name: '' }],
    variants: product?.variants?.length
      ? product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          title: v.title,
          isDefault: v.isDefault,
          fulfillmentClass: v.fulfillmentClass,
          requiresShipping: v.requiresShipping,
          weightKg: v.weightKg === undefined ? '' : String(v.weightKg),
          lengthCm: v.lengthCm === undefined ? '' : String(v.lengthCm),
          widthCm: v.widthCm === undefined ? '' : String(v.widthCm),
          heightCm: v.heightCm === undefined ? '' : String(v.heightCm),
          allowBackorder: v.allowBackorder,
          allowPreorder: v.allowPreorder,
          metaJsonText: v.metaJson ? JSON.stringify(v.metaJson, null, 2) : '{\n\n}',
        }))
      : [{ sku: '', title: '', isDefault: true, requiresShipping: true, metaJsonText: '{\n\n}' }],
    metaJsonText: product?.metaJson ? JSON.stringify(product.metaJson, null, 2) : '{\n\n}',
  }

  // enforce single default in draft
  if (base.variants.length > 0) {
    const anyDefault = base.variants.some((v) => v.isDefault)
    if (!anyDefault) base.variants[0].isDefault = true
  }

  return base
}

export function LegacyProductEditor(props: {
  mode: 'create' | 'edit'
  product?: any
  brands: Brand[]
  categories: Category[]
  isSaving?: boolean
  onSave: (payload: {
    handle: string
    status: CatalogProductStatus
    type: CatalogProductType
    publishedAt?: string | null
    isFeatured?: boolean
    brandId?: string | null
    taxClassCode?: string | null
    fulfillmentClass?: CatalogFulfillmentClass
    requiresShipping?: boolean
    countryOfOrigin?: string | null
    hsCode?: string | null
    metaJson?: any
    categoryIds?: string[]
    translations: any[]
    variants: any[]
  }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [draft, setDraft] = useState<ProductEditorDraft>(() => toDraft(props.product))
  const [activeLocale, setActiveLocale] = useState<string>('')
  const [addLocale, setAddLocale] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [variantMetaErrorIndex, setVariantMetaErrorIndex] = useState<number | null>(null)

  useEffect(() => {
    setDraft(toDraft(props.product))
    setIsDirty(false)
    setVariantMetaErrorIndex(null)
  }, [props.product?.id])

  useEffect(() => {
    const first = draft.translations[0]?.locale
    if (!activeLocale && first) setActiveLocale(first)
    if (activeLocale && !draft.translations.some((t) => t.locale === activeLocale)) {
      setActiveLocale(first || 'en')
    }
  }, [activeLocale, draft.translations])

  const brandOptions = useMemo(() => [...props.brands].sort((a, b) => a.name.localeCompare(b.name)), [props.brands])
  const categoryOptions = useMemo(() => [...props.categories].sort((a, b) => a.name.localeCompare(b.name)), [props.categories])

  const categoryById = useMemo(() => {
    const m = new Map<string, Category>()
    for (const c of props.categories) m.set(c.id, c)
    return m
  }, [props.categories])

  const selectedCategories = useMemo(() => {
    return draft.categoryIds.map((id) => categoryById.get(id)).filter(Boolean) as Category[]
  }, [categoryById, draft.categoryIds])

  const defaultVariantIndex = useMemo(() => {
    const idx = draft.variants.findIndex((v) => v.isDefault)
    return idx >= 0 ? idx : 0
  }, [draft.variants])

  const setDefaultVariant = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => ({ ...v, isDefault: i === idx })),
    }))
    setIsDirty(true)
  }

  const addCategory = (id: string) => {
    setDraft((prev) => (prev.categoryIds.includes(id) ? prev : { ...prev, categoryIds: [...prev.categoryIds, id] }))
    setIsDirty(true)
  }

  const removeCategory = (id: string) => {
    setDraft((prev) => ({ ...prev, categoryIds: prev.categoryIds.filter((x) => x !== id) }))
    setIsDirty(true)
  }

  const moveCategory = (id: string, direction: -1 | 1) => {
    setDraft((prev) => {
      const idx = prev.categoryIds.indexOf(id)
      if (idx < 0) return prev
      const nextIdx = idx + direction
      if (nextIdx < 0 || nextIdx >= prev.categoryIds.length) return prev
      const next = [...prev.categoryIds]
      const tmp = next[idx]
      next[idx] = next[nextIdx]
      next[nextIdx] = tmp
      return { ...prev, categoryIds: next }
    })
    setIsDirty(true)
  }

  const addTranslation = () => {
    const locale = addLocale.trim()
    if (!locale) return
    if (draft.translations.some((t) => t.locale === locale)) return
    setDraft((prev) => ({ ...prev, translations: [...prev.translations, { locale, name: '' }] }))
    setActiveLocale(locale)
    setAddLocale('')
    setIsDirty(true)
  }

  const removeTranslation = (locale: string) => {
    if (draft.translations.length <= 1) return
    setDraft((prev) => ({ ...prev, translations: prev.translations.filter((t) => t.locale !== locale) }))
    setIsDirty(true)
  }

  const addVariant = () => {
    setDraft((prev) => ({
      ...prev,
      variants: [...prev.variants, { sku: '', title: '', isDefault: false, requiresShipping: prev.requiresShipping, metaJsonText: '{\n\n}' }],
    }))
    setIsDirty(true)
  }

  const removeVariant = (idx: number) => {
    setDraft((prev) => {
      const next = prev.variants.filter((_, i) => i !== idx)
      if (next.length === 0) next.push({ sku: '', title: '', isDefault: true, requiresShipping: prev.requiresShipping, metaJsonText: '{\n\n}' })
      if (!next.some((v) => v.isDefault)) next[0].isDefault = true
      return { ...prev, variants: next }
    })
    setIsDirty(true)
  }

  const handleSave = async () => {
    const handle = draft.handle.trim()
    if (!handle) return

    const translations = draft.translations
      .map((t) => ({
        ...t,
        locale: t.locale.trim(),
        name: t.name.trim(),
        shortDescription: t.shortDescription?.trim() || undefined,
        longDescription: t.longDescription?.trim() || undefined,
        seoTitle: t.seoTitle?.trim() || undefined,
        seoDescription: t.seoDescription?.trim() || undefined,
        seoKeywords: t.seoKeywords?.length ? t.seoKeywords : undefined,
        slug: t.slug?.trim() || undefined,
      }))
      .filter((t) => t.locale && t.name)

    if (translations.length === 0) return

    const invalidVariantMetaIdx = draft.variants.findIndex((v) => parseJson(v.metaJsonText || '{\n\n}') === null)
    if (invalidVariantMetaIdx >= 0) {
      setVariantMetaErrorIndex(invalidVariantMetaIdx)
      return
    }

    const variants = draft.variants
      .map((v, i) => ({
        ...(v.id ? { id: v.id } : {}),
        sku: v.sku.trim(),
        title: v.title?.trim() || undefined,
        isDefault: i === defaultVariantIndex,
        fulfillmentClass: v.fulfillmentClass || undefined,
        requiresShipping: typeof v.requiresShipping === 'boolean' ? v.requiresShipping : undefined,
        weightKg: nOrU(v.weightKg || ''),
        lengthCm: nOrU(v.lengthCm || ''),
        widthCm: nOrU(v.widthCm || ''),
        heightCm: nOrU(v.heightCm || ''),
        allowBackorder: v.allowBackorder ?? undefined,
        allowPreorder: v.allowPreorder ?? undefined,
        metaJson: parseJson(v.metaJsonText || '{\n\n}') ?? undefined,
      }))
      .filter((v) => v.sku)

    if (variants.length === 0) return

    const metaJson = parseJson(draft.metaJsonText)
    if (!metaJson) return

    await props.onSave({
      handle,
      status: draft.status,
      type: draft.type,
      publishedAt: draft.publishedAt.trim() ? draft.publishedAt.trim() : null,
      isFeatured: draft.isFeatured,
      brandId: draft.brandId,
      taxClassCode: draft.taxClassCode.trim() || null,
      fulfillmentClass: draft.fulfillmentClass ? (draft.fulfillmentClass as CatalogFulfillmentClass) : undefined,
      requiresShipping: draft.requiresShipping,
      countryOfOrigin: draft.countryOfOrigin.trim() || null,
      hsCode: draft.hsCode.trim() || null,
      metaJson,
      categoryIds: draft.categoryIds,
      translations,
      variants,
    })

    setIsDirty(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{props.mode === 'create' ? 'New' : 'Edit'}</Badge>
          {isDirty ? <Badge variant="secondary">Unsaved</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={props.isSaving || !isDirty}>
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>Handle, lifecycle, and core flags.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Handle</label>
              <Input value={draft.handle} onChange={(e) => { setDraft((p) => ({ ...p, handle: e.target.value })); setIsDirty(true) }} placeholder="e.g. iphone-15-pro-max" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand</label>
              <Select value={draft.brandId ?? '__none__'} onValueChange={(v) => { setDraft((p) => ({ ...p, brandId: v === '__none__' ? null : v })); setIsDirty(true) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No brand</SelectItem>
                  {brandOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={draft.status} onValueChange={(v) => { setDraft((p) => ({ ...p, status: v as any })); setIsDirty(true) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={draft.type} onValueChange={(v) => { setDraft((p) => ({ ...p, type: v as any })); setIsDirty(true) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="bundle">Bundle</SelectItem>
                  <SelectItem value="virtual">Virtual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Published at</label>
              <Input
                type="datetime-local"
                value={toDateTimeLocalValue(draft.publishedAt)}
                onChange={(e) => {
                  const publishedAt = fromDateTimeLocalValue(e.target.value)
                  setDraft((p) => ({ ...p, publishedAt }))
                  setIsDirty(true)
                }}
                placeholder=""
              />
              <div className="text-xs text-muted-foreground">Stored as ISO timestamp; leave empty for unpublished.</div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Featured</div>
              <div className="text-xs text-muted-foreground">Highlights the product in merchandising surfaces.</div>
            </div>
            <Switch checked={draft.isFeatured} onCheckedChange={(v) => { setDraft((p) => ({ ...p, isFeatured: v })); setIsDirty(true) }} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Ordered list; the first is treated as Primary.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Add category</Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[360px]" align="start">
              <Command>
                <CommandInput placeholder="Search categories…" />
                <CommandList>
                  <ScrollArea className="h-[260px]">
                    {categoryOptions.length === 0 ? <CommandEmpty>No categories found.</CommandEmpty> : null}
                    {categoryOptions.map((c) => (
                      <CommandItem key={c.id} value={`${c.name} ${c.slug}`} onSelect={() => addCategory(c.id)}>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.slug}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedCategories.length === 0 ? (
            <div className="text-sm text-muted-foreground">No categories selected.</div>
          ) : (
            <div className="space-y-2">
              {selectedCategories.map((c, idx) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.slug}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {idx === 0 ? <Badge variant="outline">primary</Badge> : null}
                    <Button variant="ghost" size="icon" onClick={() => moveCategory(c.id, -1)} disabled={idx === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveCategory(c.id, 1)}
                      disabled={idx === selectedCategories.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeCategory(c.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Translations</CardTitle>
          <CardDescription>Replace-on-save: send the full translations array.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-[180px]" value={addLocale} onChange={(e) => setAddLocale(e.target.value)} placeholder="locale (e.g. en)" />
            <Button variant="outline" onClick={addTranslation}>
              <Plus className="h-4 w-4 mr-2" />
              Add locale
            </Button>
          </div>

          <Tabs value={activeLocale} onValueChange={setActiveLocale}>
            <TabsList className={cn('flex flex-wrap h-auto justify-start')}> 
              {draft.translations.map((t) => (
                <TabsTrigger key={t.locale} value={t.locale}>
                  {t.locale}
                </TabsTrigger>
              ))}
            </TabsList>

            {draft.translations.map((t) => (
              <TabsContent key={t.locale} value={t.locale} className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{t.locale}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeTranslation(t.locale)}
                    disabled={draft.translations.length <= 1}
                  >
                    Remove
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={t.name}
                      onChange={(e) => {
                        const name = e.target.value
                        setDraft((p) => ({
                          ...p,
                          translations: p.translations.map((x) => (x.locale === t.locale ? { ...x, name } : x)),
                        }))
                        setIsDirty(true)
                      }}
                      placeholder="Product name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Slug</label>
                    <Input
                      value={t.slug || ''}
                      onChange={(e) => {
                        const slug = e.target.value
                        setDraft((p) => ({
                          ...p,
                          translations: p.translations.map((x) => (x.locale === t.locale ? { ...x, slug } : x)),
                        }))
                        setIsDirty(true)
                      }}
                      placeholder=""
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Short description</label>
                  <Textarea
                    value={t.shortDescription || ''}
                    onChange={(e) => {
                      const shortDescription = e.target.value
                      setDraft((p) => ({
                        ...p,
                        translations: p.translations.map((x) => (x.locale === t.locale ? { ...x, shortDescription } : x)),
                      }))
                      setIsDirty(true)
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Long description</label>
                  <Textarea
                    value={t.longDescription || ''}
                    onChange={(e) => {
                      const longDescription = e.target.value
                      setDraft((p) => ({
                        ...p,
                        translations: p.translations.map((x) => (x.locale === t.locale ? { ...x, longDescription } : x)),
                      }))
                      setIsDirty(true)
                    }}
                    className="min-h-[160px]"
                  />
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SEO title</label>
                    <Input
                      value={t.seoTitle || ''}
                      onChange={(e) => {
                        const seoTitle = e.target.value
                        setDraft((p) => ({
                          ...p,
                          translations: p.translations.map((x) => (x.locale === t.locale ? { ...x, seoTitle } : x)),
                        }))
                        setIsDirty(true)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SEO keywords (comma)</label>
                    <Input
                      value={(t.seoKeywords || []).join(', ')}
                      onChange={(e) => {
                        const seoKeywords = e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                        setDraft((p) => ({
                          ...p,
                          translations: p.translations.map((x) => (x.locale === t.locale ? { ...x, seoKeywords } : x)),
                        }))
                        setIsDirty(true)
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">SEO description</label>
                  <Textarea
                    value={t.seoDescription || ''}
                    onChange={(e) => {
                      const seoDescription = e.target.value
                      setDraft((p) => ({
                        ...p,
                        translations: p.translations.map((x) => (x.locale === t.locale ? { ...x, seoDescription } : x)),
                      }))
                      setIsDirty(true)
                    }}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Variants</CardTitle>
          <CardDescription>Replace-on-save: send the full variants array. One default variant required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Default: #{defaultVariantIndex + 1}</div>
            <Button variant="outline" onClick={addVariant}>
              <Plus className="h-4 w-4 mr-2" />
              Add variant
            </Button>
          </div>

          <div className="space-y-3">
            {draft.variants.map((v, idx) => (
              <div key={v.id || idx} className="rounded-md border p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{idx + 1}</Badge>
                    {idx === defaultVariantIndex ? <Badge>Default</Badge> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDefaultVariant(idx)} disabled={idx === defaultVariantIndex}>
                      Set default
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => removeVariant(idx)}>
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SKU</label>
                    <Input
                      value={v.sku}
                      onChange={(e) => {
                        const sku = e.target.value
                        setDraft((p) => ({
                          ...p,
                          variants: p.variants.map((x, i) => (i === idx ? { ...x, sku } : x)),
                        }))
                        setIsDirty(true)
                      }}
                      placeholder="SKU"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={v.title || ''}
                      onChange={(e) => {
                        const title = e.target.value
                        setDraft((p) => ({
                          ...p,
                          variants: p.variants.map((x, i) => (i === idx ? { ...x, title } : x)),
                        }))
                        setIsDirty(true)
                      }}
                      placeholder="e.g. 128GB / Black"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fulfillment</label>
                    <Select
                      value={(v.fulfillmentClass ?? '__inherit__') as any}
                      onValueChange={(value) => {
                        const fulfillmentClass = (value === '__inherit__' ? undefined : value) as any
                        setDraft((p) => ({
                          ...p,
                          variants: p.variants.map((x, i) => (i === idx ? { ...x, fulfillmentClass } : x)),
                        }))
                        setIsDirty(true)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="(inherit)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__inherit__">(inherit)</SelectItem>
                        <SelectItem value="physical">Physical</SelectItem>
                        <SelectItem value="digital">Digital</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Requires shipping</div>
                    </div>
                    <Switch
                      checked={typeof v.requiresShipping === 'boolean' ? v.requiresShipping : draft.requiresShipping}
                      onCheckedChange={(requiresShipping) => {
                        setDraft((p) => ({
                          ...p,
                          variants: p.variants.map((x, i) => (i === idx ? { ...x, requiresShipping } : x)),
                        }))
                        setIsDirty(true)
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Allow backorder</div>
                    </div>
                    <Switch
                      checked={Boolean(v.allowBackorder)}
                      onCheckedChange={(allowBackorder) => {
                        setDraft((p) => ({
                          ...p,
                          variants: p.variants.map((x, i) => (i === idx ? { ...x, allowBackorder } : x)),
                        }))
                        setIsDirty(true)
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Allow preorder</div>
                    </div>
                    <Switch
                      checked={Boolean(v.allowPreorder)}
                      onCheckedChange={(allowPreorder) => {
                        setDraft((p) => ({
                          ...p,
                          variants: p.variants.map((x, i) => (i === idx ? { ...x, allowPreorder } : x)),
                        }))
                        setIsDirty(true)
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Weight (kg)</label>
                    <Input
                      value={v.weightKg || ''}
                      onChange={(e) => {
                        const weightKg = e.target.value
                        setDraft((p) => ({
                          ...p,
                          variants: p.variants.map((x, i) => (i === idx ? { ...x, weightKg } : x)),
                        }))
                        setIsDirty(true)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Length (cm)</label>
                    <Input
                      value={v.lengthCm || ''}
                      onChange={(e) => {
                        const lengthCm = e.target.value
                        setDraft((p) => ({
                          ...p,
                          variants: p.variants.map((x, i) => (i === idx ? { ...x, lengthCm } : x)),
                        }))
                        setIsDirty(true)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Width (cm)</label>
                    <Input
                      value={v.widthCm || ''}
                      onChange={(e) => {
                        const widthCm = e.target.value
                        setDraft((p) => ({
                          ...p,
                          variants: p.variants.map((x, i) => (i === idx ? { ...x, widthCm } : x)),
                        }))
                        setIsDirty(true)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Height (cm)</label>
                    <Input
                      value={v.heightCm || ''}
                      onChange={(e) => {
                        const heightCm = e.target.value
                        setDraft((p) => ({
                          ...p,
                          variants: p.variants.map((x, i) => (i === idx ? { ...x, heightCm } : x)),
                        }))
                        setIsDirty(true)
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Variant meta JSON</label>
                  <Textarea
                    value={v.metaJsonText ?? '{\n\n}'}
                    onChange={(e) => {
                      const metaJsonText = e.target.value
                      setDraft((p) => ({
                        ...p,
                        variants: p.variants.map((x, i) => (i === idx ? { ...x, metaJsonText } : x)),
                      }))
                      if (variantMetaErrorIndex === idx) setVariantMetaErrorIndex(null)
                      setIsDirty(true)
                    }}
                    className="font-mono text-xs min-h-[140px]"
                  />
                  {parseJson(v.metaJsonText ?? '{\n\n}') === null || variantMetaErrorIndex === idx ? (
                    <p className="text-xs text-destructive">Invalid JSON.</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Shipping & Compliance</CardTitle>
          <CardDescription>Stored on product for fulfillment and checkout rules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tax class code</label>
              <Input value={draft.taxClassCode} onChange={(e) => { setDraft((p) => ({ ...p, taxClassCode: e.target.value })); setIsDirty(true) }} placeholder="" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fulfillment class</label>
              <Select
                value={(draft.fulfillmentClass || '__unset__') as any}
                onValueChange={(v) => {
                  setDraft((p) => ({ ...p, fulfillmentClass: (v === '__unset__' ? '' : v) as any }))
                  setIsDirty(true)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unset__">(unset)</SelectItem>
                  <SelectItem value="physical">Physical</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Requires shipping</div>
                <div className="text-xs text-muted-foreground">Default for variants unless overridden.</div>
              </div>
              <Switch checked={draft.requiresShipping} onCheckedChange={(v) => { setDraft((p) => ({ ...p, requiresShipping: v })); setIsDirty(true) }} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Country of origin</label>
              <Input value={draft.countryOfOrigin} onChange={(e) => { setDraft((p) => ({ ...p, countryOfOrigin: e.target.value })); setIsDirty(true) }} placeholder="KE" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">HS code</label>
            <Input value={draft.hsCode} onChange={(e) => { setDraft((p) => ({ ...p, hsCode: e.target.value })); setIsDirty(true) }} placeholder="" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Meta JSON</CardTitle>
          <CardDescription>Flexible metadata store (validated JSON).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={draft.metaJsonText}
            onChange={(e) => {
              setDraft((p) => ({ ...p, metaJsonText: e.target.value }))
              setIsDirty(true)
            }}
            className="font-mono text-xs min-h-[220px]"
          />
          {parseJson(draft.metaJsonText) === null ? (
            <p className="text-xs text-destructive">Invalid JSON.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
