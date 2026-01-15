import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Link, useRoute } from 'wouter'
import { ActivityFeed } from '@/components/admin/activity-feed'
import { IconPicker } from '@/components/common/icon-picker'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { toast } from 'sonner'
import { endpoints } from '@/lib/endpoints'

const ROOT = 'root'

const categoryMap = {
  electronics: {
    name: 'Electronics',
    slug: 'electronics',
    parent: 'root',
    description: 'Devices, accessories, and smart tech.',
    icon: '🔌',
    order: '1',
    seoTitle: 'Shop Electronics',
    seoDescription: 'Best electronics, devices, and accessories at great prices.',
    status: 'active',
    keywords: 'tech, devices, gadgets',
    synonyms: 'consumer electronics',
    level: 'primary',
    audience: 'all',
    returnPolicy: 'standard',
    taxCode: 'ELEC-001',
    highlight: true,
    navPlacement: true,
    featured: false,
    banner: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
    tile: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=600&q=80',
    marginTarget: '16',
    availability: 'global',
    compliance: 'Batteries require MSDS on file.',
    shippingProfile: 'standard',
    marketingHeadline: 'Tech that fits every life',
    marketingSub: 'Curated devices, faster delivery, happier teams.',
    heroCta: 'Shop electronics',
    heroCtaLink: '/electronics',
    contentPillar: 'Stories about productivity, wellness, and creativity with tech.',
    themeColor: '#2563eb',
    shippingMatrix: [
      { region: 'Nairobi & Kiambu', sla: 'Same/next day', surcharge: 'KES 0' },
      { region: 'Kenya (rest)', sla: '2-3 days', surcharge: 'KES 350' },
      { region: 'East Africa', sla: '4-6 days', surcharge: 'KES 1,200' },
    ],
  },
  'electronics/smartphones': {
    name: 'Smartphones',
    slug: 'smartphones',
    parent: 'electronics',
    description: 'Flagship and midrange phones, accessories, and wearables.',
    icon: '📱',
    order: '3',
    seoTitle: 'Shop Smartphones',
    seoDescription: 'Latest smartphones, deals, and accessories.',
    status: 'active',
    keywords: 'phone, mobile, smartphone',
    synonyms: 'mobiles, cell phones',
    level: 'secondary',
    audience: 'all',
    returnPolicy: 'extended',
    taxCode: 'ELEC-010',
    highlight: true,
    navPlacement: true,
    featured: true,
    banner: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
    tile: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=600&q=80',
    marginTarget: '18',
    availability: 'emea',
    compliance: 'IMEI capture required. Regional SAR disclosures.',
    shippingProfile: 'express',
    marketingHeadline: 'Stay connected, stay ahead',
    marketingSub: 'Flagships, midrange, and accessories with verified warranties.',
    heroCta: 'Shop smartphones',
    heroCtaLink: '/electronics/smartphones',
    contentPillar: 'Upgrade pathways, trade-ins, and protection stories.',
    themeColor: '#f97316',
    shippingMatrix: [
      { region: 'Nairobi & Kiambu', sla: 'Same/next day', surcharge: 'KES 0' },
      { region: 'Kenya (rest)', sla: '2-3 days', surcharge: 'KES 450' },
      { region: 'East Africa', sla: '4-6 days', surcharge: 'KES 1,400' },
    ],
  },
}

const defaultForm = {
  name: '',
  slug: '',
  parent: 'root',
  description: '',
  icon: '',
  avatarUrl: '',
  imageUrl: '',
  order: '1',
  seoTitle: '',
  seoDescription: '',
  status: 'active',
  keywords: '',
  synonyms: '',
  level: 'primary',
  audience: 'all',
  returnPolicy: 'standard',
  taxCode: 'GEN-001',
  highlight: true,
  navPlacement: true,
  featured: false,
  banner: '',
  tile: '',
  marginTarget: '18',
  availability: 'global',
  compliance: '',
  shippingProfile: 'standard',
  marketingHeadline: '',
  marketingSub: '',
  heroCta: '',
  heroCtaLink: '',
  contentPillar: '',
  themeColor: '#f97316',
  shippingMatrix: [
    { region: 'Nairobi & Kiambu', sla: 'Same/next day', surcharge: 'KES 0' },
    { region: 'Kenya (rest)', sla: '2-3 days', surcharge: 'KES 350' },
  ],
}

const feed = [
  { actor: 'Jane Kim', action: 'updated SEO description', time: '2h ago' },
  { actor: 'Alex Curren', action: 'added hero banner', time: '1d ago' },
  { actor: 'Chelsea Hagon', action: 'linked price facet', time: '3d ago' },
]

