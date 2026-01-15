import { useMemo, useState } from 'react'
import { Link, useLocation, useRoute } from 'wouter'
import { CornerDownRight, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ProductEditorV2 } from '@/components/admin/catalog/product-editor-v2'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useCatalogBrands } from '@/hooks/use-catalog-brands'
import { useCatalogCategories } from '@/hooks/use-catalog-categories'
import { useCatalogProductById } from '@/hooks/use-catalog-products'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'

export function AdminProductEditPage() {
  const [, params] = useRoute('/axis/products/:id/edit')
  const [, setLocation] = useLocation()
  const { accessToken } = useAdminAuth()

  const productId = params?.id ? decodeURIComponent(params.id) : null

  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])

  const { categories, isLoading: isLoadingCategories, error: categoriesError } = useCatalogCategories({
    token: accessToken,
    fallbackToMock: false,
  })
  const { brands, isLoading: isLoadingBrands, error: brandsError } = useCatalogBrands({ token: accessToken })
  const { product, isLoading: isLoadingProduct, error: productError, refresh, update } = useCatalogProductById({
    token: accessToken,
    id: productId,
  })

  const [isSaving, setIsSaving] = useState(false)
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false)

  const isLoading = isLoadingProduct || isLoadingCategories || isLoadingBrands
  const loadError = productError || categoriesError || brandsError

  const onSave = useMemo(() => {
    return async (payload: any) => {
      if (!productId) return
      setIsSaving(true)
      try {
        await update(payload)

        toast.success('Product updated')
        await refresh()
      } catch (e: any) {
        toast.error('Failed to update product', { description: e?.message || 'Please try again.' })
      } finally {
        setIsSaving(false)
      }
    }
  }, [productId, refresh, update])

  const onDelete = useMemo(() => {
    return async () => {
      if (!productId) return
      setIsSaving(true)
      try {
        await api.delete(endpoints.catalog.productById(productId))
        toast.success('Product deleted')
        setLocation('/axis/products')
      } catch (e: any) {
        toast.error('Failed to delete product', { description: e?.message || 'Please try again.' })
      } finally {
        setIsSaving(false)
      }
    }
  }, [api, productId, setLocation])

  const setLifecycleStatus = useMemo(() => {
    return async (status: 'draft' | 'active' | 'archived') => {
      if (!productId) return
      setIsSaving(true)
      try {
        await update({ status })
        toast.success(
          status === 'active' ? 'Product published' : status === 'archived' ? 'Product archived' : 'Product set to draft'
        )
        await refresh()
      } catch (e: any) {
        toast.error('Failed to update status', { description: e?.message || 'Please try again.' })
      } finally {
        setIsSaving(false)
      }
    }
  }, [productId, refresh, update])

  if (!productId) {
    return (
      <AdminLayout title="Edit Product" description="Missing product id.">
        <div className="text-sm text-muted-foreground">No product id provided.</div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title={product ? `Edit: ${product.title}` : 'Edit Product'}
      description="Update product details, translations, options, availability, and SKUs."
      actions={
        <div className="flex items-center gap-2">
          {product?.status ? (
            <Badge variant={product.status === 'active' ? 'default' : product.status === 'archived' ? 'outline' : 'secondary'}>
              {product.status}
            </Badge>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isSaving}>
                <MoreHorizontal className="h-4 w-4 mr-2" />
                Lifecycle
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setLifecycleStatus('active')}
                disabled={isSaving || product?.status === 'active'}
              >
                Publish
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLifecycleStatus('draft')}
                disabled={isSaving || product?.status === 'draft'}
              >
                Set to draft
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmArchiveOpen(true)}
                disabled={isSaving || product?.status === 'archived'}
              >
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href={`/axis/products/${encodeURIComponent(productId)}`}>
            <Button variant="outline" size="sm">
              <CornerDownRight className="h-4 w-4 mr-2" />
              Back to Product
            </Button>
          </Link>
        </div>
      }
    >
      <AlertDialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this product?</AlertDialogTitle>
            <AlertDialogDescription>
              Archived products are typically hidden from storefronts and sales channels. You can unarchive by setting it back to draft or active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={async () => {
                setConfirmArchiveOpen(false)
                await setLifecycleStatus('archived')
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : loadError ? (
        <div className="text-sm text-destructive">{loadError}</div>
      ) : !product ? (
        <div className="text-sm text-muted-foreground">Product not found.</div>
      ) : (
        <ProductEditorV2
          mode="edit"
          product={product}
          brands={brands}
          categories={categories}
          token={accessToken}
          isSaving={isSaving}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </AdminLayout>
  )
}
