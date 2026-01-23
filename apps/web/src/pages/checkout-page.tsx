import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Price } from '@/components/commerce/price'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api'
import { endpoints } from '@/lib/endpoints'
import { useAuth } from '@/hooks/use-auth'
import { Cart } from '@/types'
import { ArrowLeft, ArrowRight, Check } from '@phosphor-icons/react'

interface CheckoutPageProps {
  cart: Cart
  onComplete: () => void
}

type Step = 'shipping' | 'delivery' | 'review' | 'payment'

type PaymentMethod = 'mpesa' | 'paystack' | 'tingg'

type QuoteOption = {
  id?: string
  methodId?: string
  method?: {
    code?: string
    displayName?: string
  }
  rate?: {
    metaJson?: Record<string, any>
  }
  name?: string
  label?: string
  description?: string
  amount?: number
  price?: number
  currency?: string
  estimatedDays?: string
  eta?: string
}

type LocationOption = {
  id: string
  name: string
  code?: string
  parentId?: string | null
}

type AddressFieldConfig = {
  [k: string]: any
}

type FieldState = {
  visible: boolean
  required: boolean
  label?: string
  placeholder?: string
}

type ShippingAddressDraft = {
  countryCode: string
  locationId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  notes: string
  extraFields: Record<string, string>
}

type CheckoutSessionResponse = {
  id: string
  status?: string
  expiresAt?: string
}

const steps: { id: Step; label: string }[] = [
  { id: 'shipping', label: 'Shipping' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'review', label: 'Review' },
  { id: 'payment', label: 'Payment' },
]

const paymentOptions: Array<{ id: PaymentMethod; label: string; description: string }> = [
  { id: 'mpesa', label: 'M-Pesa', description: 'Pay via STK push on your phone.' },
  { id: 'paystack', label: 'Paystack', description: 'Pay with cards, bank transfer, or mobile money.' },
  { id: 'tingg', label: 'Tingg', description: 'Pay with mobile money, cards, or wallets.' },
]

const unwrap = (payload: any) => payload?.data ?? payload

const humanizeLabel = (value: string) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  const spaced = trimmed.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
  return spaced.replace(/\b\w/g, (char) => char.toUpperCase())
}

const asArray = <T,>(payload: any): T[] => {
  const u = unwrap(payload)
  if (Array.isArray(u)) return u as T[]
  if (Array.isArray(u?.items)) return u.items as T[]
  if (Array.isArray(u?.results)) return u.results as T[]
  if (Array.isArray(u?.data)) return u.data as T[]
  if (Array.isArray(u?.data?.items)) return u.data.items as T[]
  return []
}

const quoteKey = (q: QuoteOption, index: number) =>
  String(q.method?.code || q.methodId || q.id || q.name || q.label || index)

const quoteLabel = (q: QuoteOption, index: number) =>
  q.method?.displayName || q.name || q.label || q.method?.code || q.methodId || q.id || `Option ${index + 1}`

const quoteAmount = (q: QuoteOption) =>
  typeof q.amount === 'number' ? q.amount : typeof q.price === 'number' ? q.price : null

const toLocationOptions = (payload: any): LocationOption[] => {
  const items = asArray<any>(payload)
  return items
    .map((item) => {
      const id = String(item?.id || item?.locationId || item?.code || '').trim()
      if (!id) return null
      return {
        id,
        name: String(item?.name || item?.label || item?.displayName || item?.code || id),
        code: item?.code ? String(item.code) : undefined,
        parentId: item?.parentId !== undefined && item?.parentId !== null ? String(item.parentId) : null,
      } satisfies LocationOption
    })
    .filter(Boolean) as LocationOption[]
}

const extractLocationLevelLabels = (config: AddressFieldConfig | null): string[] => {
  if (!config) return []

  const directArrays = [
    config.locationLevels,
    config.locationHierarchy,
    config.locationPath,
    config.hierarchy,
    config.levels,
    config.schemaJson?.locationChain,
    config.data?.schemaJson?.locationChain,
    config.schema?.locationChain,
    config.data?.schema?.locationChain,
  ].filter(Array.isArray) as any[][]

  for (const arr of directArrays) {
    const labels = arr
      .map((x) => {
        if (typeof x === 'string') return x
        if (x && typeof x === 'object') return x.display || x.label || x.name || x.displayName || x.type
        return null
      })
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    if (labels.length > 0) return labels.map((label) => humanizeLabel(label))
  }

  return []
}

const extractLocationChain = (config: AddressFieldConfig | null): string[] => {
  if (!config) return []

  const directArrays = [
    config.schemaJson?.locationChain,
    config.data?.schemaJson?.locationChain,
    config.schema?.locationChain,
    config.data?.schema?.locationChain,
    config.locationLevels,
    config.locationHierarchy,
    config.locationPath,
    config.hierarchy,
    config.levels,
  ].filter(Array.isArray) as any[][]

  for (const arr of directArrays) {
    const chain = arr
      .map((x) => {
        if (typeof x === 'string') return x
        if (x && typeof x === 'object') {
          return x.type || x.locationType || x.name || x.label || x.displayName
        }
        return null
      })
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)

    if (chain.length > 0) return chain
  }

  return []
}

const getConfigFieldsArray = (config: AddressFieldConfig | null): any[] | null => {
  if (!config) return null
  if (Array.isArray(config.schemaJson?.fields)) return config.schemaJson.fields
  if (Array.isArray(config.data?.schemaJson?.fields)) return config.data.schemaJson.fields
  if (Array.isArray(config.fields)) return config.fields
  if (Array.isArray(config.data?.fields)) return config.data.fields
  if (Array.isArray(config.schema?.fields)) return config.schema.fields
  if (Array.isArray(config.data?.schema?.fields)) return config.data.schema.fields
  return null
}

const normalizeFieldKey = (value: unknown) => String(value || '').trim().toLowerCase()

const findFieldConfig = (config: AddressFieldConfig | null, candidates: string[]) => {
  const fields = getConfigFieldsArray(config)
  if (!fields) return null
  const wanted = new Set(candidates.map((c) => c.toLowerCase()))

  for (const field of fields) {
    const key = normalizeFieldKey(field?.key ?? field?.name ?? field?.field ?? field?.id)
    if (wanted.has(key)) return field
  }

  for (const field of fields) {
    const key = normalizeFieldKey(field?.key ?? field?.name ?? field?.field ?? field?.id)
    for (const candidate of wanted) {
      if (key.includes(candidate)) return field
    }
  }

  return null
}

const readFieldState = (
  config: AddressFieldConfig | null,
  candidates: string[],
  fallbackLabel: string,
  fallbackPlaceholder?: string
): FieldState => {
  const def = findFieldConfig(config, candidates)
  if (!def) {
    return {
      visible: true,
      required: false,
      label: fallbackLabel,
      placeholder: fallbackPlaceholder,
    }
  }

  const enabledCandidates = [def?.enabled, def?.visible, def?.isEnabled, def?.isVisible]
  const requiredCandidates = [def?.required, def?.isRequired]

  const enabledValue = enabledCandidates.find((v: any) => typeof v === 'boolean')
  const requiredValue = requiredCandidates.find((v: any) => typeof v === 'boolean')

  const label =
    (typeof def?.label === 'string' && def.label) ||
    (typeof def?.displayName === 'string' && def.displayName) ||
    fallbackLabel

  const placeholder =
    (typeof def?.placeholder === 'string' && def.placeholder) ||
    (typeof def?.hint === 'string' && def.hint) ||
    fallbackPlaceholder

  return {
    visible: enabledValue === undefined ? true : Boolean(enabledValue),
    required: requiredValue === undefined ? false : Boolean(requiredValue),
    label,
    placeholder,
  }
}

