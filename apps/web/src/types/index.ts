export interface Product {
  id: string
  name: string
  brand: string
  slug: string
  description: string
  price: number
  compareAtPrice?: number
  currency: string
  images: ProductImage[]
  category: Category
  rating: number
  reviewCount: number
  inStock: boolean
  stockCount?: number
  variants: ProductVariant[]
  specifications: Record<string, string>
  badges?: ProductBadge[]
  tags?: string[]
}

export interface ProductImage {
  id: string
  url: string
  alt: string
  isPrimary?: boolean
}

export interface ProductVariant {
  id: string
  name: string
  type: string
  value: string
  inStock: boolean
  colorHex?: string
  priceModifier?: number
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
  imageUrl?: string
  avatarUrl?: string
  icon?: string
  parentId?: string
  productCount?: number
}

export interface Taxonomy {
  id: string
  code: string
  name: string
  description?: string
  isDefault?: boolean
  isActive?: boolean
  imageUrl?: string
  avatarUrl?: string
  icon?: string
}

export interface Brand {
  id: string
  code: string
  name: string
  description?: string
  isActive?: boolean
}

export interface ProductBadge {
  type: 'new' | 'sale' | 'limited' | 'bestseller' | 'exclusive'
  label: string
}

export interface CartItem {
  id: string
  product: Product
  quantity: number
  selectedVariants: Record<string, string>
  price: number
  subtotal: number
}

export interface Cart {
  items: CartItem[]
  subtotal: number
  tax: number
  shipping: number
  discount: number
  total: number
  promoCode?: string
}

export interface Address {
  id?: string
  firstName: string
  lastName: string
  company?: string
  address1: string
  address2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
  isDefault?: boolean
}

export interface ShippingMethod {
  id: string
  name: string
  description: string
  price: number
  estimatedDays: string
}

export interface PaymentMethod {
  id: string
  type: 'card' | 'paypal' | 'apple-pay' | 'google-pay'
  label: string
}

export interface Order {
  id: string
  orderNumber: string
  date: string
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  items: CartItem[]
  shippingAddress: Address
  billingAddress: Address
  shippingMethod: ShippingMethod
  paymentMethod: PaymentMethod
  subtotal: number
  tax: number
  shipping: number
  discount: number
  total: number
}

export interface Review {
  id: string
  productId: string
  userId: string
  userName: string
  rating: number
  title: string
  comment: string
  date: string
  verified: boolean
  helpful: number
}

export interface FilterOption {
  id: string
  label: string
  value: string
  count?: number
  checked?: boolean
}

export interface FilterGroup {
  id: string
  label: string
  type: 'checkbox' | 'radio' | 'range' | 'color'
  options: FilterOption[]
  expanded?: boolean
}

export type SortOption = 
  | 'relevance'
  | 'price-asc'
  | 'price-desc'
  | 'rating'
  | 'newest'
  | 'bestseller'

export interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  avatar?: string
  joinedDate: string
  preferences: UserPreferences
}

export interface UserPreferences {
  emailNotifications: boolean
  smsNotifications: boolean
  pushNotifications: boolean
  newsletter: boolean
  language: string
  currency: string
}

export interface SavedPaymentMethod {
  id: string
  type: 'card' | 'mpesa'
  label: string
  lastFour?: string
  expiryDate?: string
  phoneNumber?: string
  isDefault: boolean
}

export interface WishlistItem {
  id: string
  product: Product
  addedDate: string
}
