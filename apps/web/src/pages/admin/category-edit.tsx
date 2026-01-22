import { useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { CategoryEditor, type CategoryEditorSubmitPayload } from '@/components/admin/catalog/category-editor'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { useCatalogTaxonomies } from '@/hooks/use-catalog-taxonomies'

export function AdminCategoryEditPage() {
  const [, setLocation] = useLocation()
  const [, params] = useRoute('/axis/categories/:id/edit')
  const categoryId = params?.id

  const { accessToken } = useAdminAuth()
  const { categories, isLoading, error, updateCategory } = useCatalogCategories({ token: accessToken, fallbackToMock: false })
  const { taxonomies } = useCatalogTaxonomies({ token: accessToken })

  const category = useMemo(() => {
    if (!categoryId) return null
    return categories.find((c) => c.id === categoryId) ?? categories.find((c) => c.slug === categoryId) ?? null
  }, [categories, categoryId])

  const initial = useMemo(() => {
    if (!category) return undefined
    return {
      taxonomyId: category.taxonomyId || '',
      key: category.key || '',
      name: category.name || '',
      slug: category.slug || '',
      parentId: category.parentId || null,
      description: category.description || '',
      isActive: category.isActive ?? true,
      sortOrder: typeof category.sortOrder === 'number' ? String(category.sortOrder) : '',
      icon: category.icon || '',
      avatarUrl: category.avatarUrl || '',
      imageUrl: category.imageUrl || category.image || '',
      seoTitle: category.seoTitle || '',
      seoDescription: category.seoDescription || '',
      seoKeywords: Array.isArray(category.seoKeywords) ? category.seoKeywords.join(', ') : '',
      urlPath: category.urlPath || '',
      locale: category.locale || 'en',
      synonyms: category.synonyms || '',
      keywords: category.keywords || '',
      level: category.level || 'primary',
      audience: category.audience || 'all',
      returnPolicy: category.returnPolicy || 'standard',
      taxCode: category.taxCode || 'GEN-001',
      highlight: category.highlight ?? false,
      navPlacement: category.navPlacement ?? true,
      featured: category.featured ?? false,
      banner: category.banner || '',
      marginTarget: typeof category.marginTarget === 'number' ? String(category.marginTarget) : '18',
      availability: category.availability || 'global',
      compliance: category.compliance || '',
      shippingProfile: category.shippingProfile || 'standard',
      marketingHeadline: category.marketingHeadline || '',
      marketingSub: category.marketingSub || '',
      heroCta: category.heroCta || '',
      heroCtaLink: category.heroCtaLink || '',
      contentPillar: category.contentPillar || '',
      story: category.story || '',
      themeColor: category.themeColor || '#f97316',
      shippingMatrix: category.shippingMatrix || [],
    }
  }, [category])

  const [isSaving, setIsSaving] = useState(false)

  const saveFromPayload = async (payload: CategoryEditorSubmitPayload) => {
    if (!categoryId) return null
    if (!payload.name) {
      toast.error('Name is required')
      return null
    }
    if (!payload.slug) {
      toast.error('Slug is required')
      return null
    }

    setIsSaving(true)
    try {
      const updated = await updateCategory(categoryId, {
        taxonomyId: payload.taxonomyId,
        key: payload.key,
        name: payload.name,
        slug: payload.slug,
        parentId: payload.parentId ?? null,
        description: payload.description || '',
        isActive: payload.isActive,
        sortOrder: payload.sortOrder,
        order: payload.order,
        icon: payload.icon || '',
        avatarUrl: payload.avatarUrl,
        imageUrl: payload.imageUrl,
        seoTitle: payload.seoTitle || '',
        seoDescription: payload.seoDescription || '',
        seoKeywords: payload.seoKeywords || [],
        urlPath: payload.urlPath || '',
        synonyms: payload.synonyms || '',
        keywords: payload.keywords || '',
        level: payload.level || '',
        audience: payload.audience || '',
        returnPolicy: payload.returnPolicy || '',
        taxCode: payload.taxCode || '',
        highlight: payload.highlight ?? false,
        navPlacement: payload.navPlacement ?? true,
        featured: payload.featured ?? false,
        banner: payload.banner || '',
        marginTarget: payload.marginTarget,
        availability: payload.availability || '',
        compliance: payload.compliance || '',
        shippingProfile: payload.shippingProfile || '',
        marketingHeadline: payload.marketingHeadline || '',
        marketingSub: payload.marketingSub || '',
        heroCta: payload.heroCta || '',
        heroCtaLink: payload.heroCtaLink || '',
        contentPillar: payload.contentPillar || '',
        story: payload.story || '',
        themeColor: payload.themeColor || '',
        shippingMatrix: payload.shippingMatrix || [],
        locale: payload.locale,
      })
      if (!updated) {
        toast.error('Failed to update category')
        return null
      }
      toast.success('Category updated')
      return updated
    } catch (e: any) {
      toast.error('Failed to update category', { description: e?.message || 'Please try again.' })
      return null
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminLayout
      title={category ? `Edit: ${category.name}` : 'Edit category'}
      description={error ? error : 'Update hierarchy, media, and SEO metadata.'}
    >
      {!categoryId ? (
        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">Missing category id.</div>
      ) : isLoading && !category ? null : !isLoading && !category ? (
        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">Category not found.</div>
      ) : (
        <div key={category?.id || categoryId}>
          <CategoryEditor
            mode="edit"
            token={accessToken}
            categories={categories}
            taxonomies={taxonomies}
            initial={initial}
            isSubmitting={isSaving}
            submitLabel="Save changes"
            secondaryAction={{
              label: 'Save & back',
              onClick: async (payload) => {
                const updated = await saveFromPayload(payload)
                if (!updated) return
                setLocation('/axis/categories')
              },
            }}
            onSubmit={async (payload) => {
              await saveFromPayload(payload)
            }}
            onCancel={() => setLocation('/axis/categories')}
          />
        </div>
      )}
    </AdminLayout>
  )
}
