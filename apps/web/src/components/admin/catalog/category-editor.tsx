import { useEffect, useMemo, useRef, useState } from 'react'
import type { Category, Taxonomy } from '@/types'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { IconPicker } from '@/components/common/icon-picker'
import { CommonUpload, type CommonUploadHandle } from '@/components/common/common-upload'
import { LniIcon } from '@/components/common/lni-icon'
import { ValueIcon } from '@/components/common/value-icon'

const ROOT = '__root__'

export type CategoryEditorValues = {
  taxonomyId: string
  key: string
  name: string
  slug: string
  parentId: string | null
  description: string
  isActive: boolean
  sortOrder: string
  icon: string
  avatarUrl: string
  imageUrl: string
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  urlPath: string
  locale: string
  synonyms: string
  keywords: string
  level: string
  audience: string
  returnPolicy: string
  taxCode: string
  highlight: boolean
  navPlacement: boolean
  featured: boolean
  isHomepage: boolean
  banner: string
  marginTarget: string
  availability: string
  compliance: string
  shippingProfile: string
  marketingHeadline: string
  marketingSub: string
  heroCta: string
  heroCtaLink: string
  contentPillar: string
  story: string
  themeColor: string
  shippingMatrix: Array<{ region: string; sla: string; surcharge: string }>
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function toIntOrUndefined(value: string): number | undefined {
  const n = Number.parseInt(String(value || '').trim(), 10)
  return Number.isFinite(n) ? n : undefined
}

function toKeywords(value: string): string[] | undefined {
  const keywords = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return keywords.length ? keywords : undefined
}

function normalizeShippingMatrix(rows: Array<{ region: string; sla: string; surcharge: string }>): Array<{ region: string; sla: string; surcharge: string }> | undefined {
  const cleaned = rows
    .map((r) => ({
      region: (r.region || '').trim(),
      sla: (r.sla || '').trim(),
      surcharge: (r.surcharge || '').trim(),
    }))
    .filter((r) => r.region && r.sla && r.surcharge)
  return cleaned.length ? cleaned : undefined
}

export type CategoryEditorSubmitPayload = {
  taxonomyId?: string
  key?: string
  name: string
  slug: string
  parentId?: string | null
  description?: string
  isActive?: boolean
  sortOrder?: number
  order?: number
  icon?: string
  avatarUrl?: string
  imageUrl?: string
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string[]
  urlPath?: string
  synonyms?: string
  keywords?: string
  level?: string
  audience?: string
  returnPolicy?: string
  taxCode?: string
  highlight?: boolean
  navPlacement?: boolean
  featured?: boolean
  isHomepage?: boolean
  banner?: string
  marginTarget?: number
  availability?: string
  compliance?: string
  shippingProfile?: string
  marketingHeadline?: string
  marketingSub?: string
  heroCta?: string
  heroCtaLink?: string
  contentPillar?: string
  story?: string
  themeColor?: string
  shippingMatrix?: Array<{ region: string; sla: string; surcharge: string }>
  locale?: string
}

export function CategoryEditor(props: {
  mode: 'create' | 'edit'
  token?: string | null
  categories: Category[]
  taxonomies: Taxonomy[]
  initial?: Partial<CategoryEditorValues>
  isSubmitting?: boolean
  submitLabel: string
  secondaryAction?: { label: string; onClick: (payload: CategoryEditorSubmitPayload) => void | Promise<void> }
  onSubmit: (payload: CategoryEditorSubmitPayload) => void | Promise<void>
  onCancel: () => void
}) {
  const avatarUploadRef = useRef<CommonUploadHandle | null>(null)
  const imageUploadRef = useRef<CommonUploadHandle | null>(null)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)

  const defaultTaxonomyId = useMemo(() => {
    const def = props.taxonomies.find((t) => t.isDefault)
    return def?.id ?? props.taxonomies[0]?.id ?? ''
  }, [props.taxonomies])

  const parentOptions = useMemo(() => {
    const byId = new Map<string, Category>()
    for (const c of props.categories) byId.set(c.id, c)

    const pathOf = (cat: Category): string => {
      const parts: string[] = [cat.name]
      let cursor: Category | undefined = cat
      const seen = new Set<string>()
      for (let i = 0; i < 8; i++) {
        const parentId = cursor?.parentId
        if (!parentId) break
        if (seen.has(parentId)) break
        seen.add(parentId)
        const parent = byId.get(parentId)
        if (!parent) break
        parts.unshift(parent.name)
        cursor = parent
      }
      return parts.join(' / ')
    }

    return [
      { value: ROOT, label: 'Top level', path: '' },
      ...props.categories
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name, path: pathOf(c) })),
    ]
  }, [props.categories])

  const [values, setValues] = useState<CategoryEditorValues>(() => ({
    taxonomyId: props.initial?.taxonomyId ?? '',
    key: props.initial?.key ?? '',
    name: props.initial?.name ?? '',
    slug: props.initial?.slug ?? '',
    parentId: props.initial?.parentId ?? null,
    description: props.initial?.description ?? '',
    isActive: props.initial?.isActive ?? true,
    sortOrder: props.initial?.sortOrder ?? '',
    icon: props.initial?.icon ?? '',
    avatarUrl: props.initial?.avatarUrl ?? '',
    imageUrl: props.initial?.imageUrl ?? '',
    seoTitle: props.initial?.seoTitle ?? '',
    seoDescription: props.initial?.seoDescription ?? '',
    seoKeywords: props.initial?.seoKeywords ?? '',
    urlPath: props.initial?.urlPath ?? '',
    locale: props.initial?.locale ?? 'en',
    synonyms: props.initial?.synonyms ?? '',
    keywords: props.initial?.keywords ?? '',
    level: props.initial?.level ?? 'primary',
    audience: props.initial?.audience ?? 'all',
    returnPolicy: props.initial?.returnPolicy ?? 'standard',
    taxCode: props.initial?.taxCode ?? 'GEN-001',
    highlight: props.initial?.highlight ?? false,
    navPlacement: props.initial?.navPlacement ?? true,
    featured: props.initial?.featured ?? false,
    isHomepage: props.initial?.isHomepage ?? false,
    banner: props.initial?.banner ?? '',
    marginTarget: props.initial?.marginTarget ?? '18',
    availability: props.initial?.availability ?? 'global',
    compliance: props.initial?.compliance ?? '',
    shippingProfile: props.initial?.shippingProfile ?? 'standard',
    marketingHeadline: props.initial?.marketingHeadline ?? '',
    marketingSub: props.initial?.marketingSub ?? '',
    heroCta: props.initial?.heroCta ?? '',
    heroCtaLink: props.initial?.heroCtaLink ?? '',
    contentPillar: props.initial?.contentPillar ?? '',
    story: props.initial?.story ?? '',
    themeColor: props.initial?.themeColor ?? '#f97316',
    shippingMatrix:
      props.initial?.shippingMatrix?.length
        ? props.initial.shippingMatrix
        : [
            { region: 'Nairobi & Kiambu', sla: 'Same/next day', surcharge: 'KES 0' },
            { region: 'Kenya (rest)', sla: '2-3 days', surcharge: 'KES 350' },
          ],
  }))

  useEffect(() => {
    if (props.mode !== 'create') return
    if (!defaultTaxonomyId) return
    setValues((prev) => (prev.taxonomyId ? prev : { ...prev, taxonomyId: defaultTaxonomyId }))
  }, [defaultTaxonomyId, props.mode])

  const payload = useMemo((): CategoryEditorSubmitPayload => {
    const name = values.name.trim()
    const slug = (values.slug.trim() || slugify(name)).trim()
    const key = (values.key.trim() || slug).trim()
    const sortOrder = toIntOrUndefined(values.sortOrder)
    const marginTarget = toIntOrUndefined(values.marginTarget)
    const seoKeywords = toKeywords(values.seoKeywords)
    const shippingMatrix = normalizeShippingMatrix(values.shippingMatrix)

    return {
      taxonomyId: values.taxonomyId.trim() || undefined,
      key: key || undefined,
      name,
      slug,
      parentId: values.parentId,
      description: values.description.trim() || undefined,
      isActive: values.isActive,
      sortOrder,
      order: sortOrder,
      icon: values.icon.trim() || undefined,
      avatarUrl: values.avatarUrl.trim() || undefined,
      imageUrl: values.imageUrl.trim() || undefined,
      seoTitle: values.seoTitle.trim() || undefined,
      seoDescription: values.seoDescription.trim() || undefined,
      seoKeywords,
      urlPath: values.urlPath.trim() || undefined,
      synonyms: values.synonyms.trim() || undefined,
      keywords: values.keywords.trim() || undefined,
      level: values.level.trim() || undefined,
      audience: values.audience.trim() || undefined,
      returnPolicy: values.returnPolicy.trim() || undefined,
      taxCode: values.taxCode.trim() || undefined,
      highlight: values.highlight,
      navPlacement: values.navPlacement,
      featured: values.featured,
      isHomepage: values.isHomepage,
      banner: values.banner.trim() || undefined,
      marginTarget,
      availability: values.availability.trim() || undefined,
      compliance: values.compliance.trim() || undefined,
      shippingProfile: values.shippingProfile.trim() || undefined,
      marketingHeadline: values.marketingHeadline.trim() || undefined,
      marketingSub: values.marketingSub.trim() || undefined,
      heroCta: values.heroCta.trim() || undefined,
      heroCtaLink: values.heroCtaLink.trim() || undefined,
      contentPillar: values.contentPillar.trim() || undefined,
      story: values.story.trim() || undefined,
      themeColor: values.themeColor.trim() || undefined,
      shippingMatrix,
      locale: values.locale.trim() || 'en',
    }
  }, [values])

  const isValid = useMemo(() => {
    if (!payload.name) return false
    if (!payload.slug) return false
    if (props.mode === 'create' && !payload.taxonomyId) return false
    return true
  }, [payload, props.mode])

  const submitWithUploads = async (action: 'primary' | 'secondary') => {
    if (props.isSubmitting || isUploadingMedia) return

    if (!isValid) {
      toast.error('Please complete required fields')
      return
    }

    const avatarPending = avatarUploadRef.current?.getFiles() || []
    const imagePending = imageUploadRef.current?.getFiles() || []

    if (!avatarPending.length && !imagePending.length) {
      if (action === 'secondary') {
        await props.secondaryAction?.onClick(payload)
      } else {
        await props.onSubmit(payload)
      }
      return
    }

    setIsUploadingMedia(true)
    try {
      let nextAvatarUrl = payload.avatarUrl
      let nextImageUrl = payload.imageUrl

      if (avatarPending.length && avatarUploadRef.current) {
        const uploaded = await avatarUploadRef.current.upload()
        nextAvatarUrl = uploaded.urls[0] || nextAvatarUrl
        if (nextAvatarUrl) setValues((prev) => ({ ...prev, avatarUrl: nextAvatarUrl }))
      }

      if (imagePending.length && imageUploadRef.current) {
        const uploaded = await imageUploadRef.current.upload()
        nextImageUrl = uploaded.urls[0] || nextImageUrl
        if (nextImageUrl) setValues((prev) => ({ ...prev, imageUrl: nextImageUrl }))
      }

      const payloadWithMedia: CategoryEditorSubmitPayload = {
        ...payload,
        avatarUrl: nextAvatarUrl,
        imageUrl: nextImageUrl,
      }

      if (action === 'secondary') {
        await props.secondaryAction?.onClick(payloadWithMedia)
      } else {
        await props.onSubmit(payloadWithMedia)
      }
    } catch (e: any) {
      toast.error('Image upload failed', { description: e?.message || 'Please try again.' })
    } finally {
      setIsUploadingMedia(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <LniIcon name="lni-layout-9" size={18} className="text-muted-foreground" />
                Category
              </CardTitle>
              <Badge variant={values.isActive ? 'default' : 'secondary'}>{values.isActive ? 'Active' : 'Hidden'}</Badge>
            </div>
            <CardDescription>Fast, clean editing for navigation, merchandising, and search.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={values.name}
                      onChange={(e) => {
                        const nextName = e.target.value
                        setValues((prev) => ({
                          ...prev,
                          name: nextName,
                          slug: prev.slug ? prev.slug : slugify(nextName),
                          key: prev.key ? prev.key : slugify(nextName),
                        }))
                      }}
                      placeholder="e.g. Wearables"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Slug</label>
                    <Input
                      value={values.slug}
                      onChange={(e) => setValues((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="wearables"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{props.mode === 'create' ? 'Taxonomy (required)' : 'Taxonomy'}</label>
                    {props.taxonomies.length ? (
                      <Select value={values.taxonomyId} onValueChange={(taxonomyId) => setValues((prev) => ({ ...prev, taxonomyId }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select taxonomy" />
                        </SelectTrigger>
                        <SelectContent>
                          {props.taxonomies.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} ({t.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={values.taxonomyId}
                        onChange={(e) => setValues((prev) => ({ ...prev, taxonomyId: e.target.value }))}
                        placeholder="Enter taxonomy ID"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Key</label>
                    <Input
                      value={values.key}
                      onChange={(e) => setValues((prev) => ({ ...prev, key: e.target.value }))}
                      placeholder="wearables"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Parent</label>
                    <Select
                      value={values.parentId || ROOT}
                      onValueChange={(val) => setValues((prev) => ({ ...prev, parentId: val === ROOT ? null : val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Top level" />
                      </SelectTrigger>
                      <SelectContent>
                        {parentOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}{opt.path ? ` — ${opt.path}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sort order</label>
                    <Input
                      type="number"
                      min={0}
                      value={values.sortOrder}
                      onChange={(e) => setValues((prev) => ({ ...prev, sortOrder: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Icon</label>
                    <IconPicker value={values.icon} onChange={(icon) => setValues((prev) => ({ ...prev, icon }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Visibility</label>
                    <div className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{values.isActive ? 'Active' : 'Hidden'}</p>
                        <p className="text-xs text-muted-foreground">{values.isActive ? 'Visible in storefront and search.' : 'Not visible to shoppers.'}</p>
                      </div>
                      <Switch checked={values.isActive} onCheckedChange={(isActive) => setValues((prev) => ({ ...prev, isActive }))} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    rows={3}
                    value={values.description}
                    onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what lives under this category."
                  />
                </div>
              </TabsContent>

              <TabsContent value="media" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Avatar</label>
                    <CommonUpload
                      ref={avatarUploadRef}
                      folder="categories"
                      token={props.token}
                      imagesOnly
                      maxFiles={1}
                      isPublic
                      mode="deferred"
                      existingUrls={values.avatarUrl ? [values.avatarUrl] : []}
                      onExistingUrlsChange={(urls) => setValues((prev) => ({ ...prev, avatarUrl: urls[0] || '' }))}
                      onUploaded={() => {}}
                    />
                    <Input
                      value={values.avatarUrl}
                      onChange={(e) => setValues((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                      placeholder="https://…"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cover image</label>
                    <CommonUpload
                      ref={imageUploadRef}
                      folder="categories"
                      token={props.token}
                      imagesOnly
                      maxFiles={1}
                      isPublic
                      mode="deferred"
                      existingUrls={values.imageUrl ? [values.imageUrl] : []}
                      onExistingUrlsChange={(urls) => setValues((prev) => ({ ...prev, imageUrl: urls[0] || '' }))}
                      onUploaded={() => {}}
                    />
                    <Input
                      value={values.imageUrl}
                      onChange={(e) => setValues((prev) => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="https://…"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="seo" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Locale</label>
                    <Input value={values.locale} onChange={(e) => setValues((prev) => ({ ...prev, locale: e.target.value }))} placeholder="en" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SEO title</label>
                    <Input value={values.seoTitle} onChange={(e) => setValues((prev) => ({ ...prev, seoTitle: e.target.value }))} placeholder="Search title" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">SEO description</label>
                  <Textarea
                    rows={3}
                    value={values.seoDescription}
                    onChange={(e) => setValues((prev) => ({ ...prev, seoDescription: e.target.value }))}
                    placeholder="Short meta description"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">SEO keywords (comma-separated)</label>
                  <Input value={values.seoKeywords} onChange={(e) => setValues((prev) => ({ ...prev, seoKeywords: e.target.value }))} placeholder="wearables, fitness, smartwatch" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">URL path override</label>
                  <Input value={values.urlPath} onChange={(e) => setValues((prev) => ({ ...prev, urlPath: e.target.value }))} placeholder="/electronics/wearables" />
                  <p className="text-xs text-muted-foreground">Optional custom breadcrumb path for this locale.</p>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="mt-4 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Synonyms (comma-separated)</label>
                    <Input value={values.synonyms} onChange={(e) => setValues((prev) => ({ ...prev, synonyms: e.target.value }))} placeholder="cables,cases,chargers" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Keywords (comma-separated)</label>
                    <Input value={values.keywords} onChange={(e) => setValues((prev) => ({ ...prev, keywords: e.target.value }))} placeholder="accessories,devices,chargers" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Level</label>
                    <Select value={values.level} onValueChange={(level) => setValues((prev) => ({ ...prev, level }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Primary</SelectItem>
                        <SelectItem value="secondary">Secondary</SelectItem>
                        <SelectItem value="tertiary">Tertiary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Audience</label>
                    <Select value={values.audience} onValueChange={(audience) => setValues((prev) => ({ ...prev, audience }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select audience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All shoppers</SelectItem>
                        <SelectItem value="b2b">B2B</SelectItem>
                        <SelectItem value="vip">VIP only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Return policy</label>
                    <Input value={values.returnPolicy} onChange={(e) => setValues((prev) => ({ ...prev, returnPolicy: e.target.value }))} placeholder="standard" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tax code</label>
                    <Input value={values.taxCode} onChange={(e) => setValues((prev) => ({ ...prev, taxCode: e.target.value }))} placeholder="GEN-001" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Highlight</p>
                      <p className="text-xs text-muted-foreground">Boost in curated blocks.</p>
                    </div>
                    <Switch checked={values.highlight} onCheckedChange={(highlight) => setValues((prev) => ({ ...prev, highlight }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Nav placement</p>
                      <p className="text-xs text-muted-foreground">Show in top navigation.</p>
                    </div>
                    <Switch checked={values.navPlacement} onCheckedChange={(navPlacement) => setValues((prev) => ({ ...prev, navPlacement }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Featured</p>
                      <p className="text-xs text-muted-foreground">Eligible for featured slots.</p>
                    </div>
                    <Switch checked={values.featured} onCheckedChange={(featured) => setValues((prev) => ({ ...prev, featured }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Homepage</p>
                      <p className="text-xs text-muted-foreground">Allow this category on homepage blocks.</p>
                    </div>
                    <Switch checked={values.isHomepage} onCheckedChange={(isHomepage) => setValues((prev) => ({ ...prev, isHomepage }))} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Banner URL</label>
                    <Input value={values.banner} onChange={(e) => setValues((prev) => ({ ...prev, banner: e.target.value }))} placeholder="https://…" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Theme color</label>
                    <Input type="color" value={values.themeColor} onChange={(e) => setValues((prev) => ({ ...prev, themeColor: e.target.value }))} className="h-10" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Marketing headline</label>
                    <Input value={values.marketingHeadline} onChange={(e) => setValues((prev) => ({ ...prev, marketingHeadline: e.target.value }))} placeholder="Tech that fits every life" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Marketing sub</label>
                    <Input value={values.marketingSub} onChange={(e) => setValues((prev) => ({ ...prev, marketingSub: e.target.value }))} placeholder="Curated devices, faster delivery…" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hero CTA label</label>
                    <Input value={values.heroCta} onChange={(e) => setValues((prev) => ({ ...prev, heroCta: e.target.value }))} placeholder="Shop accessories" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hero CTA link</label>
                    <Input value={values.heroCtaLink} onChange={(e) => setValues((prev) => ({ ...prev, heroCtaLink: e.target.value }))} placeholder="/accessories" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Content pillar</label>
                    <Textarea rows={3} value={values.contentPillar} onChange={(e) => setValues((prev) => ({ ...prev, contentPillar: e.target.value }))} placeholder="Narrative copy for the category landing page." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Story</label>
                    <Textarea rows={3} value={values.story} onChange={(e) => setValues((prev) => ({ ...prev, story: e.target.value }))} placeholder="Best add-ons for busy professionals…" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Shipping profile</label>
                    <Input value={values.shippingProfile} onChange={(e) => setValues((prev) => ({ ...prev, shippingProfile: e.target.value }))} placeholder="standard" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Margin target</label>
                    <Input type="number" min={0} value={values.marginTarget} onChange={(e) => setValues((prev) => ({ ...prev, marginTarget: e.target.value }))} placeholder="18" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Availability</label>
                    <Input value={values.availability} onChange={(e) => setValues((prev) => ({ ...prev, availability: e.target.value }))} placeholder="global" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Compliance</label>
                  <Textarea rows={2} value={values.compliance} onChange={(e) => setValues((prev) => ({ ...prev, compliance: e.target.value }))} placeholder="Return exceptions, regulated products, age gates…" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium">Shipping matrix</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setValues((prev) => ({ ...prev, shippingMatrix: [...prev.shippingMatrix, { region: '', sla: '', surcharge: '' }] }))}
                    >
                      <LniIcon name="lni-plus" size={14} className="mr-2" />
                      Add row
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {values.shippingMatrix.map((row, idx) => (
                      <div key={idx} className="grid gap-2 sm:grid-cols-[1.2fr_1fr_0.7fr_auto] items-center">
                        <Input
                          value={row.region}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              shippingMatrix: prev.shippingMatrix.map((r, i) => (i === idx ? { ...r, region: e.target.value } : r)),
                            }))
                          }
                          placeholder="Region"
                        />
                        <Input
                          value={row.sla}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              shippingMatrix: prev.shippingMatrix.map((r, i) => (i === idx ? { ...r, sla: e.target.value } : r)),
                            }))
                          }
                          placeholder="SLA"
                        />
                        <Input
                          value={row.surcharge}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              shippingMatrix: prev.shippingMatrix.map((r, i) => (i === idx ? { ...r, surcharge: e.target.value } : r)),
                            }))
                          }
                          placeholder="Surcharge"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setValues((prev) => ({ ...prev, shippingMatrix: prev.shippingMatrix.filter((_, i) => i !== idx) }))}
                          aria-label="Remove row"
                        >
                          <LniIcon name="lni-trash-3" size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => submitWithUploads('primary')} disabled={props.isSubmitting || isUploadingMedia || !isValid}>
                <LniIcon name={props.isSubmitting || isUploadingMedia ? 'lni-spinner-3' : 'lni-check'} spin={props.isSubmitting || isUploadingMedia} size={16} className="mr-2" />
                {isUploadingMedia ? 'Uploading images…' : props.submitLabel}
              </Button>
              {props.secondaryAction ? (
                <Button type="button" variant="secondary" onClick={() => submitWithUploads('secondary')} disabled={props.isSubmitting || isUploadingMedia || !isValid}>
                  {props.secondaryAction.label}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={props.onCancel} disabled={props.isSubmitting}>
                <LniIcon name="lni-arrow-left" size={16} className="mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Quick visual check before saving.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {values.avatarUrl ? <AvatarImage src={values.avatarUrl} alt={values.name || 'Category'} /> : null}
                <AvatarFallback>{(values.name || '?').charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold truncate">{values.name || 'Untitled category'}</div>
                  {values.icon ? <ValueIcon value={values.icon} size={18} className="text-muted-foreground" /> : null}
                </div>
                <div className="text-xs text-muted-foreground truncate">/{values.slug || 'slug'}</div>
              </div>
            </div>

            {values.imageUrl ? (
              <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted/20">
                <img src={values.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
            ) : (
              <div className="aspect-video w-full rounded-lg border bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">
                No cover image
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Key</p>
                <p className="font-medium break-all">{payload.key || '—'}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Taxonomy</p>
                <p className="font-medium break-all">{payload.taxonomyId || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
