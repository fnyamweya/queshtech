const rawPrefix = (import.meta.env.VITE_API_PREFIX || '/api/v1') as string

const normalizePrefix = (prefix: string) => {
  const trimmed = prefix.trim() || '/api/v1'
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.replace(/\/$/, '')
}

export const API_PREFIX = normalizePrefix(rawPrefix)

const p = (path: string) => {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`
  return `${API_PREFIX}${withLeadingSlash}`
}

// Some backend endpoints are intentionally exposed without the global `/api/v1` prefix
// (e.g. Google OAuth callbacks require exact URLs in provider consoles).
const o = (path: string) => {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`
  return withLeadingSlash
}

export const endpoints = {
  auth: {
    profile: p('/auth/profile'),
    refresh: p('/auth/refresh'),
    customerRegister: p('/auth/customer/register'),
    customerLogin: p('/auth/customer/login'),
    passwordSet: p('/auth/password-set'),
    // Password reset (OTP) (verified in Swagger)
    forgotPasswordOtpSend: p('/auth/otp/send/forgot-password'),
    passwordResetOtpVerify: p('/auth/otp/verify/forgot-password'),
    otpSendForgotPassword: p('/auth/otp/send/forgot-password'),
    otpVerifyForgotPassword: p('/auth/otp/verify/forgot-password'),
    resetPassword: p('/auth/reset-password'),
    inviteAccept: p('/auth/user/invite/accept'),
    inviteDecline: p('/auth/user/invite/decline'),
    inviteUser: p('/auth/user/invite'),

    // Google OAuth 2.0 (profile-key based) (NO /api prefix)
    google: o('/auth/google'),
    googleByKey: (oauthKey: string) => o(`/auth/${encodeURIComponent(oauthKey)}/google`),
    // NOTE: This is a frontend SPA route (not an API endpoint). It must not be prefixed with /api/v1.
    googleCallback: o('/oauth/google/callback'),
    googleCallbackByKey: (oauthKey: string) => o(`/auth/${encodeURIComponent(oauthKey)}/google/callback`),
    customerGoogleExchange: p('/auth/customer/google/exchange'),

    // OAuth exchange (exchangeCode -> tokens) (NO /api prefix)
    oauthExchange: o('/auth/oauth/exchange'),
  },
  adminAuth: {
    login: p('/auth/admin/login'),
    // OAuth initiation endpoint (backend performs redirect to Google).
    google: p('/auth/admin/google'),
    googleCallback: p('/auth/admin/google/callback'),
  },
  catalog: {
    categories: p('/catalog/categories'),
    categoryById: (id: string) => p(`/catalog/categories/${encodeURIComponent(id)}`),
    publicCategories: (params?: { page?: number; limit?: number; isActive?: boolean; isHomepage?: boolean }) => {
      if (!params) return p('/public/catalog/categories')
      const qs = new URLSearchParams()
      if (typeof params.page === 'number') qs.set('page', String(params.page))
      if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
      if (typeof params.isActive === 'boolean') qs.set('isActive', String(params.isActive))
      if (typeof params.isHomepage === 'boolean') qs.set('isHomepage', String(params.isHomepage))
      const query = qs.toString()
      return query ? p(`/public/catalog/categories?${query}`) : p('/public/catalog/categories')
    },
    publicCategoryById: (id: string) => p(`/public/catalog/categories/${encodeURIComponent(id)}`),
    taxonomies: p('/catalog/taxonomies'),
    taxonomyById: (id: string) => p(`/catalog/taxonomies/${encodeURIComponent(id)}`),
    brands: p('/catalog/brands'),
    brandById: (id: string) => p(`/catalog/brands/${encodeURIComponent(id)}`),
      publicProducts: (params?: { page?: number; limit?: number; q?: string; sort?: string }) => {
        if (!params) return p('/public/catalog/products')
        const qs = new URLSearchParams()
        if (typeof params.page === 'number') qs.set('page', String(params.page))
        if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
        if (params.q) qs.set('q', params.q)
        if (params.sort) qs.set('sort', params.sort)
        const query = qs.toString()
        return query ? p(`/public/catalog/products?${query}`) : p('/public/catalog/products')
      },
      publicProductsView: (params?: { page?: number; limit?: number; q?: string; sort?: string }) => {
        if (!params) return p('/public/catalog/products/view')
        const qs = new URLSearchParams()
        if (typeof params.page === 'number') qs.set('page', String(params.page))
        if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
        if (params.q) qs.set('q', params.q)
        if (params.sort) qs.set('sort', params.sort)
        const query = qs.toString()
        return query ? p(`/public/catalog/products/view?${query}`) : p('/public/catalog/products/view')
      },
      publicProductById: (id: string) => p(`/public/catalog/products/${encodeURIComponent(id)}`),
      publicProductViewById: (
        id: string,
        params?: {
          locale?: string
          priceListId?: string
          currencyCode?: string
          channel?: string
          customerGroup?: string
          location?: string
          role?: string
        }
      ) => {
        const base = `/public/catalog/products/${encodeURIComponent(id)}/view`
        if (!params) return p(base)
        const qs = new URLSearchParams()
        if (params.locale) qs.set('locale', params.locale)
        if (params.priceListId) qs.set('priceListId', params.priceListId)
        if (params.currencyCode) qs.set('currencyCode', params.currencyCode)
        if (params.channel) qs.set('channel', params.channel)
        if (params.customerGroup) qs.set('customerGroup', params.customerGroup)
        if (params.location) qs.set('location', params.location)
        if (params.role) qs.set('role', params.role)
        const query = qs.toString()
        return query ? p(`${base}?${query}`) : p(base)
      },
      publicProductRatingSummary: (productId: string) =>
        p(`/public/catalog/products/${encodeURIComponent(productId)}/reviews/summary`),
      publicProductReviews: (
        productId: string,
        params?: { page?: number; limit?: number; sort?: 'newest' | 'oldest' | 'highest' | 'lowest' }
      ) => {
        const base = `/public/catalog/products/${encodeURIComponent(productId)}/reviews`
        if (!params) return p(base)
        const qs = new URLSearchParams()
        if (typeof params.page === 'number') qs.set('page', String(params.page))
        if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
        if (params.sort) qs.set('sort', params.sort)
        const query = qs.toString()
        return query ? p(`${base}?${query}`) : p(base)
      },
    publicCollections: (params?: { type?: string; page?: number; limit?: number; isActive?: boolean; isHomepage?: boolean }) => {
      if (!params) return p('/public/catalog/collections')
      const qs = new URLSearchParams()
      if (params.type) qs.set('type', params.type)
      if (typeof params.page === 'number') qs.set('page', String(params.page))
      if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
      if (typeof params.isActive === 'boolean') qs.set('isActive', String(params.isActive))
      if (typeof params.isHomepage === 'boolean') qs.set('isHomepage', String(params.isHomepage))
      const query = qs.toString()
      return query ? p(`/public/catalog/collections?${query}`) : p('/public/catalog/collections')
    },
    collections: (params?: { type?: string; page?: number; limit?: number; isActive?: boolean; isHomepage?: boolean; q?: string }) => {
      if (!params) return p('/catalog/collections')
      const qs = new URLSearchParams()
      if (params.type) qs.set('type', params.type)
      if (typeof params.page === 'number') qs.set('page', String(params.page))
      if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
      if (typeof params.isActive === 'boolean') qs.set('isActive', String(params.isActive))
      if (typeof params.isHomepage === 'boolean') qs.set('isHomepage', String(params.isHomepage))
      if (params.q) qs.set('q', params.q)
      const query = qs.toString()
      return query ? p(`/catalog/collections?${query}`) : p('/catalog/collections')
    },
    collectionById: (id: string) => p(`/catalog/collections/${encodeURIComponent(id)}`),
    products: (params?: {
      page?: number
      limit?: number
      status?: string
      type?: string
      isFeatured?: boolean
      q?: string
    }) => {
      if (!params) return p('/catalog/products')
      const qs = new URLSearchParams()
      if (typeof params.page === 'number') qs.set('page', String(params.page))
      if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
      if (params.status) qs.set('status', params.status)
      if (params.type) qs.set('type', params.type)
      if (typeof params.isFeatured === 'boolean') qs.set('isFeatured', String(params.isFeatured))
      if (params.q) qs.set('q', params.q)
      const query = qs.toString()
      return query ? p(`/catalog/products?${query}`) : p('/catalog/products')
    },
    productById: (id: string) => p(`/catalog/products/${encodeURIComponent(id)}`),
      publicCategoryProducts: (categoryId: string, params?: { page?: number; limit?: number; q?: string; sort?: string }) => {
        const base = `/public/catalog/categories/${encodeURIComponent(categoryId)}/products`
        if (!params) return p(base)
        const qs = new URLSearchParams()
        if (typeof params.page === 'number') qs.set('page', String(params.page))
        if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
        if (params.q) qs.set('q', params.q)
        if (params.sort) qs.set('sort', params.sort)
        const query = qs.toString()
        return query ? p(`${base}?${query}`) : p(base)
      },
      publicCategoryProductViews: (categoryId: string, params?: { page?: number; limit?: number; q?: string; sort?: string }) => {
        const base = `/public/catalog/categories/${encodeURIComponent(categoryId)}/products/view`
        if (!params) return p(base)
        const qs = new URLSearchParams()
        if (typeof params.page === 'number') qs.set('page', String(params.page))
        if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
        if (params.q) qs.set('q', params.q)
        if (params.sort) qs.set('sort', params.sort)
        const query = qs.toString()
        return query ? p(`${base}?${query}`) : p(base)
      },
    publicSearchConfig: p('/public/catalog/search/config'),
    publicSearchProducts: (params?: { q?: string; page?: number; limit?: number; filters?: string }) => {
      if (!params) return p('/public/catalog/search/products')
      const qs = new URLSearchParams()
      if (params.q) qs.set('q', params.q)
      if (typeof params.page === 'number') qs.set('page', String(params.page))
      if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
      if (params.filters) qs.set('filters', params.filters)
      const query = qs.toString()
      return query ? p(`/public/catalog/search/products?${query}`) : p('/public/catalog/search/products')
    },

    // Admin search ops (Algolia)
    algoliaTest: p('/catalog/search/algolia/test'),
    algoliaApplySettings: p('/catalog/search/algolia/apply-settings'),
    algoliaReindex: p('/catalog/search/algolia/reindex'),
  },
  pricing: {
    priceLists: p('/pricing/price-lists'),
    priceListById: (id: string) => p(`/pricing/price-lists/${encodeURIComponent(id)}`),
    variantPrices: (params?: { priceListId?: string; variantId?: string }) => {
      if (!params) return p('/pricing/variant-prices')
      const qs = new URLSearchParams()
      if (params.priceListId) qs.set('priceListId', params.priceListId)
      if (params.variantId) qs.set('variantId', params.variantId)
      const query = qs.toString()
      return query ? p(`/pricing/variant-prices?${query}`) : p('/pricing/variant-prices')
    },
    variantPriceById: (id: string) => p(`/pricing/variant-prices/${encodeURIComponent(id)}`),
  },
  mpesa: {
    c2bRegisterUrls: p('/mpesa/c2b/register-urls'),
    c2bSimulate: p('/mpesa/c2b/simulate'),
    b2cPayment: p('/mpesa/b2c/payment'),
    b2bPayment: p('/mpesa/b2b/payment'),
    stkPush: p('/mpesa/stk/push'),
    stkStatus: (orderId: string) => p(`/mpesa/stk/status/${encodeURIComponent(orderId)}`),
  },
  paystack: {
    initialize: p('/paystack/initialize'),
    confirm: (reference: string) => p(`/paystack/confirm/${encodeURIComponent(reference)}`),
  },
  tingg: {
    checkout: p('/tingg/checkout'),
  },
  roles: {
    list: (query: string = 'getAll=true') => p(`/roles?${query}`),
    base: p('/roles'),
    permissions: p('/roles/permissions'),
    byId: (id: string) => p(`/roles/${encodeURIComponent(id)}`),
  },
  users: {
    list: (query: string = 'getAll=true') => p(`/users?${query}`),
    base: p('/users'),
    byId: (id: string) => p(`/users/${encodeURIComponent(id)}`),
  },
  customers: {
    list: (params?: { page?: number; limit?: number; q?: string; getAll?: boolean }) => {
      if (!params) return p('/customers')
      const qs = new URLSearchParams()
      if (typeof params.getAll === 'boolean') qs.set('getAll', String(params.getAll))
      if (typeof params.page === 'number') qs.set('page', String(params.page))
      if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
      if (params.q) qs.set('q', params.q)
      const query = qs.toString()
      return query ? p(`/customers?${query}`) : p('/customers')
    },
    base: p('/customers'),
    invite: p('/customers/invite'),
    byId: (id: string) => p(`/customers/${encodeURIComponent(id)}`),
  },
  customer: {
    shippingAddress: p('/customer/shipping-address'),
  },
  checkout: {
    sessions: p('/checkout/sessions'),
    sessionById: (id: string) => p(`/checkout/sessions/${encodeURIComponent(id)}`),
    delivery: (id: string) => p(`/checkout/sessions/${encodeURIComponent(id)}/delivery`),
    shippingMethods: (id: string) => p(`/checkout/sessions/${encodeURIComponent(id)}/shipping-methods`),
    shippingMethod: (id: string) => p(`/checkout/sessions/${encodeURIComponent(id)}/shipping-method`),
    review: (id: string) => p(`/checkout/sessions/${encodeURIComponent(id)}/review`),
    confirm: (id: string) => p(`/checkout/sessions/${encodeURIComponent(id)}/confirm`),
  },
  orders: {
    base: p('/orders'),
    byId: (id: string) => p(`/orders/${encodeURIComponent(id)}`),
    shippingQuote: (id: string) => p(`/orders/${encodeURIComponent(id)}/shipping/quote`),
    invoiceSummary: (id: string, token: string) =>
      p(`/orders/${encodeURIComponent(id)}/invoice/summary?token=${encodeURIComponent(token)}`),
    invoicePdf: (id: string, token: string) =>
      p(`/orders/${encodeURIComponent(id)}/invoice.pdf?token=${encodeURIComponent(token)}`),
  },
  paymentMethods: {
    base: p('/payment-methods'),
    byId: (id: string) => p(`/payment-methods/${encodeURIComponent(id)}`),
  },
  paymentProviders: {
    base: p('/payment-providers'),
    byId: (id: string) => p(`/payment-providers/${encodeURIComponent(id)}`),
  },
  locations: {
    list: (params?: { parentId?: string; countryCode?: string; type?: string; q?: string }) => {
      if (!params) return p('/locations')
      const qs = new URLSearchParams()
      if (params.parentId) qs.set('parentId', params.parentId)
      if (params.countryCode) qs.set('countryCode', params.countryCode)
      if (params.type) qs.set('type', params.type)
      if (params.q) qs.set('q', params.q)
      const query = qs.toString()
      return query ? p(`/locations?${query}`) : p('/locations')
    },
    base: p('/locations'),
    tree: (countryCode: string) => p(`/locations/tree/${encodeURIComponent(countryCode)}`),
    allowedChildren: p('/locations/allowed-children'),
    byId: (id: string) => p(`/locations/${encodeURIComponent(id)}`),
  },
  addresses: {
    fieldConfig: (params?: { countryCode?: string }) => {
      if (!params?.countryCode) return p('/addresses/field-config')
      const qs = new URLSearchParams()
      qs.set('countryCode', params.countryCode)
      return p(`/addresses/field-config?${qs.toString()}`)
    },
  },
  countries: {
    config: (params?: { countryCode?: string }) => {
      if (!params?.countryCode) return p('/countries/config')
      const qs = new URLSearchParams()
      qs.set('countryCode', params.countryCode)
      return p(`/countries/config?${qs.toString()}`)
    },
  },
  shipping: {
    zones: p('/shipping/zones'),
    zoneById: (id: string) => p(`/shipping/zones/${encodeURIComponent(id)}`),
    zoneLocations: (zoneId: string) => p(`/shipping/zones/${encodeURIComponent(zoneId)}/locations`),
    methodsByZone: (zoneId: string) => p(`/shipping/zones/${encodeURIComponent(zoneId)}/methods`),
    methods: p('/shipping/methods'),
    methodById: (id: string) => p(`/shipping/methods/${encodeURIComponent(id)}`),
    ratesByMethod: (methodId: string) => p(`/shipping/methods/${encodeURIComponent(methodId)}/rates`),
    rateById: (id: string) => p(`/shipping/rates/${encodeURIComponent(id)}`),
    providers: p('/shipping/providers'),
    providerById: (id: string) => p(`/shipping/providers/${encodeURIComponent(id)}`),
    quotes: p('/shipping/quotes'),
  },
  settings: {
    whatsapp: p('/settings/whatsapp'),
    whatsappSimulate: p('/settings/whatsapp/simulate'),
    sms: p('/settings/sms'),
    smsSimulate: p('/settings/sms/simulate'),
    s3: p('/settings/s3'),
    s3Secrets: p('/settings/s3/secrets'),
    r2: p('/settings/s3'),
    r2Secrets: p('/settings/s3/secrets'),
    // Google OAuth profiles
    oauthGoogleProfiles: p('/settings/oauth/google/profiles'),
    oauthGoogleProfileById: (id: string) => p(`/settings/oauth/google/profiles/${encodeURIComponent(id)}`),
    oauthGoogleProfileSecret: (id: string) => p(`/settings/oauth/google/profiles/${encodeURIComponent(id)}/secret`),
    // Back-compat aliases (older UI assumed a single profile)
    oauthGoogle: p('/settings/oauth/google/profiles'),
    oauthGoogleSecret: (id: string) => p(`/settings/oauth/google/profiles/${encodeURIComponent(id)}/secret`),
    oauthApple: p('/settings/oauth/apple'),
    oauthAppleSecret: p('/settings/oauth/apple/secret'),

    // Algolia (catalog)
    algoliaCatalog: p('/settings/algolia/catalog'),
    algoliaCatalogSecret: p('/settings/algolia/catalog/secret'),
  },
  commonUploads: {
    upload: p('/common/upload'),
    job: (jobId: string) => p(`/common/upload/jobs/${encodeURIComponent(jobId)}`),
  },
  whatsappTemplates: {
    base: p('/whatsapp/templates'),
    byId: (id: string) => p(`/whatsapp/templates/${encodeURIComponent(id)}`),
    fetchProvider: p('/whatsapp/templates/provider'),
    fetchProviderById: (id: string) => p(`/whatsapp/templates/provider/${encodeURIComponent(id)}`),
    submitById: (id: string) => p(`/whatsapp/templates/${encodeURIComponent(id)}/submit`),
  },
  channels: {
    base: p('/channels'),
    byId: (id: string) => p(`/channels/${encodeURIComponent(id)}`),
  },
  promotions: {
    base: p('/promotions'),
    byId: (id: string) => p(`/promotions/${encodeURIComponent(id)}`),
    activateById: (id: string) => p(`/promotions/${encodeURIComponent(id)}/activate`),
    deactivateById: (id: string) => p(`/promotions/${encodeURIComponent(id)}/deactivate`),
  },
  banners: {
    list: (params?: { placement?: string; isActive?: boolean; type?: string; page?: number; limit?: number }) => {
      if (!params) return p('/banners')
      const qs = new URLSearchParams()
      if (params.placement) qs.set('placement', params.placement)
      if (params.type) qs.set('type', params.type)
      if (typeof params.isActive === 'boolean') qs.set('isActive', String(params.isActive))
      if (typeof params.page === 'number') qs.set('page', String(params.page))
      if (typeof params.limit === 'number') qs.set('limit', String(params.limit))
      const query = qs.toString()
      return query ? p(`/banners?${query}`) : p('/banners')
    },
    byId: (id: string) => p(`/banners/${encodeURIComponent(id)}`),
    publicList: (params?: { placement?: string; type?: string; isActive?: boolean }) => {
      if (!params) return p('/banners/public')
      const qs = new URLSearchParams()
      if (params.placement) qs.set('placement', params.placement)
      if (params.type) qs.set('type', params.type)
      if (typeof params.isActive === 'boolean') qs.set('isActive', String(params.isActive))
      const query = qs.toString()
      return query ? p(`/banners/public?${query}`) : p('/banners/public')
    },
  },
  currencies: {
    base: p('/currencies'),
    byCode: (code: string) => p(`/currencies/${encodeURIComponent(code)}`),
  },
} as const