export function AdminCategoryEditPage() {
  const [, params] = useRoute('/axis/categories/:id/edit')
  const { accessToken, authorizedRequest } = useAdminAuth()
  const { categories, isLoading: categoriesLoading } = useCatalogCategories({ token: accessToken, fallbackToMock: false })

  const selectedFromApi = useMemo(() => {
    if (!params?.id) return null
    return categories.find(c => c.id === params.id) ?? categories.find(c => c.slug === params.id) ?? null
  }, [categories, params?.id])

  const selectedFromDemo = useMemo(
    () => categoryMap[(params?.id as keyof typeof categoryMap) || 'electronics/smartphones'] ?? defaultForm,
    [params]
  )

  const initialForm = useMemo(() => {
    if (selectedFromApi) {
      return {
        ...defaultForm,
        name: selectedFromApi.name,
        slug: selectedFromApi.slug,
        description: selectedFromApi.description || '',
        parent: selectedFromApi.parentId || ROOT,
        icon: selectedFromApi.icon || '',
        avatarUrl: selectedFromApi.avatarUrl || '',
        imageUrl: selectedFromApi.imageUrl || selectedFromApi.image || '',
      }
    }

    return { ...defaultForm, ...selectedFromDemo }
  }, [selectedFromApi, selectedFromDemo])

  const [form, setForm] = useState(initialForm)
  const [hasHydratedInitial, setHasHydratedInitial] = useState(false)

  useEffect(() => {
    if (hasHydratedInitial) return
    if (categoriesLoading) return
    setForm(initialForm)
    setHasHydratedInitial(true)
  }, [categoriesLoading, hasHydratedInitial, initialForm])

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!params?.id) return
    setIsSaving(true)
    try {
      await authorizedRequest(endpoints.catalog.categoryById(params.id), {
        method: 'PATCH',
        body: {
          name: form.name,
          slug: form.slug,
          parentId: form.parent === ROOT ? null : form.parent,
          description: form.description,
          status: form.status,
          icon: form.icon || undefined,
          avatarUrl: form.avatarUrl || undefined,
          imageUrl: form.imageUrl || undefined,
        },
      })
      toast.success('Category updated')
    } catch (e: any) {
      toast.error('Failed to update category', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminLayout
      title={`Edit Category ${params?.id ?? ''}`}
      description="Update category hierarchy, assets, and metadata."
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
                  <label className="text-sm font-medium">Name</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Slug</label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
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
                      <SelectItem value={ROOT}>None</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
                  <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Synonyms</label>
                  <Input value={form.synonyms} onChange={(e) => setForm({ ...form, synonyms: e.target.value })} />
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
                />
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">SEO title</label>
                  <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SEO description</label>
                  <Input value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
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
                  <Input value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} />
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hero banner URL</label>
                  <Input value={form.banner} onChange={(e) => setForm({ ...form, banner: e.target.value })} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tile / card image</label>
                  <Input value={form.tile} onChange={(e) => setForm({ ...form, tile: e.target.value })} placeholder="https://..." />
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
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button variant="secondary" onClick={handleSave} disabled={isSaving}>
                  Save & stay on page
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/axis/categories">Cancel</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Content & guided filters</CardTitle>
              <CardDescription>Assets and filters that power the landing experience.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Marketing headline</label>
                  <Input
                    value={form.marketingHeadline}
                    onChange={(e) => setForm({ ...form, marketingHeadline: e.target.value })}
                    placeholder="e.g. Stay connected, stay ahead"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subcopy</label>
                  <Input
                    value={form.marketingSub}
                    onChange={(e) => setForm({ ...form, marketingSub: e.target.value })}
                    placeholder="Flagships and midrange with verified warranties."
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Primary CTA label</label>
                  <Input
                    value={form.heroCta}
                    onChange={(e) => setForm({ ...form, heroCta: e.target.value })}
                    placeholder="Shop smartphones"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CTA link</label>
                  <Input
                    value={form.heroCtaLink}
                    onChange={(e) => setForm({ ...form, heroCtaLink: e.target.value })}
                    placeholder="/electronics/smartphones"
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide mb-2">Hero preview</p>
                  <div
                    className="aspect-video w-full rounded-md bg-center bg-cover"
                    style={{ backgroundImage: `url(${form.banner || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80'})` }}
                  />
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Tile preview</p>
                  <div
                    className="aspect-[4/3] w-full rounded-md bg-center bg-cover"
                    style={{ backgroundImage: `url(${form.tile || 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=600&q=80'})` }}
                  />
                  <p className="text-sm text-muted-foreground">Icon: {form.icon || 'Add emoji or icon code'}</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Long description</label>
                <Textarea
                  rows={3}
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
                  <p className="text-lg font-semibold">82%</p>
                  <p className="text-xs text-muted-foreground">Add regional copy</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Product coverage</p>
                  <p className="text-lg font-semibold">142 SKUs</p>
                  <p className="text-xs text-muted-foreground">8 orphaned items</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Search lift</p>
                  <p className="text-lg font-semibold">+6.2%</p>
                  <p className="text-xs text-muted-foreground">vs. last 30 days</p>
                </div>
              </div>

              <div className="rounded-lg border bg-card/70 p-3">
                <p className="text-[11px] uppercase text-muted-foreground tracking-wide mb-2">Breadcrumb preview</p>
                <p className="text-sm font-medium">Home / Electronics / {form.name || 'Category'}</p>
                <p className="text-xs text-muted-foreground mt-1">Slug: /{form.slug || 'new-category'}</p>
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

          <ActivityFeed events={feed} showAddButton />
        </div>
      </div>
    </AdminLayout>
  )
}
