import { useState } from 'react'
import { useLocation } from 'wouter'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { CategoryEditor, type CategoryEditorSubmitPayload } from '@/components/admin/catalog/category-editor'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { useCatalogTaxonomies } from '@/hooks/use-catalog-taxonomies'

export function AdminCategoryAddPage() {
  const [, setLocation] = useLocation()
  const { accessToken } = useAdminAuth()
  const { categories, createCategory } = useCatalogCategories({ token: accessToken, fallbackToMock: false })
  const { taxonomies } = useCatalogTaxonomies({ token: accessToken })

  const [isCreating, setIsCreating] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  const createFromPayload = async (payload: CategoryEditorSubmitPayload) => {
    if (!payload.name) {
      toast.error('Name is required')
      return null
    }
    if (!payload.slug) {
      toast.error('Slug is required')
      return null
    }
    if (!payload.taxonomyId) {
      toast.error('Taxonomy is required')
      return null
    }

    setIsCreating(true)
    try {
      const created = await createCategory({
        taxonomyId: payload.taxonomyId,
        key: payload.key,
        name: payload.name,
        slug: payload.slug,
        parentId: payload.parentId ?? null,
        description: payload.description,
        isActive: payload.isActive,
        sortOrder: payload.sortOrder,
        order: payload.order,
        icon: payload.icon,
        avatarUrl: payload.avatarUrl,
        imageUrl: payload.imageUrl,
        seoTitle: payload.seoTitle,
        seoDescription: payload.seoDescription,
        seoKeywords: payload.seoKeywords,
        urlPath: payload.urlPath,
        synonyms: payload.synonyms,
        keywords: payload.keywords,
        level: payload.level,
        audience: payload.audience,
        returnPolicy: payload.returnPolicy,
        taxCode: payload.taxCode,
        highlight: payload.highlight,
        navPlacement: payload.navPlacement,
        featured: payload.featured,
        banner: payload.banner,
        marginTarget: payload.marginTarget,
        availability: payload.availability,
        compliance: payload.compliance,
        shippingProfile: payload.shippingProfile,
        marketingHeadline: payload.marketingHeadline,
        marketingSub: payload.marketingSub,
        heroCta: payload.heroCta,
        heroCtaLink: payload.heroCtaLink,
        contentPillar: payload.contentPillar,
        story: payload.story,
        themeColor: payload.themeColor,
        shippingMatrix: payload.shippingMatrix,
        locale: payload.locale,
      })
      if (!created) {
        toast.error('Failed to create category')
        return null
      }
      toast.success('Category created')
      return created
    } catch (e: any) {
      toast.error('Failed to create category', { description: e?.message || 'Please try again.' })
      return null
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <AdminLayout title="Add Category" description="Create a new category with hierarchy, media, and SEO metadata.">
      <div key={editorKey}>
        <CategoryEditor
          mode="create"
          token={accessToken}
          categories={categories}
          taxonomies={taxonomies}
          isSubmitting={isCreating}
          submitLabel="Create category"
          secondaryAction={{
            label: 'Create & add another',
            onClick: async (payload) => {
              const created = await createFromPayload(payload)
              if (!created) return
              setEditorKey((k) => k + 1)
            },
          }}
          onSubmit={async (payload) => {
            const created = await createFromPayload(payload)
            if (!created) return
            setLocation('/axis/categories')
          }}
          onCancel={() => setLocation('/axis/categories')}
        />
      </div>
    </AdminLayout>
  )
}
