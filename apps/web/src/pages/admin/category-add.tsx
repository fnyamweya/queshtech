import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Link, useLocation } from 'wouter'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { ActivityFeed } from '@/components/admin/activity-feed'
import { IconPicker } from '@/components/common/icon-picker'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { useCatalogTaxonomies } from '@/hooks/use-catalog-taxonomies'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { toast } from 'sonner'

const ROOT = 'root'

const activityEvents = [
  { actor: 'Jane Kim', action: 'Added hero banner', time: '1h ago', badge: 'Content' },
  { actor: 'Ops bot', action: 'Synced shipping matrix', time: '4h ago', badge: 'Ops' },
  { actor: 'Alex Curren', action: 'Tweaked SEO title', time: '1d ago', badge: 'SEO' },
]

export function AdminCategoryAddPage() {
  const [, setLocation] = useLocation()
  const { accessToken } = useAdminAuth()
  const { categories, createCategory } = useCatalogCategories({ token: accessToken, fallbackToMock: false })
  const { taxonomies } = useCatalogTaxonomies({ token: accessToken })
  const [isCreating, setIsCreating] = useState(false)

  const [form, setForm] = useState({
    taxonomyId: '',
    key: '',
    name: '',
    slug: '',
    parent: ROOT,
    description: '',
    icon: '',
    avatarUrl: '',
    imageUrl: '',
    order: '1',
    seoTitle: '',
    seoDescription: '',
    status: 'active',
    synonyms: '',
    keywords: '',
    level: 'primary',
    audience: 'all',
    returnPolicy: 'standard',
    taxCode: 'GEN-001',
    highlight: true,
    navPlacement: true,
    featured: false,
    banner: '',
    marginTarget: '18',
    availability: 'global',
    compliance: '',
    shippingProfile: 'standard',
    marketingHeadline: '',
    marketingSub: '',
    heroCta: '',
    heroCtaLink: '',
    contentPillar: '',
    story: '',
    themeColor: '#f97316',
    shippingMatrix: [
      { region: 'Nairobi & Kiambu', sla: 'Same/next day', surcharge: 'KES 0' },
      { region: 'Kenya (rest)', sla: '2-3 days', surcharge: 'KES 350' },
      { region: 'East Africa', sla: '4-6 days', surcharge: 'KES 1,200' },
    ],
  })

  const parentOptions = useMemo(
    () => [{ label: 'None (top level)', value: ROOT }, ...categories.map(c => ({ label: c.name, value: c.id }))],
    [categories]
  )

  const defaultTaxonomyId = useMemo(() => {
    const def = taxonomies.find((t) => t.isDefault)
    return def?.id ?? taxonomies[0]?.id ?? null
  }, [taxonomies])

  useEffect(() => {
    if (!defaultTaxonomyId) return
    setForm((prev) => (prev.taxonomyId ? prev : { ...prev, taxonomyId: defaultTaxonomyId }))
  }, [defaultTaxonomyId])

  const slugify = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const handleCreate = async (mode: 'done' | 'another') => {
    const taxonomyId = form.taxonomyId.trim()
    const name = form.name.trim()
    const slug = (form.slug.trim() || slugify(name)).trim()
    const key = (form.key.trim() || slug).trim()
    if (!name) {
      toast.error('Name is required')
      return
    }
    if (!taxonomyId) {
      toast.error('Taxonomy ID is required')
      return
    }
    if (!slug) {
      toast.error('Slug is required')
      return
    }
    if (!key) {
      toast.error('Key is required')
      return
    }

    const sortOrder = Number.parseInt(form.order, 10)
    const seoKeywords = form.keywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    setIsCreating(true)
    try {
      const created = await createCategory({
        taxonomyId,
        name,
        slug,
        key,
        parentId: form.parent === ROOT ? null : form.parent,
        description: form.description,
        isActive: form.status === 'active',
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
        icon: form.icon || undefined,
        avatarUrl: form.avatarUrl || undefined,
        imageUrl: form.imageUrl || undefined,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        seoKeywords,
      })
      if (!created) {
        toast.error('Failed to create category')
        return
      }

      toast.success('Category created')

      if (mode === 'another') {
        setForm(prev => ({ ...prev, name: '', slug: '', key: '', description: '' }))
        return
      }

      setLocation('/axis/categories')
    } catch (e: any) {
      toast.error('Failed to create category', { description: e?.message || 'Please try again.' })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <AdminLayout
      title="Add Category"
      description="Create a new category with multi-level hierarchy and SEO metadata."
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Category blueprint</CardTitle>
              <CardDescription>Structure, naming, and discoverability.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Taxonomy (required)</label>
                    {taxonomies.length > 0 ? (
                      <Select value={form.taxonomyId} onValueChange={(taxonomyId) => setForm((prev) => ({ ...prev, taxonomyId }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select taxonomy" />
                        </SelectTrigger>
                        <SelectContent>
                          {taxonomies.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} ({t.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={form.taxonomyId}
                        onChange={(e) => setForm((prev) => ({ ...prev, taxonomyId: e.target.value }))}
                        placeholder="Enter taxonomy ID"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Key</label>
                    <Input
                      value={form.key}
                      onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
                      placeholder="e.g. wearables"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={form.name}
                    onChange={(e) => {
                      const nextName = e.target.value
                        setForm(prev => ({
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
                    value={form.slug}
                      onChange={(e) => {
                        const nextSlug = e.target.value
                        setForm((prev) => ({ ...prev, slug: nextSlug, key: prev.key ? prev.key : nextSlug }))
                      }}
                    placeholder="wearables"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Parent category</label>
                  <Select value={form.parent} onValueChange={(parent) => setForm({ ...form, parent })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Level</label>
                  <Select value={form.level} onValueChange={(level) => setForm({ ...form, level })}>
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
                  <label className="text-sm font-medium">Display order</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Icon</label>
                  <IconPicker
                    value={form.icon}
                    onChange={(icon) => setForm((prev) => ({ ...prev, icon }))}
                    placeholder="Search Phosphor icons"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Keywords</label>
                  <Input
                    value={form.keywords}
                    onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                    placeholder="smartwatch, tracker, fitness"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Synonyms</label>
                  <Input
                    value={form.synonyms}
                    onChange={(e) => setForm({ ...form, synonyms: e.target.value })}
                    placeholder="wearable tech, health watch"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Avatar URL</label>
                  <Input
                    value={form.avatarUrl}
                    onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                    placeholder="https://cdn.example.com/cat/phones-avatar.png"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Image URL</label>
                  <Input
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    placeholder="https://cdn.example.com/cat/phones.png"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe what lives under this category."
                />
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">SEO title</label>
                  <Input
                    value={form.seoTitle}
                    onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                    placeholder="Title for search"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SEO description</label>
                  <Input
                    value={form.seoDescription}
                    onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                    placeholder="Short meta description"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Audience</label>
                  <Select value={form.audience} onValueChange={(audience) => setForm({ ...form, audience })}>
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
                  <Select value={form.returnPolicy} onValueChange={(returnPolicy) => setForm({ ...form, returnPolicy })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select policy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (14 days)</SelectItem>
                      <SelectItem value="extended">Extended (30 days)</SelectItem>
                      <SelectItem value="final-sale">Final sale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tax code</label>
                  <Input
                    value={form.taxCode}
                    onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
                    placeholder="GEN-001"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Availability</label>
                  <Select value={form.availability} onValueChange={(availability) => setForm({ ...form, availability })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="emea">EMEA</SelectItem>
                      <SelectItem value="na">North America</SelectItem>
                      <SelectItem value="apac">APAC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Shipping profile</label>
                  <Select value={form.shippingProfile} onValueChange={(shippingProfile) => setForm({ ...form, shippingProfile })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="express">Express</SelectItem>
                      <SelectItem value="bulky">Bulky/oversize</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Margin target (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.marginTarget}
                    onChange={(e) => setForm({ ...form, marginTarget: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Merchandising toggles</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Highlight</p>
                      <p className="text-xs text-muted-foreground">Badge on listings</p>
                    </div>
                    <Switch checked={form.highlight} onCheckedChange={(highlight) => setForm({ ...form, highlight })} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Nav placement</p>
                      <p className="text-xs text-muted-foreground">Show in top nav</p>
                    </div>
                    <Switch checked={form.navPlacement} onCheckedChange={(navPlacement) => setForm({ ...form, navPlacement })} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-card/70 px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Feature flag</p>
                      <p className="text-xs text-muted-foreground">Pilot placement</p>
                    </div>
                    <Switch checked={form.featured} onCheckedChange={(featured) => setForm({ ...form, featured })} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Compliance / notes</label>
                <Textarea
                  rows={3}
                  value={form.compliance}
                  onChange={(e) => setForm({ ...form, compliance: e.target.value })}
                  placeholder="Return exceptions, regulated products, age gates…"
                />
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={form.status === 'active' ? 'default' : 'outline'}>
                  {form.status === 'active' ? 'Active' : 'Hidden'}
                </Badge>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.status === 'active'}
                    onCheckedChange={(checked) => setForm({ ...form, status: checked ? 'active' : 'hidden' })}
                  />
                  <span className="text-sm text-muted-foreground">{form.status === 'active' ? 'Active' : 'Deactivate'}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => handleCreate('done')} disabled={isCreating}>
                  {isCreating ? 'Creating…' : 'Create category'}
                </Button>
                <Button variant="secondary" onClick={() => handleCreate('another')} disabled={isCreating}>
                  Save & create another
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/axis/categories">Cancel</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Content & storytelling</CardTitle>
              <CardDescription>Assets that power the landing experience.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Marketing headline</label>
                  <Input
                    value={form.marketingHeadline}
                    onChange={(e) => setForm({ ...form, marketingHeadline: e.target.value })}
                    placeholder="e.g. Track wellness effortlessly"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subcopy</label>
                  <Input
                    value={form.marketingSub}
                    onChange={(e) => setForm({ ...form, marketingSub: e.target.value })}
                    placeholder="Always-on insights for every lifestyle."
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hero banner URL</label>
                  <Input
                    value={form.banner}
                    onChange={(e) => setForm({ ...form, banner: e.target.value })}
                    placeholder="https://cdn.example.com/banners/wearables.jpg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Featured story</label>
                  <Input
                    value={form.story}
                    onChange={(e) => setForm({ ...form, story: e.target.value })}
                    placeholder="e.g. Best devices for busy professionals"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Primary CTA label</label>
                  <Input
                    value={form.heroCta}
                    onChange={(e) => setForm({ ...form, heroCta: e.target.value })}
                    placeholder="Shop wearables"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CTA link</label>
                  <Input
                    value={form.heroCtaLink}
                    onChange={(e) => setForm({ ...form, heroCtaLink: e.target.value })}
                    placeholder="/electronics/wearables"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Theme color</label>
                  <Input
                    type="color"
                    value={form.themeColor}
                    onChange={(e) => setForm({ ...form, themeColor: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Long description</label>
                <Textarea
                  rows={4}
                  value={form.contentPillar}
                  onChange={(e) => setForm({ ...form, contentPillar: e.target.value })}
                  placeholder="Narrative copy for the category landing page."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Guided filters</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {['Use case', 'Price band', 'Brand', 'Compatibility', 'Warranty'].map((filter) => {
                    const filterId = filter.toLowerCase().replace(/\s+/g, '-')
                    return (
                      <div key={filter} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-2">
                        <Checkbox id={filterId} defaultChecked />
                        <label htmlFor={filterId} className="text-sm">{filter}</label>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Preview & governance</CardTitle>
              <CardDescription>Health, placement, and quick actions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Completeness</p>
                  <p className="text-lg font-semibold">78%</p>
                  <p className="text-xs text-muted-foreground">Add banner + SEO copy</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Product coverage</p>
                  <p className="text-lg font-semibold">142 SKUs</p>
                  <p className="text-xs text-muted-foreground">12 orphaned items</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Search lift</p>
                  <p className="text-lg font-semibold">+6.2%</p>
                  <p className="text-xs text-muted-foreground">vs. last 30 days</p>
                </div>
              </div>

              <div className="rounded-lg border bg-card/70 p-3">
                <p className="text-[11px] uppercase text-muted-foreground tracking-wide mb-2">Breadcrumb preview</p>
                <p className="text-sm font-medium">Home / Electronics / {form.name || 'New category'}</p>
                <p className="text-xs text-muted-foreground mt-1">Slug: /{form.slug || 'new-category'}</p>
              </div>

              <div className="rounded-lg border bg-card/70 p-3 space-y-2">
                <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Channel visibility</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {['Web', 'Mobile app', 'POS', 'Marketplace'].map((channel) => (
                    <label key={channel} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-2">
                      <Checkbox defaultChecked />
                      <span>{channel}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border bg-card/70 p-3">
                <p className="text-[11px] uppercase text-muted-foreground tracking-wide mb-2">Search snippet</p>
                <div className="rounded-md border bg-white p-3 space-y-1">
                  <p className="text-base font-semibold text-[#1a0dab]">{form.seoTitle || form.name || 'Category title'}</p>
                  <p className="text-xs text-[#006621]">https://www.eujo.com/categories/{form.slug || 'new-category'}</p>
                  <p className="text-sm text-[#4d5156] line-clamp-2">{form.seoDescription || 'Meta description preview goes here for the category.'}</p>
                </div>
              </div>

              <div className="rounded-lg border bg-card/70 p-3 space-y-2">
                <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Facet mapping</p>
                <div className="grid gap-2">
                  {[
                    { label: 'Brand', status: 'Linked' },
                    { label: 'Price', status: 'Linked' },
                    { label: 'Compatibility', status: 'Pending' },
                    { label: 'Material', status: 'Pending' },
                  ].map((facet) => (
                    <div key={facet.label} className="flex items-center justify-between rounded-md border bg-muted/20 px-2 py-2">
                      <span>{facet.label}</span>
                      <Badge variant={facet.status === 'Linked' ? 'default' : 'outline'}>
                        {facet.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Suggested tags</p>
                <div className="flex flex-wrap gap-2">
                  {['Health', 'Fitness', 'iOS', 'Android', 'Waterproof', 'Giftable'].map((tag) => (
                    <Button key={tag} variant="outline" size="sm" className="rounded-full">
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Shipping matrix</CardTitle>
              <CardDescription>Regional SLAs and surcharges.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                {form.shippingMatrix.map((row, idx) => (
                  <div key={`${row.region}-${idx}`} className="grid grid-cols-3 gap-2 rounded-md border bg-card/70 px-2 py-2">
                    <div>
                      <p className="text-[11px] uppercase text-muted-foreground">Region</p>
                      <p className="font-medium">{row.region}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase text-muted-foreground">Lead time</p>
                      <p className="font-medium">{row.sla}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase text-muted-foreground">Surcharge</p>
                      <p className="font-medium">{row.surcharge}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Matrix can sync to shipping profiles and storefront flags.</p>
            </CardContent>
          </Card>

          <ActivityFeed events={activityEvents} showAddButton />
        </div>
      </div>
    </AdminLayout>
  )
}
