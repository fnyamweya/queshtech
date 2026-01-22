export type CatalogProductStatus = 'draft' | 'active' | 'archived'

export type JsonObject = Record<string, any>

export type CatalogProductTranslation = {
  locale: string
  title: string
  description?: string
  metaJson?: JsonObject
  slug?: string
}

export type CatalogProductOptionDefinition = {
  key: string
  label: string
  allowedValues?: string[]
  required?: boolean
}

export type CatalogProductAvailability = {
  channels?: string[]
  countries?: string[]
  locations?: string[]
  stock?: {
    type?: string
    quantity?: number
  }
  schedule?: {
    startAt?: string
    endAt?: string
    timezone?: string
  }
  meta?: JsonObject
}

export type CatalogProductPrice = {
  priceListId: string
  unitPrice: number
  compareAtPrice?: number | null
  minQuantity?: number | null
  maxQuantity?: number | null
  validFrom?: string | null
  validTo?: string | null
  metaJson?: JsonObject
}

export type CatalogSkuInventoryLocation = {
  onHand?: number
  reserved?: number
}

export type CatalogSkuInventory = {
  locations?: Record<string, CatalogSkuInventoryLocation>
}

export type CatalogProductSku = {
  id?: string
  title?: string
  sku: string
  externalRef?: string
  status?: CatalogProductStatus | string
  isDefault?: boolean
  position?: number
  attributes?: Record<string, string>
  options?: Record<string, string>
  availability?: CatalogProductAvailability
  inventory?: CatalogSkuInventory
  images?: string[]
  requiresShipping?: boolean
  weight?: number
  length?: number
  width?: number
  height?: number
  dimensionUnit?: string
  weightUnit?: string
  metaJson?: JsonObject
  prices?: CatalogProductPrice[]
}

export type CatalogProductImage = {
  id?: string
  url: string
  alt?: string
  skuId?: string
  isPrimary?: boolean
  sortOrder?: number
}

export type CatalogProduct = {
  id: string
  title: string
  description?: string
  shortDescription?: string
  seoTitle?: string
  seoDescription?: string
  status: CatalogProductStatus
  slug?: string
  externalRef?: string
  brandId?: string | null
  categoryIds?: string[]
  optionDefinitions?: CatalogProductOptionDefinition[]
  availability?: CatalogProductAvailability
  images?: CatalogProductImage[]
  translations?: CatalogProductTranslation[]
  skus?: CatalogProductSku[]
  prices?: CatalogProductPrice[]
  metaJson?: JsonObject
  createdAt?: string
  updatedAt?: string
}

export type CatalogCollectionType = 'landing' | 'manual' | 'smart' | string

export type CatalogCollectionProduct = {
  id: string
  handle?: string
  name?: string
  price?: number
  compareAtPrice?: number | null
  currency?: string
  brand?: string | null
  images?: { url: string; alt?: string }[]
  rating?: number
  reviewCount?: number
  inStock?: boolean
  category?: { id: string; slug: string; name: string } | null
  raw?: JsonObject
}

export type CatalogCollection = {
  id: string
  key?: string
  slug?: string
  handle?: string
  name?: string
  title?: string
  type?: CatalogCollectionType
  description?: string
  icon?: string
  avatarUrl?: string
  imageUrl?: string
  heroImageUrl?: string
  bannerImageUrl?: string
  badge?: string
  isActive?: boolean
  isHomepage?: boolean
  sortOrder?: number
  metaJson?: JsonObject
  categoryIds?: string[]
  productIds?: string[]
  products?: CatalogCollectionProduct[]
  createdAt?: string
  updatedAt?: string
}

export type BannerPlacement = 'hero' | 'feature' | 'grid' | 'strip' | string

export type BannerPlacementEntry = {
  page: string
  section: string
  position?: number
}

export type BannerTarget = {
  kind: string
  refId?: string
}

export type BannerCreative = {
  kind: string
  imageKey?: string
  alt?: string
  cta?: { label?: string; url?: string }
}

export type Banner = {
  id: string
  title?: string
  subtitle?: string
  description?: string
  imageUrl?: string
  mobileImageUrl?: string
  href?: string
  placement?: BannerPlacement
  placements?: BannerPlacementEntry[]
  position?: number | string
  priority?: number
  ctaLabel?: string
  targets?: BannerTarget[]
  isActive?: boolean
  startsAt?: string | null
  endsAt?: string | null
  metaJson?: JsonObject
  landingSection?: string
  creative?: BannerCreative
}

export type PriceList = {
  id: string
  code: string
  name: string
  currencyCode: string
  isActive: boolean
  validFrom?: string | null
  validTo?: string | null
  metaJson?: JsonObject
  createdAt?: string
  updatedAt?: string
}

export type ProductVariantPrice = {
  id: string
  variantId: string
  priceListId: string
  unitPrice: number
  compareAtPrice?: number | null
  minQuantity?: number | null
  maxQuantity?: number | null
  validFrom?: string | null
  validTo?: string | null
  createdAt?: string
  updatedAt?: string
}
