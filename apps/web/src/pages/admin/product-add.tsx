import { useMemo, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { CornerDownRight } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { ProductEditorV2 } from '@/components/admin/catalog/product-editor-v2'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogBrands } from '@/hooks/use-catalog-brands'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'

function normalizeCreateResponse(raw: any): { id?: string } {
  const id = raw?.id ?? raw?._id ?? raw?.productId
  return { id: id ? String(id) : undefined }
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

  const isLoading = isLoadingCategories || isLoadingBrands
  const loadError = categoriesError || brandsError

  const onSave = useMemo(() => {
    return async (payload: any) => {
      setIsSaving(true)
      try {
        const createdRaw = await api.post<any>(endpoints.catalog.products(), payload)
        const created = normalizeCreateResponse(createdRaw)
        if (!created?.id) throw new Error('Create failed (missing product id in response)')
        toast.success('Product created')
        setLocation(`/axis/products/${encodeURIComponent(created.id)}/edit`)
      } catch (e: any) {
        toast.error('Failed to create product', { description: e?.message || 'Please try again.' })
        throw e
      } finally {
        setIsSaving(false)
      }
    }
  }, [api, setLocation])

  return (
    <AdminLayout title="Add Product" description="Create a new product with SKUs, pricing, and availability.">
      {isLoading ? null : loadError ? (
        <div className="text-sm text-destructive">{loadError}</div>
      ) : (
        <ProductEditorV2
          mode="create"
          brands={brands}
          categories={categories}
          token={accessToken ?? undefined}
          isSaving={isSaving}
          onSave={onSave}
          headerActions={
            <Link href="/axis/products">
              <Button variant="outline" size="sm">
                <CornerDownRight className="h-4 w-4 mr-2" />
                Back to Products
              </Button>
            </Link>
          }
        />
      )}
    </AdminLayout>
  )
}
