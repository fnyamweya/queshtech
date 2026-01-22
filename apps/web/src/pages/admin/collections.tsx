import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useAdminCollections, type AdminCollectionInput } from '@/hooks/use-catalog-collections'
import { useAdminBanners, type AdminBannerInput } from '@/hooks/use-banners'
import { IconPicker } from '@/components/common/icon-picker'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { resolvePhosphorIcon } from '@/lib/phosphor'

export function AdminCollectionsPage() {
  const { accessToken } = useAdminAuth()
  const { collections, createCollection, isLoading: isCollectionsLoading, refresh: refreshCollections } = useAdminCollections({ token: accessToken })
  const { banners, createBanner, isLoading: isBannersLoading, refresh: refreshBanners } = useAdminBanners({ token: accessToken })

  const landingCollections = useMemo(() => collections.filter((c) => (c.type || '').toLowerCase() === 'landing'), [collections])

  const [collectionDraft, setCollectionDraft] = useState<AdminCollectionInput>({
    name: '',
    slug: '',
    type: 'landing',
    description: '',
    icon: '',
    avatarUrl: '',
    imageUrl: '',
    heroImageUrl: '',
    bannerImageUrl: '',
    badge: 'Landing',
    sortOrder: landingCollections.length + 1,
    isActive: true,
    isHomepage: false,
  })

  const [bannerDraft, setBannerDraft] = useState<AdminBannerInput>({
    title: '',
    subtitle: '',
    description: '',
    imageUrl: '',
    imageAlt: '',
    href: '',
    placementSection: 'hero',
    priority: (banners[0]?.priority || 0) + 1,
    ctaLabel: 'Shop now',
    isActive: true,
    landingSection: '',
    targetKind: 'category',
    targetRefId: '',
  })

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collectionDraft.name || !collectionDraft.slug) {
      toast.error('Name and slug are required for a collection')
      return
    }

    try {
      const payload: AdminCollectionInput = {
        ...collectionDraft,
        productIds: collectionDraft.productIds?.filter(Boolean),
        categoryIds: collectionDraft.categoryIds?.filter(Boolean),
      }
      const created = await createCollection(payload)
      if (created) {
        toast.success('Collection created', { description: 'Landing page content updated.' })
        refreshCollections()
        setCollectionDraft((prev) => ({
          ...prev,
          name: '',
          slug: '',
          description: '',
          icon: '',
          avatarUrl: '',
          imageUrl: '',
          heroImageUrl: '',
          bannerImageUrl: '',
          isHomepage: prev.isHomepage,
        }))
      }
    } catch (error: any) {
      toast.error('Failed to create collection', { description: error?.message || 'Request failed' })
    }
  }

  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bannerDraft.title || !bannerDraft.imageUrl) {
      toast.error('Title and image URL are required for a banner')
      return
    }

    try {
      const created = await createBanner(bannerDraft)
      if (created) {
        toast.success('Banner saved', { description: 'Landing page banners refreshed.' })
        refreshBanners()
        setBannerDraft((prev) => ({
          ...prev,
          title: '',
          subtitle: '',
          description: '',
          imageUrl: '',
          imageAlt: '',
          href: '',
          landingSection: '',
          targetRefId: '',
          priority: (banners[0]?.priority || 0) + 1,
        }))
      }
    } catch (error: any) {
      toast.error('Failed to create banner', { description: error?.message || 'Request failed' })
    }
  }

  return (
    <AdminLayout
      title="Landing page"
      description="Control which collections and banners render on the public landing page."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Create landing collection</CardTitle>
              <CardDescription>Collections marked as type "landing" are rendered on the storefront home page.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateCollection}>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="collection-name">Name</Label>
                    <Input
                      id="collection-name"
                      value={collectionDraft.name}
                      onChange={(e) => setCollectionDraft((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="New Arrivals"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="collection-slug">Slug</Label>
                    <Input
                      id="collection-slug"
                      value={collectionDraft.slug}
                      onChange={(e) => setCollectionDraft((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="new-arrivals"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={collectionDraft.type || 'landing'}
                      onValueChange={(value) => setCollectionDraft((prev) => ({ ...prev, type: value as AdminCollectionInput['type'] }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landing">Landing</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="smart">Smart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="collection-order">Sort order</Label>
                    <Input
                      id="collection-order"
                      type="number"
                      min={0}
                      value={collectionDraft.sortOrder ?? ''}
                      onChange={(e) => setCollectionDraft((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collection-description">Description</Label>
                  <Textarea
                    id="collection-description"
                    placeholder="What this collection highlights"
                    value={collectionDraft.description}
                    onChange={(e) => setCollectionDraft((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Icon</Label>
                    <IconPicker
                      value={collectionDraft.icon}
                      onChange={(icon) => setCollectionDraft((prev) => ({ ...prev, icon }))}
                      placeholder="Search Phosphor icons"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="collection-avatar">Avatar URL</Label>
                    <Input
                      id="collection-avatar"
                      value={collectionDraft.avatarUrl || ''}
                      onChange={(e) => setCollectionDraft((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                      placeholder="https://cdn.example.com/collections/avatar.png"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collection-image">Image URL</Label>
                  <Input
                    id="collection-image"
                    value={collectionDraft.imageUrl || ''}
                    onChange={(e) => setCollectionDraft((prev) => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://cdn.example.com/collections/image.png"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="collection-hero">Hero image URL</Label>
                    <Input
                      id="collection-hero"
                      value={collectionDraft.heroImageUrl || ''}
                      onChange={(e) => setCollectionDraft((prev) => ({ ...prev, heroImageUrl: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="collection-banner">Banner image URL</Label>
                    <Input
                      id="collection-banner"
                      value={collectionDraft.bannerImageUrl || ''}
                      onChange={(e) => setCollectionDraft((prev) => ({ ...prev, bannerImageUrl: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="collection-products">Product handles/IDs (comma separated)</Label>
                    <Input
                      id="collection-products"
                      value={collectionDraft.productIds?.join(',') || ''}
                      onChange={(e) =>
                        setCollectionDraft((prev) => ({
                          ...prev,
                          productIds: e.target.value
                            .split(',')
                            .map((v) => v.trim())
                            .filter(Boolean),
                        }))
                      }
                      placeholder="prod-1, prod-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="collection-categories">Category IDs (comma separated)</Label>
                    <Input
                      id="collection-categories"
                      value={collectionDraft.categoryIds?.join(',') || ''}
                      onChange={(e) =>
                        setCollectionDraft((prev) => ({
                          ...prev,
                          categoryIds: e.target.value
                            .split(',')
                            .map((v) => v.trim())
                            .filter(Boolean),
                        }))
                      }
                      placeholder="cat-1, cat-2"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="collection-badge">Badge (optional)</Label>
                    <Input
                      id="collection-badge"
                      value={collectionDraft.badge || ''}
                      onChange={(e) => setCollectionDraft((prev) => ({ ...prev, badge: e.target.value }))}
                      placeholder="Landing"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Show on homepage</Label>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="text-sm text-muted-foreground">Use in homepage selection lists</span>
                      <Switch
                        checked={Boolean(collectionDraft.isHomepage)}
                        onCheckedChange={(value) => setCollectionDraft((prev) => ({ ...prev, isHomepage: value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="collection-active">Status</Label>
                    <Select
                      value={collectionDraft.isActive ? 'active' : 'inactive'}
                      onValueChange={(value) => setCollectionDraft((prev) => ({ ...prev, isActive: value === 'active' }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={isCollectionsLoading}>
                    Create collection
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Landing collections</CardTitle>
              <CardDescription>Currently visible on the customer home page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {landingCollections.length === 0 && (
                <p className="text-sm text-muted-foreground">No landing collections yet. Create one above.</p>
              )}
              {landingCollections.map((collection) => (
                <div key={collection.id} className="border border-border rounded-lg p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-9 w-9">
                        {collection.avatarUrl || collection.imageUrl ? (
                          <AvatarImage src={collection.avatarUrl || collection.imageUrl} alt={collection.title || collection.name || 'Collection'} />
                        ) : null}
                        <AvatarFallback>
                          {(() => {
                            const Icon = resolvePhosphorIcon(collection.icon)
                            return Icon ? <Icon size={16} weight="bold" /> : (collection.title || collection.name || 'C').charAt(0)
                          })()}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="font-semibold">{collection.title || collection.name || collection.slug}</h3>
                      {collection.badge ? <Badge variant="outline">{collection.badge}</Badge> : null}
                      {collection.badge ? <Badge variant="outline">{collection.badge}</Badge> : null}
                      {collection.isHomepage ? <Badge className="bg-primary/10 text-primary border-primary/20">Homepage</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{collection.description || 'No description provided.'}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Type: {collection.type || 'landing'}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>Sort: {collection.sortOrder ?? 0}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>{(collection.products || []).length} products linked</span>
                    </div>
                  </div>
                  <Badge variant={collection.isActive ? 'secondary' : 'outline'}>
                    {collection.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Landing banners</CardTitle>
              <CardDescription>Control hero and feature banners shown on the landing page.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateBanner}>
                <div className="space-y-2">
                  <Label htmlFor="banner-title">Title</Label>
                  <Input
                    id="banner-title"
                    value={bannerDraft.title}
                    onChange={(e) => setBannerDraft((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Headline for the hero banner"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner-subtitle">Subtitle</Label>
                  <Input
                    id="banner-subtitle"
                    value={bannerDraft.subtitle || ''}
                    onChange={(e) => setBannerDraft((prev) => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="Short supporting text"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner-description">Description</Label>
                  <Textarea
                    id="banner-description"
                    value={bannerDraft.description || ''}
                    onChange={(e) => setBannerDraft((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional body copy"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="banner-image">Image URL</Label>
                    <Input
                      id="banner-image"
                      value={bannerDraft.imageUrl}
                      onChange={(e) => setBannerDraft((prev) => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="https://..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="banner-image-alt">Image alt text</Label>
                    <Input
                      id="banner-image-alt"
                      value={bannerDraft.imageAlt || ''}
                      onChange={(e) => setBannerDraft((prev) => ({ ...prev, imageAlt: e.target.value }))}
                      placeholder="Describe the banner image"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner-link">Link URL</Label>
                  <Input
                    id="banner-link"
                    value={bannerDraft.href || ''}
                    onChange={(e) => setBannerDraft((prev) => ({ ...prev, href: e.target.value }))}
                    placeholder="/category/new-arrivals"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target kind</Label>
                    <Select
                      value={bannerDraft.targetKind || 'category'}
                      onValueChange={(value) => setBannerDraft((prev) => ({ ...prev, targetKind: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="collection">Collection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="banner-target-ref">Target ref (category/product ID)</Label>
                    <Input
                      id="banner-target-ref"
                      value={bannerDraft.targetRefId || ''}
                      onChange={(e) => setBannerDraft((prev) => ({ ...prev, targetRefId: e.target.value }))}
                      placeholder="uuid-of-category"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Placement section</Label>
                    <Select
                      value={bannerDraft.placementSection || 'hero'}
                      onValueChange={(value) => setBannerDraft((prev) => ({ ...prev, placementSection: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hero">Hero</SelectItem>
                        <SelectItem value="feature">Feature</SelectItem>
                        <SelectItem value="grid">Grid/Tile</SelectItem>
                        <SelectItem value="strip">Strip</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="banner-landing-section">Landing section</Label>
                    <Input
                      id="banner-landing-section"
                      value={bannerDraft.landingSection || ''}
                      onChange={(e) => setBannerDraft((prev) => ({ ...prev, landingSection: e.target.value }))}
                      placeholder="topDeals"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="banner-priority">Priority</Label>
                    <Input
                      id="banner-priority"
                      type="number"
                      min={0}
                      value={bannerDraft.priority ?? ''}
                      onChange={(e) => setBannerDraft((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner-cta">CTA label</Label>
                  <Input
                    id="banner-cta"
                    value={bannerDraft.ctaLabel || ''}
                    onChange={(e) => setBannerDraft((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                    placeholder="Shop now"
                  />
                </div>

                <Button type="submit" disabled={isBannersLoading}>
                  Save banner
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Existing banners</CardTitle>
              <CardDescription>Ordered by the backend priority or position.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {banners.length === 0 && <p className="text-sm text-muted-foreground">No banners configured yet.</p>}
              {banners.map((banner) => (
                <div key={banner.id} className="border border-border rounded-lg p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{banner.title || 'Untitled banner'}</h3>
                      {banner.placement ? <Badge variant="outline">{banner.placements?.[0]?.section || banner.placement}</Badge> : null}
                      {banner.landingSection ? <Badge variant="secondary">{banner.landingSection}</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{banner.description || banner.subtitle || 'No description'}</p>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>Priority: {banner.priority ?? 'n/a'}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>{banner.isActive ? 'Active' : 'Inactive'}</span>
                      {banner.targets?.[0]?.kind ? (
                        <>
                          <Separator orientation="vertical" className="h-4" />
                          <span>
                            Target: {banner.targets[0].kind}
                            {banner.targets[0].refId ? ` (${banner.targets[0].refId})` : ''}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <Badge variant={banner.isActive ? 'secondary' : 'outline'}>{banner.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