const formatShippingAddress = (draft: ShippingAddressDraft) => {
  const name = `${draft.firstName} ${draft.lastName}`.trim()
  const lines = [
    name,
    draft.addressLine1,
    draft.addressLine2,
    [draft.city, draft.state, draft.postalCode].filter(Boolean).join(', '),
    draft.countryCode,
  ].filter((v) => typeof v === 'string' && v.trim().length > 0)
  return lines.join('\n')
}

const buildCheckoutAddress = (draft: ShippingAddressDraft) => ({
  countryCode: draft.countryCode,
  locationId: draft.locationId || undefined,
  firstName: draft.firstName || undefined,
  lastName: draft.lastName || undefined,
  phone: draft.phone || undefined,
  fields: {
    ...(draft.extraFields || {}),
    email: draft.email || undefined,
    addressLine1: draft.addressLine1 || undefined,
    addressLine2: draft.addressLine2 || undefined,
    city: draft.city || undefined,
    state: draft.state || undefined,
    postalCode: draft.postalCode || undefined,
    notes: draft.notes || undefined,
  },
})

export function CheckoutPage({ cart, onComplete }: CheckoutPageProps) {
  const [location, setLocation] = useLocation()
  const { authorizedRequest, isAuthenticated, isReady } = useAuth()

  const [sessionId, setSessionId] = useState<string>('')
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const [currentStep, setCurrentStep] = useState<Step>('shipping')
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'sending' | 'pending' | 'success' | 'failed'>('idle')
  const [mpesaMessage, setMpesaMessage] = useState('')
  const [orderId, setOrderId] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [mpesaStatusDetail, setMpesaStatusDetail] = useState('')
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isCheckingMpesaStatus, setIsCheckingMpesaStatus] = useState(false)

  const [deliveryMethod, setDeliveryMethod] = useState('')
  const [shippingQuotes, setShippingQuotes] = useState<QuoteOption[]>([])
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false)

  const [isSavingAddress, setIsSavingAddress] = useState(false)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)

  const [shippingAddress, setShippingAddress] = useState<ShippingAddressDraft>(() => ({
    countryCode: 'KE',
    locationId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    notes: '',
    extraFields: {},
  }))

  const [addressFieldConfig, setAddressFieldConfig] = useState<AddressFieldConfig | null>(null)
  const [countryPricing, setCountryPricing] = useState<{ priceListId?: string; currencyCode?: string }>({})
  const [isCountryConfigResolved, setIsCountryConfigResolved] = useState(false)
    const configuredFields = useMemo(() => {
      const fields = getConfigFieldsArray(addressFieldConfig)
      if (!fields || fields.length === 0) return []

      return fields
        .map((field) => {
          const rawKey = String(field?.key ?? field?.name ?? field?.field ?? field?.id ?? '').trim()
          if (!rawKey) return null

          const normalizedKey = normalizeFieldKey(rawKey)
          const enabledCandidates = [field?.enabled, field?.visible, field?.isEnabled, field?.isVisible]
          const requiredCandidates = [field?.required, field?.isRequired]
          const enabledValue = enabledCandidates.find((v: any) => typeof v === 'boolean')
          const requiredValue = requiredCandidates.find((v: any) => typeof v === 'boolean')

          const label =
            (typeof field?.label === 'string' && field.label) ||
            (typeof field?.displayName === 'string' && field.displayName) ||
            (typeof field?.name === 'string' && field.name) ||
            humanizeLabel(rawKey)

          const placeholder =
            (typeof field?.placeholder === 'string' && field.placeholder) ||
            (typeof field?.hint === 'string' && field.hint) ||
            ''

          const kind = String(field?.kind || field?.type || field?.fieldType || '').toLowerCase()

          return {
            rawKey,
            normalizedKey,
            label,
            placeholder,
            required: requiredValue === undefined ? false : Boolean(requiredValue),
            visible: enabledValue === undefined ? true : Boolean(enabledValue),
            kind,
          }
        })
        .filter(Boolean) as Array<{
        rawKey: string
        normalizedKey: string
        label: string
        placeholder: string
        required: boolean
        visible: boolean
        kind: string
      }>
    }, [addressFieldConfig])

    const visibleConfiguredFields = useMemo(() => {
      const locationKeyHints = ['location', 'locationid']
      return configuredFields.filter((field) => {
        if (!field.visible) return false
        const key = field.normalizedKey
        if (locationKeyHints.some((hint) => key.includes(hint))) return false
        if (field.kind.includes('location')) return false
        return true
      })
    }, [configuredFields])

    const usesConfiguredFields = visibleConfiguredFields.length > 0

    const getFieldValue = (field: { rawKey: string; normalizedKey: string }) => {
      const key = field.normalizedKey
      if (['firstname', 'first_name'].includes(key)) return shippingAddress.firstName
      if (['lastname', 'last_name'].includes(key)) return shippingAddress.lastName
      if (['email'].includes(key)) return shippingAddress.email
      if (['phone', 'phonenumber', 'phone_number'].includes(key)) return shippingAddress.phone
      if (['addressline1', 'address1', 'address_line_1'].includes(key)) return shippingAddress.addressLine1
      if (['addressline2', 'address2', 'address_line_2'].includes(key)) return shippingAddress.addressLine2
      if (['city'].includes(key)) return shippingAddress.city
      if (['state', 'region', 'province'].includes(key)) return shippingAddress.state
      if (['postalcode', 'zip', 'postcode'].includes(key)) return shippingAddress.postalCode
      if (['notes', 'instructions', 'deliverynotes'].includes(key)) return shippingAddress.notes
      return shippingAddress.extraFields?.[field.rawKey] || ''
    }

    const setFieldValue = (field: { rawKey: string; normalizedKey: string }, value: string) => {
      const key = field.normalizedKey
      if (['firstname', 'first_name'].includes(key)) {
        setShippingAddress((p) => ({ ...p, firstName: value }))
        return
      }
      if (['lastname', 'last_name'].includes(key)) {
        setShippingAddress((p) => ({ ...p, lastName: value }))
        return
      }
      if (['email'].includes(key)) {
        setShippingAddress((p) => ({ ...p, email: value }))
        return
      }
      if (['phone', 'phonenumber', 'phone_number'].includes(key)) {
        setShippingAddress((p) => ({ ...p, phone: value }))
        return
      }
      if (['addressline1', 'address1', 'address_line_1'].includes(key)) {
        setShippingAddress((p) => ({ ...p, addressLine1: value }))
        return
      }
      if (['addressline2', 'address2', 'address_line_2'].includes(key)) {
        setShippingAddress((p) => ({ ...p, addressLine2: value }))
        return
      }
      if (['city'].includes(key)) {
        setShippingAddress((p) => ({ ...p, city: value }))
        return
      }
      if (['state', 'region', 'province'].includes(key)) {
        setShippingAddress((p) => ({ ...p, state: value }))
        return
      }
      if (['postalcode', 'zip', 'postcode'].includes(key)) {
        setShippingAddress((p) => ({ ...p, postalCode: value }))
        return
      }
      if (['notes', 'instructions', 'deliverynotes'].includes(key)) {
        setShippingAddress((p) => ({ ...p, notes: value }))
        return
      }

      setShippingAddress((p) => ({
        ...p,
        extraFields: {
          ...(p.extraFields || {}),
          [field.rawKey]: value,
        },
      }))
    }
  const locationLevelLabels = useMemo(() => {
    const labels = extractLocationLevelLabels(addressFieldConfig)
    if (labels.length > 0 && labels[0].trim().toLowerCase() === 'country') return labels.slice(1)
    return labels
  }, [addressFieldConfig])

  const locationChain = useMemo(() => {
    const raw = extractLocationChain(addressFieldConfig)
    const normalized = raw.map((x) => String(x).trim()).filter(Boolean)
    if (normalized.length > 0 && normalized[0].toLowerCase() === 'country') return normalized.slice(1)
    return normalized
  }, [addressFieldConfig])

  const [countryOptions, setCountryOptions] = useState<LocationOption[]>([])
  const [isLoadingCountries, setIsLoadingCountries] = useState(false)
  const [selectedCountryId, setSelectedCountryId] = useState('')

  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [locationLevels, setLocationLevels] = useState<LocationOption[][]>([])
  const [locationPath, setLocationPath] = useState<LocationOption[]>([])

  const cartKey = useMemo(() => {
    return JSON.stringify(
      cart.items.map((item) => ({
        productSkuId: item.productSkuId,
        quantity: item.quantity,
      }))
    )
  }, [cart.items])


  const selectedQuote = useMemo(() => {
    if (!deliveryMethod) return null
    return shippingQuotes.find((q, index) => quoteKey(q, index) === deliveryMethod) ?? null
  }, [deliveryMethod, shippingQuotes])
  
  const isNegotiatedShipping = useMemo(() => {
    if (!selectedQuote) return false
    const code = String(selectedQuote?.method?.code || '').toLowerCase()
    if (code === 'internal_negotiated') return true
    if (Boolean((selectedQuote as any)?.rate?.metaJson?.negotiated)) return true
    const label = String(
      selectedQuote?.label ||
        selectedQuote?.name ||
        selectedQuote?.method?.displayName ||
        ''
    )
    return /negotiated/i.test(label)
  }, [selectedQuote])

  const selectedShippingCost = useMemo(() => {
    const amount = selectedQuote ? quoteAmount(selectedQuote) : null
    return amount === null ? cart.shipping : amount
  }, [cart.shipping, selectedQuote])

  const displayTotal = useMemo(() => {
    return cart.subtotal + cart.tax + selectedShippingCost - cart.discount
  }, [cart.discount, cart.subtotal, cart.tax, selectedShippingCost])

  const displayCurrency = useMemo(() => {
    return (
      selectedQuote?.currency ||
      countryPricing.currencyCode ||
      cart.items[0]?.product?.currency ||
      ''
    )
  }, [cart.items, countryPricing.currencyCode, selectedQuote?.currency])

  const selectedPaymentOption = useMemo(() => {
    return paymentOptions.find((option) => option.id === paymentMethod) || null
  }, [paymentMethod])

  const paymentMethodLabel = selectedPaymentOption?.label || paymentMethod.toUpperCase()

  // Guard: empty cart.
  useEffect(() => {
    if (cart.items.length > 0) return
    setLocation('/cart')
  }, [cart.items.length, setLocation])

  useEffect(() => {
    if (mpesaPhone.trim()) return
    const phone = shippingAddress.phone.trim()
    if (phone) setMpesaPhone(phone)
  }, [mpesaPhone, shippingAddress.phone])

  useEffect(() => {
    if (paymentMethod !== 'mpesa') {
      setMpesaStatus('idle')
      setMpesaMessage('')
    }
  }, [paymentMethod])

  useEffect(() => {
    if (mpesaStatus === 'idle' && !orderId) return
    setMpesaStatus('idle')
    setMpesaMessage('')
    setOrderId('')
    setOrderNumber('')
    setMpesaStatusDetail('')
  }, [deliveryMethod, shippingAddress.locationId])

  const checkMpesaStatus = useCallback(async () => {
    if (!orderId) return
    if (!isAuthenticated) return
    setIsCheckingMpesaStatus(true)
    try {
      const payload = await authorizedRequest<any>(endpoints.mpesa.stkStatus(orderId))
      const data = (payload as any)?.data ?? payload
      const status = String(data?.status || '').toLowerCase()
      const desc = String(data?.resultDesc || data?.message || '').trim()
      if (desc) setMpesaStatusDetail(desc)

      if (status === 'success') {
        setMpesaStatus('success')
        setMpesaMessage('Payment confirmed')
        toast.success('Payment received', { description: desc || 'Your order is confirmed.' })
        setIsPaymentModalOpen(false)
        onComplete()
        setLocation('/')
        return
      }

      if (status === 'failed' || status === 'timeout') {
        setMpesaStatus('failed')
        setMpesaMessage(desc || 'Payment failed')
        return
      }

      if (status) {
        setMpesaStatus('pending')
      }
    } catch (e: any) {
      setMpesaStatusDetail(e?.message || 'Unable to check payment status')
    } finally {
      setIsCheckingMpesaStatus(false)
    }
  }, [authorizedRequest, isAuthenticated, onComplete, orderId, setLocation])

  useEffect(() => {
    if (!isPaymentModalOpen) return
    if (paymentMethod !== 'mpesa') return
    if (!orderId) return
    if (mpesaStatus === 'success' || mpesaStatus === 'failed') return

    const t = window.setInterval(() => {
      void checkMpesaStatus()
    }, 5000)

    return () => window.clearInterval(t)
  }, [checkMpesaStatus, isPaymentModalOpen, mpesaStatus, orderId, paymentMethod])

  // Guard: require authentication before checkout.
  useEffect(() => {
    if (!isReady) return
    if (cart.items.length === 0) return
    if (isAuthenticated) return
    setLocation(`/login?redirect=${encodeURIComponent('/checkout')}`)
  }, [cart.items.length, isAuthenticated, isReady, setLocation])

  useEffect(() => {
    if (!isReady || !isAuthenticated) return
    if (cart.items.length === 0) return
    if (!isCountryConfigResolved) return
    if (sessionId) return

    const missingSku = cart.items.find((item) => !item.productSkuId)
    if (missingSku) {
      toast.error('Missing product variant', {
        description: 'Please select a product variation before checking out.',
      })
      setLocation('/cart')
      return
    }

    let didCancel = false

    ;(async () => {
      setIsCreatingSession(true)
      setSessionError(null)
      try {
        const payload = await authorizedRequest<CheckoutSessionResponse>(endpoints.checkout.sessions, {
          method: 'POST',
          body: {
            orderItems: cart.items.map((item) => ({
              productSkuId: item.productSkuId,
              quantity: item.quantity,
            })),
            priceListId: countryPricing.priceListId,
            currencyCode: countryPricing.currencyCode,
          },
        })
        if (didCancel) return
        const session = (payload as any)?.data ?? payload
        if (session?.id) setSessionId(String(session.id))
      } catch (e: any) {
        if (didCancel) return
        setSessionError(e?.message || 'Failed to start checkout')
        toast.error('Failed to start checkout', { description: e?.message || 'Please try again.' })
      } finally {
        if (!didCancel) setIsCreatingSession(false)
      }
    })()

    return () => {
      didCancel = true
    }
  }, [authorizedRequest, cart.items, cartKey, countryPricing.currencyCode, countryPricing.priceListId, isAuthenticated, isCountryConfigResolved, isReady, setLocation])

  // Prefill saved shipping address.
  useEffect(() => {
    if (!isAuthenticated) return
    const controller = new AbortController()
    let didCancel = false

    ;(async () => {
      try {
        const payload = await authorizedRequest<any>(endpoints.customer.shippingAddress, {
          method: 'GET',
          signal: controller.signal,
        })
        if (didCancel) return
        const data = unwrap(payload)
        if (!data) return

        const address = data?.address ?? data
        const rawFields =
          address?.fieldsJson ||
          address?.fields ||
          address?.fields_json ||
          data?.fields ||
          data?.fieldsJson ||
          {}

        const knownFieldKeys = new Set(
          [
            'email',
            'addressline1',
            'address1',
            'address_line_1',
            'addressline2',
            'address2',
            'address_line_2',
            'city',
            'state',
            'region',
            'province',
            'postalcode',
            'zip',
            'postcode',
            'notes',
            'instructions',
            'deliverynotes',
          ].map((k) => normalizeFieldKey(k))
        )

        const extraFields: Record<string, string> = {}
        if (rawFields && typeof rawFields === 'object') {
          for (const [key, value] of Object.entries(rawFields)) {
            const normalized = normalizeFieldKey(key)
            if (knownFieldKeys.has(normalized)) continue
            if (value === undefined || value === null) continue
            extraFields[key] = String(value)
          }
        }

        setShippingAddress((prev) => ({
          ...prev,
          countryCode: String(address?.countryCode || prev.countryCode || 'KE'),
          locationId: String(address?.locationId || prev.locationId || ''),
          firstName: String(address?.firstName || prev.firstName || ''),
          lastName: String(address?.lastName || prev.lastName || ''),
          email: String(rawFields?.email || prev.email || ''),
          phone: String(address?.phone || prev.phone || ''),
          addressLine1: String(rawFields?.addressLine1 || rawFields?.address1 || rawFields?.address_line_1 || prev.addressLine1 || ''),
          addressLine2: String(rawFields?.addressLine2 || rawFields?.address2 || rawFields?.address_line_2 || prev.addressLine2 || ''),
          city: String(rawFields?.city || prev.city || ''),
          state: String(rawFields?.state || rawFields?.region || rawFields?.province || prev.state || ''),
          postalCode: String(rawFields?.postalCode || rawFields?.zip || rawFields?.postcode || prev.postalCode || ''),
          notes: String(rawFields?.notes || rawFields?.instructions || rawFields?.deliveryNotes || prev.notes || ''),
          extraFields,
        }))
      } catch {
        // Best-effort prefill.
      }
    })()

    return () => {
      didCancel = true
      controller.abort()
    }
  }, [authorizedRequest, isAuthenticated])

  // Load countries (best-effort) and default to KE.
  useEffect(() => {
    const controller = new AbortController()
    let didCancel = false

    ;(async () => {
      setIsLoadingCountries(true)
      try {
        const payload = await apiRequest<any>(endpoints.locations.list({ type: 'COUNTRY' }), {
          method: 'GET',
          signal: controller.signal,
        })
        if (didCancel) return
        const options = toLocationOptions(payload)
        setCountryOptions(options)

        const currentCode = (shippingAddress.countryCode || 'KE').trim() || 'KE'
        const match =
          options.find((c) => c.code === currentCode || c.id === currentCode) ||
          options.find((c) => c.code === 'KE' || c.id === 'KE')

        if (match) {
          setSelectedCountryId(match.id)
          setShippingAddress((prev) => ({ ...prev, countryCode: match.code || currentCode }))
        } else {
          setShippingAddress((prev) => ({ ...prev, countryCode: currentCode }))
        }
      } catch {
        if (!didCancel) setCountryOptions([])
      } finally {
        if (!didCancel) setIsLoadingCountries(false)
      }
    })()

    return () => {
      didCancel = true
      controller.abort()
    }
    // intentionally run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load field-config when country changes.
  useEffect(() => {
    const countryCode = shippingAddress.countryCode.trim() || 'KE'
    const controller = new AbortController()
    let didCancel = false

    setIsCountryConfigResolved(false)

    ;(async () => {
      try {
        const payload = await apiRequest<any>(endpoints.addresses.fieldConfig({ countryCode }), {
          method: 'GET',
          signal: controller.signal,
        })
        if (didCancel) return
        setAddressFieldConfig(unwrap(payload) || null)
      } catch {
        if (!didCancel) setAddressFieldConfig(null)
      }
    })()

    ;(async () => {
      try {
        const payload = await apiRequest<any>(endpoints.countries.config({ countryCode }), {
          method: 'GET',
          signal: controller.signal,
        })
        if (didCancel) return
        const data = unwrap(payload) || {}
        const cfg = data?.config ?? data
        const priceListId = String(cfg?.defaultPriceListId || '').trim()
        const currencies = Array.isArray(cfg?.currencies) ? cfg.currencies : []
        const currencyCode = String(currencies?.[0] || cfg?.currencyCode || '').trim()
        setCountryPricing({
          priceListId: priceListId || undefined,
          currencyCode: currencyCode || undefined,
        })
      } catch {
        if (!didCancel) setCountryPricing({})
      } finally {
        if (!didCancel) setIsCountryConfigResolved(true)
      }
    })()

    return () => {
      didCancel = true
      controller.abort()
    }
  }, [shippingAddress.countryCode])

  // Load first location level when country/chain changes.
  useEffect(() => {
    const countryCode = shippingAddress.countryCode.trim() || 'KE'
    const controller = new AbortController()
    let didCancel = false

    ;(async () => {
      setIsLoadingLocations(true)
      try {
        let options: LocationOption[] = []

        const firstType = locationChain[0]

        if (selectedCountryId) {
          const byParent = await apiRequest<any>(
            endpoints.locations.list({ parentId: selectedCountryId, type: firstType || undefined }),
            {
              method: 'GET',
              signal: controller.signal,
            }
          )
          if (didCancel) return
          options = toLocationOptions(byParent)
        }

        if (options.length === 0 && !firstType) {
          const byCountry = await apiRequest<any>(endpoints.locations.list({ countryCode }), {
            method: 'GET',
            signal: controller.signal,
          })
          if (didCancel) return
          options = toLocationOptions(byCountry)
        }

        setLocationLevels(options.length ? [options] : [])
        setLocationPath([])
        setShippingAddress((prev) => ({ ...prev, locationId: '' }))
      } catch {
        if (!didCancel) {
          setLocationLevels([])
          setLocationPath([])
          setShippingAddress((prev) => ({ ...prev, locationId: '' }))
        }
      } finally {
        if (!didCancel) setIsLoadingLocations(false)
      }
    })()

    return () => {
      didCancel = true
      controller.abort()
    }
  }, [locationChain, selectedCountryId, shippingAddress.countryCode])

  const selectLocationAtLevel = async (levelIndex: number, selectedId: string) => {
    const currentLevelOptions = locationLevels[levelIndex] || []
    const chosen = currentLevelOptions.find((o) => o.id === selectedId)
    if (!chosen) return

    const nextPath = [...locationPath.slice(0, levelIndex), chosen]
    setLocationPath(nextPath)
    setShippingAddress((prev) => ({ ...prev, locationId: chosen.id }))

    const controller = new AbortController()
    try {
      setIsLoadingLocations(true)
      const nextType = locationChain[levelIndex + 1]
      const payload = await apiRequest<any>(
        endpoints.locations.list({ parentId: chosen.id, type: nextType || undefined }),
        {
          method: 'GET',
          signal: controller.signal,
        }
      )
      const children = toLocationOptions(payload)
      const nextLevels = [...locationLevels.slice(0, levelIndex + 1)]
      if (children.length > 0) {
        nextLevels.push(children)
        setShippingAddress((prev) => ({ ...prev, locationId: '' }))
      }
      setLocationLevels(nextLevels)
    } catch {
      setLocationLevels([...locationLevels.slice(0, levelIndex + 1)])
    } finally {
      setIsLoadingLocations(false)
    }
  }

  // Quotes are driven by selected location.
  useEffect(() => {
    if (currentStep !== 'delivery') return
    if (!sessionId) return
    const locationId = shippingAddress.locationId.trim()
    if (!locationId) {
      setShippingQuotes([])
      setDeliveryMethod('')
      return
    }

    let didCancel = false

    ;(async () => {
      setIsLoadingQuotes(true)
      try {
        await authorizedRequest<any>(endpoints.checkout.delivery(sessionId), {
          method: 'PUT',
          body: {
            shippingAddress: buildCheckoutAddress(shippingAddress),
          },
        })

        const payload = await authorizedRequest<any>(endpoints.checkout.shippingMethods(sessionId), {
          method: 'GET',
        })

        if (didCancel) return
        const next = asArray<QuoteOption>(payload?.quotes ?? payload?.data?.quotes ?? payload)
        setShippingQuotes(next)

        if (next.length === 0) {
          setDeliveryMethod('')
        } else {
          const stillValid = deliveryMethod && next.some((q, i) => quoteKey(q, i) === deliveryMethod)
          if (!stillValid) setDeliveryMethod(quoteKey(next[0], 0))
        }
      } catch (e: any) {
        if (didCancel) return
        setShippingQuotes([])
        setDeliveryMethod('')
        toast.error('Failed to load shipping options', { description: e?.message || 'Please try again.' })
      } finally {
        if (!didCancel) setIsLoadingQuotes(false)
      }
    })()

    return () => {
      didCancel = true
    }
  }, [authorizedRequest, currentStep, deliveryMethod, sessionId, shippingAddress, shippingAddress.locationId])

  const saveShippingAddress = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to continue')
      setLocation(`/login?redirect=${encodeURIComponent(location)}`)
      return { success: false as const }
    }

    const draft = shippingAddress

    const missing: string[] = []
    if (!draft.locationId.trim()) missing.push('Delivery location')

    if (usesConfiguredFields) {
      for (const field of visibleConfiguredFields) {
        if (!field.required) continue
        const value = getFieldValue(field).trim()
        if (!value) missing.push(field.label || field.rawKey)
      }
    } else {
      const firstNameState = readFieldState(addressFieldConfig, ['firstName', 'first_name'], 'First name')
      const lastNameState = readFieldState(addressFieldConfig, ['lastName', 'last_name'], 'Last name')
      const emailState = readFieldState(addressFieldConfig, ['email'], 'Email')
      const phoneState = readFieldState(addressFieldConfig, ['phone', 'phoneNumber', 'phone_number'], 'Phone')

      const address1State = readFieldState(addressFieldConfig, ['addressLine1', 'address1', 'address_line_1'], 'Address line 1')
      const cityState = readFieldState(addressFieldConfig, ['city'], 'City')
      const stateState = readFieldState(addressFieldConfig, ['state', 'region', 'province'], 'State')
      const postalState = readFieldState(addressFieldConfig, ['postalCode', 'zip', 'postcode'], 'Postal code')

      if (firstNameState.visible && firstNameState.required && !draft.firstName.trim()) missing.push(firstNameState.label || 'First name')
      if (lastNameState.visible && lastNameState.required && !draft.lastName.trim()) missing.push(lastNameState.label || 'Last name')
      if (emailState.visible && emailState.required && !draft.email.trim()) missing.push(emailState.label || 'Email')
      if (phoneState.visible && phoneState.required && !draft.phone.trim()) missing.push(phoneState.label || 'Phone')
      if (address1State.visible && address1State.required && !draft.addressLine1.trim()) missing.push(address1State.label || 'Address line 1')
      if (cityState.visible && cityState.required && !draft.city.trim()) missing.push(cityState.label || 'City')
      if (stateState.visible && stateState.required && !draft.state.trim()) missing.push(stateState.label || 'State')
      if (postalState.visible && postalState.required && !draft.postalCode.trim()) missing.push(postalState.label || 'Postal code')

      if (!emailState.required && !phoneState.required && !draft.phone.trim() && !draft.email.trim()) {
        missing.push('Phone or email')
      }
    }

    if (missing.length > 0) {
      toast.error('Missing required fields', { description: missing.join(', ') })
      return { success: false as const }
    }

    setIsSavingAddress(true)
    try {
      await authorizedRequest<any>(endpoints.customer.shippingAddress, {
        method: 'PUT',
        body: {
          countryCode: draft.countryCode,
          locationId: draft.locationId,
          firstName: draft.firstName || undefined,
          lastName: draft.lastName || undefined,
          phone: draft.phone || undefined,
          fields: {
            ...(draft.extraFields || {}),
            email: draft.email || undefined,
            addressLine1: draft.addressLine1 || undefined,
            addressLine2: draft.addressLine2 || undefined,
            city: draft.city || undefined,
            state: draft.state || undefined,
            postalCode: draft.postalCode || undefined,
            notes: draft.notes || undefined,
          },
        },
      })

      if (sessionId) {
        await authorizedRequest<any>(endpoints.checkout.delivery(sessionId), {
          method: 'PUT',
          body: {
            shippingAddress: buildCheckoutAddress(draft),
          },
        })
      }
      toast.success('Shipping address saved')
      return { success: true as const }
    } catch (e: any) {
      toast.error('Failed to save shipping address', { description: e?.message || 'Please try again.' })
      return { success: false as const }
    } finally {
      setIsSavingAddress(false)
    }
  }

  const persistDeliverySelection = async () => {
    if (!sessionId) return
    if (!deliveryMethod.trim()) return
    await authorizedRequest<any>(endpoints.checkout.shippingMethod(sessionId), {
      method: 'PUT',
      body: { shippingMethodCode: deliveryMethod.trim() },
    })
  }

  const ensureOrderConfirmed = async () => {
    if (orderId) return { orderId, orderNumber }
    const confirmPayload = await authorizedRequest<any>(endpoints.checkout.confirm(sessionId), {
      method: 'POST',
    })
    const confirmed = (confirmPayload as any)?.data ?? confirmPayload
    const order = confirmed?.order ?? confirmed
    const confirmedOrderId = String(order?.id || '')
    const confirmedOrderNumber = String(order?.orderNumber || '')

    if (!confirmedOrderId) throw new Error('Order creation failed')
    setOrderId(confirmedOrderId)
    if (confirmedOrderNumber) setOrderNumber(confirmedOrderNumber)
    return { orderId: confirmedOrderId, orderNumber: confirmedOrderNumber }
  }

  const startMpesaStkPush = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to continue')
      setLocation(`/login?redirect=${encodeURIComponent(location)}`)
      return
    }

    if (!sessionId) {
      toast.error('Checkout session missing', { description: 'Please try again.' })
      return
    }

    if (!shippingAddress.locationId.trim()) {
      toast.error('Missing delivery location')
      setCurrentStep('shipping')
      return
    }

    if (shippingQuotes.length > 0 && !deliveryMethod.trim()) {
      toast.error('Select a delivery option to continue')
      setCurrentStep('delivery')
      return
    }

    const phone = (mpesaPhone || shippingAddress.phone || '').trim()
    if (!phone) {
      toast.error('Enter your M-Pesa phone number')
      return
    }

    setMpesaStatus('sending')
    setMpesaMessage('')
    setMpesaStatusDetail('')

    try {
      await persistDeliverySelection()
      const { orderId: currentOrderId, orderNumber: currentOrderNumber } = await ensureOrderConfirmed()

      const payload = await authorizedRequest<any>(endpoints.mpesa.stkPush, {
        method: 'POST',
        body: {
          phone,
          amount: displayTotal,
          orderId: currentOrderId,
          accountReference: currentOrderNumber || undefined,
          transactionDesc: currentOrderNumber ? `Order ${currentOrderNumber}` : undefined,
        },
      })

      const data = (payload as any)?.data ?? payload
      setMpesaMessage(String(data?.CustomerMessage || data?.ResponseDescription || 'STK push sent'))
      setMpesaStatus('pending')
      toast.success('STK push sent', { description: 'Approve the prompt on your phone to complete payment.' })
    } catch (e: any) {
      setMpesaStatus('failed')
      setMpesaMessage(e?.message || 'Failed to send STK push')
      toast.error('Failed to send STK push', { description: e?.message || 'Please try again.' })
    }
  }

  const placeOrder = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to place your order')
      setLocation(`/login?redirect=${encodeURIComponent(location)}`)
      return { success: false as const }
    }

    if (!sessionId) {
      toast.error('Checkout session missing', { description: 'Please try again.' })
      return { success: false as const }
    }

    if (!shippingAddress.locationId.trim()) {
      toast.error('Missing delivery location')
      setCurrentStep('shipping')
      return { success: false as const }
    }

    if (shippingQuotes.length > 0 && !deliveryMethod.trim()) {
      toast.error('Select a delivery option to continue')
      setCurrentStep('delivery')
      return { success: false as const }
    }

    setIsPlacingOrder(true)
    try {
      await persistDeliverySelection()
      const confirmed = await ensureOrderConfirmed()
      
      if (isNegotiatedShipping) {
        toast.success('Order placed', {
          description: 'We will send your shipping invoice shortly with a payment link.',
        })
        onComplete()
        setLocation('/')
        return { success: true as const }
      }

      if (paymentMethod === 'paystack') {
        const payload = await authorizedRequest<any>(endpoints.paystack.initialize, {
          method: 'POST',
          body: {
            orderId: confirmed.orderId,
          },
        })
        const data = unwrap(payload)
        const url = data?.data?.authorization_url || data?.authorization_url
        if (!url) throw new Error('Missing Paystack authorization URL')
        setIsPaymentModalOpen(false)
        window.location.href = url
        return { success: true as const }
      }

      if (paymentMethod === 'tingg') {
        const phone = shippingAddress.phone.trim()
        if (!phone) throw new Error('Phone number is required for Tingg')

        const payload = await authorizedRequest<any>(endpoints.tingg.checkout, {
          method: 'POST',
          body: {
            orderId: confirmed.orderId,
            amount: displayTotal,
            currency: displayCurrency,
            phone,
            firstName: shippingAddress.firstName || 'Customer',
            lastName: shippingAddress.lastName || 'Order',
            email: shippingAddress.email || undefined,
          },
        })
        const data = unwrap(payload)
        const url = data?.data?.checkout_url || data?.checkout_url || data?.checkoutUrl
        if (!url) throw new Error('Missing Tingg checkout URL')
        setIsPaymentModalOpen(false)
        window.location.href = url
        return { success: true as const }
      }

      toast.success('Order placed')
      onComplete()
      setLocation('/')
      return { success: true as const }
    } catch (e: any) {
      toast.error('Failed to place order', { description: e?.message || 'Please try again.' })
      return { success: false as const }
    } finally {
      setIsPlacingOrder(false)
    }
  }

  const handleNext = async () => {
    if (currentStep === 'shipping') {
      const saved = await saveShippingAddress()
      if (saved.success) setCurrentStep('delivery')
      return
    }

    if (currentStep === 'delivery') {
      if (shippingQuotes.length > 0 && !deliveryMethod) {
        toast.error('Select a delivery option to continue')
        return
      }
      if (sessionId && deliveryMethod) {
        try {
          await authorizedRequest<any>(endpoints.checkout.shippingMethod(sessionId), {
            method: 'PUT',
            body: {
              shippingMethodCode: deliveryMethod,
            },
          })
        } catch (e: any) {
          toast.error('Failed to save delivery option', { description: e?.message || 'Please try again.' })
          return
        }
      }
      setCurrentStep('review')
      return
    }

    if (currentStep === 'review') {
      if (isNegotiatedShipping) {
        await placeOrder()
        return
      }
      setCurrentStep('payment')
      return
    }

    if (currentStep === 'payment') {
      setIsPaymentModalOpen(true)
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setCurrentStep(steps[prevIndex].id)
    else setLocation('/cart')
  }

  const countrySelectValue = useMemo(() => {
    const code = shippingAddress.countryCode.trim()
    const match = countryOptions.find((c) => c.code === code || c.id === code)
    return match?.id || ''
  }, [countryOptions, shippingAddress.countryCode])

  const shippingSection = (() => {
    const first = readFieldState(addressFieldConfig, ['firstName', 'first_name'], 'First name', 'John')
    const last = readFieldState(addressFieldConfig, ['lastName', 'last_name'], 'Last name', 'Doe')
    const phone = readFieldState(addressFieldConfig, ['phone', 'phoneNumber', 'phone_number'], 'Phone', '2547…')
    const email = readFieldState(addressFieldConfig, ['email'], 'Email', 'john@example.com')

    const address1 = readFieldState(addressFieldConfig, ['addressLine1', 'address1', 'address_line_1'], 'Address line 1', 'Street address')
    const address2 = readFieldState(addressFieldConfig, ['addressLine2', 'address2', 'address_line_2'], 'Address line 2', 'Apartment, suite, building')
    const city = readFieldState(addressFieldConfig, ['city'], 'City', 'City')
    const state = readFieldState(addressFieldConfig, ['state', 'region', 'province'], 'State', 'State/Region')
    const postal = readFieldState(addressFieldConfig, ['postalCode', 'zip', 'postcode'], 'Postal code', 'Postal code')
    const notes = readFieldState(addressFieldConfig, ['notes', 'instructions', 'deliveryNotes'], 'Delivery notes', 'Gate code, landmarks, instructions')

    return (
      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Location & Address</p>
              <p className="text-sm text-muted-foreground">Select your delivery location, then enter your address.</p>
            </div>
            <Badge variant="secondary">Required</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Country</Label>
              {isLoadingCountries ? null : countryOptions.length > 0 ? (
                <Select
                  value={selectedCountryId || countrySelectValue}
                  onValueChange={(value) => {
                    const selected = countryOptions.find((c) => c.id === value)
                    const code = (selected?.code || selected?.id || value || 'KE').trim()
                    setSelectedCountryId(value)
                    setShippingAddress((prev) => ({ ...prev, countryCode: code, locationId: '' }))
                    setLocationLevels([])
                    setLocationPath([])
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={shippingAddress.countryCode}
                  onChange={(e) => setShippingAddress((p) => ({ ...p, countryCode: e.target.value }))}
                  placeholder="Country code (e.g. KE)"
                />
              )}
            </div>
          </div>

          {isLoadingLocations && locationLevels.length === 0 ? null : locationLevels.length === 0 ? (
            isLoadingLocations ? null : (
              <div className="text-sm text-muted-foreground">No locations found for {shippingAddress.countryCode || 'KE'}.</div>
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {locationLevels.map((options, levelIndex) => {
                const selected = locationPath[levelIndex]?.id || ''
                const label = locationLevelLabels[levelIndex] || 'Location'
                return (
                  <div key={levelIndex} className="space-y-2">
                    <Label>{label}</Label>
                    <Select value={selected} onValueChange={(value) => selectLocationAtLevel(levelIndex, value)}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>
          )}

          <Separator />

          {usesConfiguredFields ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {visibleConfiguredFields.map((field) => {
                  const inputId = `field-${field.rawKey.replace(/[^a-z0-9_-]/gi, '') || field.rawKey}`
                  const type =
                    field.kind.includes('email') || field.normalizedKey.includes('email')
                      ? 'email'
                      : field.kind.includes('phone') || field.normalizedKey.includes('phone')
                        ? 'tel'
                        : 'text'

                  return (
                    <div key={field.rawKey} className="space-y-2">
                      <Label htmlFor={inputId}>
                        {field.label}
                        {field.required ? ' *' : ''}
                      </Label>
                      <Input
                        id={inputId}
                        type={type}
                        placeholder={field.placeholder}
                        value={getFieldValue(field)}
                        onChange={(e) => setFieldValue(field, e.target.value)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {address1.visible && (
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">
                    {address1.label}
                    {address1.required ? ' *' : ''}
                  </Label>
                  <Input
                    id="addressLine1"
                    placeholder={address1.placeholder}
                    value={shippingAddress.addressLine1}
                    onChange={(e) => setShippingAddress((p) => ({ ...p, addressLine1: e.target.value }))}
                  />
                </div>
              )}

              {address2.visible && (
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">{address2.label}</Label>
                  <Input
                    id="addressLine2"
                    placeholder={address2.placeholder}
                    value={shippingAddress.addressLine2}
                    onChange={(e) => setShippingAddress((p) => ({ ...p, addressLine2: e.target.value }))}
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                {city.visible && (
                  <div className="space-y-2">
                    <Label htmlFor="city">
                      {city.label}
                      {city.required ? ' *' : ''}
                    </Label>
                    <Input
                      id="city"
                      placeholder={city.placeholder}
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress((p) => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                )}

                {state.visible && (
                  <div className="space-y-2">
                    <Label htmlFor="state">
                      {state.label}
                      {state.required ? ' *' : ''}
                    </Label>
                    <Input
                      id="state"
                      placeholder={state.placeholder}
                      value={shippingAddress.state}
                      onChange={(e) => setShippingAddress((p) => ({ ...p, state: e.target.value }))}
                    />
                  </div>
                )}

                {postal.visible && (
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">
                      {postal.label}
                      {postal.required ? ' *' : ''}
                    </Label>
                    <Input
                      id="postalCode"
                      placeholder={postal.placeholder}
                      value={shippingAddress.postalCode}
                      onChange={(e) => setShippingAddress((p) => ({ ...p, postalCode: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              {notes.visible && (
                <div className="space-y-2">
                  <Label htmlFor="notes">{notes.label}</Label>
                  <Input
                    id="notes"
                    placeholder={notes.placeholder}
                    value={shippingAddress.notes}
                    onChange={(e) => setShippingAddress((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {!usesConfiguredFields && (
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Contact details</p>
                <p className="text-sm text-muted-foreground">So we can reach you about delivery.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {first.visible && (
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    {first.label}
                    {first.required ? ' *' : ''}
                  </Label>
                  <Input
                    id="firstName"
                    placeholder={first.placeholder}
                    value={shippingAddress.firstName}
                    onChange={(e) => setShippingAddress((p) => ({ ...p, firstName: e.target.value }))}
                  />
                </div>
              )}

              {last.visible && (
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    {last.label}
                    {last.required ? ' *' : ''}
                  </Label>
                  <Input
                    id="lastName"
                    placeholder={last.placeholder}
                    value={shippingAddress.lastName}
                    onChange={(e) => setShippingAddress((p) => ({ ...p, lastName: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {phone.visible && (
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    {phone.label}
                    {phone.required ? ' *' : ''}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={phone.placeholder}
                    value={shippingAddress.phone}
                    onChange={(e) => setShippingAddress((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              )}

              {email.visible && (
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {email.label}
                    {email.required ? ' *' : ''}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={email.placeholder}
                    value={shippingAddress.email}
                    onChange={(e) => setShippingAddress((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {!isAuthenticated && (
              <div className="text-sm text-muted-foreground">You’ll need to sign in to save your shipping address.</div>
            )}
          </div>
        )}
      </div>
    )
  })()

  return (
    <div className="min-h-screen bg-muted/20 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">Checkout</h1>
              <p className="text-sm text-muted-foreground">Complete your order in a few steps.</p>
              {isCreatingSession ? (
                <p className="text-xs text-muted-foreground">Preparing your checkout session…</p>
              ) : sessionError ? (
                <p className="text-xs text-destructive">{sessionError}</p>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation('/cart')}
              className="shrink-0"
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to cart
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              {steps.map((s, idx) => (
                <div key={s.id} className="flex items-center flex-1">
                  <div
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full border-2',
                      idx <= currentStepIndex ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'
                    )}
                  >
                    {idx < currentStepIndex ? <Check size={16} weight="bold" /> : <span className="text-sm">{idx + 1}</span>}
                  </div>
                  <div className={cn('flex-1 h-0.5 mx-2', idx < steps.length - 1 ? 'block' : 'hidden', idx < currentStepIndex ? 'bg-primary' : 'bg-border')} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              {steps.map((s) => (
                <span
                  key={s.id}
                  className={cn('text-xs flex-1 text-center', s.id === currentStep ? 'text-foreground font-medium' : 'text-muted-foreground')}
                >
                  {s.label}
                </span>
              ))}
            </div>
            <Progress value={progress} className="h-1" />
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="p-6">
                {currentStep === 'shipping' ? shippingSection : null}

                {currentStep === 'delivery' && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Delivery method</h2>

                    {!isLoadingQuotes && shippingAddress.locationId.trim() && shippingQuotes.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No shipping options available for this location.</div>
                    ) : null}

                    {shippingQuotes.length > 0 && (
                      <RadioGroup value={deliveryMethod} onValueChange={setDeliveryMethod}>
                        <div className="space-y-3">
                          {shippingQuotes.map((q, index) => {
                            const key = quoteKey(q, index)
                            const label = quoteLabel(q, index)
                            const amount = quoteAmount(q)
                              const hint = q.description || q.estimatedDays || q.eta
                              const negotiated =
                                String(q.method?.code || '').toLowerCase() === 'internal_negotiated' ||
                                /negotiated/i.test(label)

                            return (
                              <Label
                                key={key}
                                htmlFor={`quote-${key}`}
                                className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <RadioGroupItem value={key} id={`quote-${key}`} />
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{label}</p>
                                      <p className="text-sm text-muted-foreground truncate">
                                        {negotiated ? 'Quoted after checkout' : hint || '—'}
                                      </p>
                                  </div>
                                </div>
                                <div className="font-medium">
                                    {negotiated ? (
                                      <Badge variant="secondary">Quoted</Badge>
                                    ) : amount === null ? (
                                      '—'
                                    ) : (
                                      <Price price={amount} currency={q.currency || displayCurrency} size="sm" />
                                    )}
                                </div>
                              </Label>
                            )
                          })}
                        </div>
                      </RadioGroup>
                    )}
                  </div>
                )}

                {currentStep === 'payment' && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Payment method</h2>

                    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                      Review your order, then click Place order to open payment details and complete payment.
                    </div>

                    <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                      <div className="space-y-3">
                        {paymentOptions.map((option) => (
                          <Label
                            key={option.id}
                            htmlFor={`payment-${option.id}`}
                            className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors"
                          >
                            <RadioGroupItem id={`payment-${option.id}`} value={option.id} />
                            <div>
                              <p className="font-medium">{option.label}</p>
                              <p className="text-sm text-muted-foreground">{option.description}</p>
                            </div>
                          </Label>
                        ))}
                      </div>
                    </RadioGroup>

                    {paymentMethod === 'mpesa' ? (
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Amount to pay</span>
                          <div className="font-medium">
                            <Price price={displayTotal} currency={displayCurrency} size="sm" />
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={startMpesaStkPush}
                          disabled={mpesaStatus === 'sending'}
                        >
                          {mpesaStatus === 'sending' ? 'Sending STK push…' : 'Send STK push'}
                        </Button>
                        {mpesaMessage ? (
                          <p className="text-xs text-muted-foreground">{mpesaMessage}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            You’ll receive a prompt on your phone to authorize this payment.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Amount to pay</span>
                          <div className="font-medium">
                            <Price price={displayTotal} currency={displayCurrency} size="sm" />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          You’ll be redirected to {paymentMethodLabel} to complete payment.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 'review' && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Review your order</h2>

                    <div className="space-y-3">
                      {cart.items.map((item) => (
                        <div key={item.id} className="flex justify-between gap-4 p-4 rounded-lg border bg-card">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{item.product.name}</p>
                            <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                          </div>
                          <div className="text-right">
                            <Price price={item.subtotal} currency={item.product.currency || displayCurrency} size="sm" />
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <h3 className="text-sm font-semibold mb-2">Shipping address</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{formatShippingAddress(shippingAddress) || '—'}</p>
                      </div>

                      <div className="p-4 rounded-lg border bg-muted/30">
                        <h3 className="text-sm font-semibold mb-2">Delivery</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedQuote
                            ? `${quoteLabel(selectedQuote, 0)}${selectedQuote.estimatedDays ? ` (${selectedQuote.estimatedDays})` : ''}`
                            : shippingAddress.locationId.trim()
                              ? 'No delivery option selected'
                              : 'No delivery location selected'}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border bg-muted/30">
                        <h3 className="text-sm font-semibold mb-2">Payment</h3>
                        <p className="text-sm text-muted-foreground">{paymentMethodLabel}</p>
                        {paymentMethod === 'mpesa' ? (
                          <p className="text-xs text-muted-foreground mt-1">{mpesaPhone || 'No phone provided'}</p>
                        ) : null}
                      </div>

                      <div className="p-4 rounded-lg border bg-primary/5">
                        <h3 className="text-sm font-semibold mb-2 text-primary">Order total</h3>
                        <Price price={displayTotal} currency={displayCurrency} size="lg" className="font-semibold" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-8">
                  <Button variant="outline" onClick={handleBack} className="flex-1">
                    <ArrowLeft size={16} className="mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleNext} className="flex-1" disabled={isSavingAddress}>
                    {currentStep === 'payment'
                      ? 'Place order'
                      : currentStep === 'shipping' && isSavingAddress
                        ? 'Saving…'
                        : 'Continue'}
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Order summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <Price price={cart.subtotal} currency={displayCurrency} size="sm" />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      {selectedShippingCost === 0 ? (
                        <span className="text-primary font-medium">Free</span>
                      ) : (
                        <Price price={selectedShippingCost} currency={displayCurrency} size="sm" />
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <Price price={cart.tax} currency={displayCurrency} size="sm" />
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-semibold">Total</span>
                      <Price price={displayTotal} currency={displayCurrency} size="lg" />
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={isPaymentModalOpen}
        onOpenChange={(open) => {
          setIsPaymentModalOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle>Complete payment</DialogTitle>
            <DialogDescription>
              {paymentMethod === 'mpesa'
                ? 'Approve the M-Pesa prompt to complete your order.'
                : `Confirm your order to proceed to ${paymentMethodLabel}.`}
            </DialogDescription>
          </DialogHeader>

          {paymentMethod === 'mpesa' ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-medium">{orderNumber || 'Pending creation'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    <Price price={displayTotal} currency={displayCurrency} size="sm" />
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mpesaPhoneModal">M-Pesa phone</Label>
                <Input
                  id="mpesaPhoneModal"
                  type="tel"
                  placeholder="254712345678"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                />
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">
                    {mpesaStatus === 'idle'
                      ? 'Not sent'
                      : mpesaStatus === 'sending'
                        ? 'Sending'
                        : mpesaStatus === 'pending'
                          ? 'Pending confirmation'
                          : mpesaStatus === 'success'
                            ? 'Payment confirmed'
                            : 'Failed'}
                  </span>
                </div>
                {mpesaMessage ? <p className="text-xs text-muted-foreground">{mpesaMessage}</p> : null}
                {mpesaStatusDetail ? <p className="text-xs text-muted-foreground">{mpesaStatusDetail}</p> : null}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              You selected {paymentMethodLabel}. We’ll redirect you to complete payment.
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
              Close
            </Button>
            {paymentMethod === 'mpesa' ? (
              <>
                <Button
                  variant="outline"
                  onClick={checkMpesaStatus}
                  disabled={isCheckingMpesaStatus || !orderId}
                >
                  {isCheckingMpesaStatus ? 'Checking…' : 'Check status'}
                </Button>
                <Button
                  onClick={startMpesaStkPush}
                  disabled={mpesaStatus === 'sending'}
                >
                  {mpesaStatus === 'sending'
                    ? 'Sending STK push…'
                    : mpesaStatus === 'pending'
                      ? 'Resend STK push'
                      : 'Send STK push'}
                </Button>
              </>
            ) : (
              <Button onClick={placeOrder} disabled={isPlacingOrder}>
                {isPlacingOrder ? 'Preparing payment…' : `Proceed to ${paymentMethodLabel}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
