export { CheckoutPage } from './checkout-page'

/*
  Legacy checkout implementation (corrupted).
  Kept temporarily commented-out to preserve history while unblocking builds.

import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Price } from '@/components/commerce/price'
import { Cart } from '@/types'
import { Check, ArrowLeft, ArrowRight, Phone, CreditCard, Wallet } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api'
import { endpoints } from '@/lib/endpoints'
import { useAuth } from '@/hooks/use-auth'

interface CheckoutPageProps {
  cart: Cart
  onComplete: () => void
}


type Step = 'shipping' | 'delivery' | 'payment' | 'review'
type PaymentMethod = 'mpesa' | 'pesapal' | 'ipay' | 'paystack'

type QuoteOption = {
  id?: string
  methodId?: string
  method?: {
    code?: string
    displayName?: string
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
  type?: string
  parentId?: string | null
}

type AddressFieldConfig = {
  // Backend shape is not guaranteed; keep it flexible.
  [k: string]: any
}

type FieldState = {
  visible: boolean
  required: boolean
  label?: string
  placeholder?: string
}

type AddressFieldSpec = {
  key: string
  label?: string
  placeholder?: string
  required?: boolean
  enabled?: boolean
  visible?: boolean
  hidden?: boolean
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
}

const unwrap = (payload: any) => payload?.data ?? payload

const asArray = <T,>(payload: any): T[] => {
  const unwrapped = unwrap(payload)
  if (Array.isArray(unwrapped)) return unwrapped as T[]
  if (Array.isArray(unwrapped?.items)) return unwrapped.items as T[]
  return []
}

const quoteKey = (q: QuoteOption, index: number) =>
  String(q.method?.code || q.methodId || q.id || q.name || q.label || index)
const quoteLabel = (q: QuoteOption, index: number) =>
  q.method?.displayName || q.name || q.label || q.method?.code || q.methodId || q.id || `Option ${index + 1}`
const quoteAmount = (q: QuoteOption) => (typeof q.amount === 'number' ? q.amount : typeof q.price === 'number' ? q.price : null)

const toLocationOptions = (payload: any): LocationOption[] => {
  const items = asArray<any>(payload)
  return items
    .map((item) => {
      const id = String(item?.id || item?.locationId || item?.code || '')
      if (!id) return null
      return {
        id,
        name: String(item?.name || item?.label || item?.displayName || item?.code || id),
        code: item?.code ? String(item.code) : undefined,
        type: item?.type ? String(item.type) : undefined,
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
  ].filter(Array.isArray) as any[][]

  for (const arr of directArrays) {
    const labels = arr
      .map((x) => {
        if (typeof x === 'string') return x
        if (x && typeof x === 'object') return x.label || x.name || x.displayName || x.type
        return null
      })
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    if (labels.length > 0) return labels
  }

  const fields = Array.isArray(config.fields) ? config.fields : Array.isArray(config.data?.fields) ? config.data.fields : null
  if (fields) {
    const locationFields = fields
      .filter((f: any) => {
        const kind = String(f?.kind || f?.type || f?.fieldType || '').toLowerCase()
        const key = String(f?.key || f?.name || '').toLowerCase()
        return kind.includes('location') || key.includes('location') || key.includes('region') || key.includes('county')
      })
      .map((f: any) => String(f?.label || f?.displayName || f?.name || f?.key || ''))
      .filter((v: string) => v.trim().length > 0)
    if (locationFields.length > 0) return locationFields
  }

  return []
}

const getConfigFieldsArray = (config: AddressFieldConfig | null): any[] | null => {
  if (!config) return null
  const direct = Array.isArray(config.fields) ? config.fields : null
  if (direct) return direct
  const nested = Array.isArray(config.data?.fields) ? config.data.fields : null
  if (nested) return nested
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

  // Try soft match on common prefixes.
  for (const field of fields) {
    const key = normalizeFieldKey(field?.key ?? field?.name ?? field?.field ?? field?.id)
    for (const candidate of wanted) {
      if (key.includes(candidate)) return field
    }
  }

  return null
}

const readFieldState = (config: AddressFieldConfig | null, candidates: string[], fallbackLabel: string, fallbackPlaceholder?: string): FieldState => {
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

const normalizeKey = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const findFieldSpec = (config: AddressFieldConfig | null, canonicalKey: string): AddressFieldSpec | null => {
  if (!config) return null
  const fields = Array.isArray(config.fields)
    ? config.fields
    : Array.isArray(config.data?.fields)
      ? config.data.fields
      : null

  if (!fields) return null

  const want = normalizeKey(canonicalKey)
  const candidates = new Set<string>([
    want,
    // common backend variants
    want.replace('line', ''),
    want.replace('address', ''),
  ])

  const match = fields.find((f: any) => {
    const key = normalizeKey(f?.key || f?.name || f?.field || f?.id)
    if (!key) return false
    if (candidates.has(key)) return true
    // tolerate “address1/addressLine1” style
    if (want === 'addressline1' && (key === 'address1' || key === 'line1')) return true
    if (want === 'addressline2' && (key === 'address2' || key === 'line2')) return true
    if (want === 'postalcode' && (key === 'zipcode' || key === 'zip' || key === 'postal')) return true
    return false
  })

  if (!match) return null
  return {
    key: String(match?.key || match?.name || canonicalKey),
    label: typeof match?.label === 'string' ? match.label : typeof match?.displayName === 'string' ? match.displayName : undefined,
    placeholder: typeof match?.placeholder === 'string' ? match.placeholder : undefined,
    required: Boolean(match?.required),
    enabled: match?.enabled === undefined ? undefined : Boolean(match.enabled),
    visible: match?.visible === undefined ? undefined : Boolean(match.visible),
    hidden: match?.hidden === undefined ? undefined : Boolean(match.hidden),
  }
}

const isSpecVisible = (spec: AddressFieldSpec | null, defaultVisible: boolean) => {
  if (!spec) return defaultVisible
  if (spec.hidden === true) return false
  if (spec.enabled === false) return false
  if (spec.visible === false) return false
  return true
}

const fieldLabel = (spec: AddressFieldSpec | null, fallback: string) => (spec?.label ? String(spec.label) : fallback)
const fieldPlaceholder = (spec: AddressFieldSpec | null, fallback: string) => (spec?.placeholder ? String(spec.placeholder) : fallback)

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

const steps: { id: Step; label: string }[] = [
  { id: 'shipping', label: 'Shipping' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'payment', label: 'Payment' },
  { id: 'review', label: 'Review' },
]

export function CheckoutPage({ cart, onComplete }: CheckoutPageProps) {
  const [location, setLocation] = useLocation()
  const { authorizedRequest, isAuthenticated } = useAuth()
  const [currentStep, setCurrentStep] = useState<Step>('shipping')
  const [deliveryMethod, setDeliveryMethod] = useState('')
  const [shippingQuotes, setShippingQuotes] = useState<QuoteOption[]>([])
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false)
  const [isSavingAddress, setIsSavingAddress] = useState(false)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa')
  const [mpesaPhone, setMpesaPhone] = useState('')

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
  }))

  const [locationLevels, setLocationLevels] = useState<LocationOption[][]>([])
  const [locationPath, setLocationPath] = useState<LocationOption[]>([])

  const [countryOptions, setCountryOptions] = useState<LocationOption[]>([])
  const [isLoadingCountries, setIsLoadingCountries] = useState(false)
  const [selectedCountryId, setSelectedCountryId] = useState('')
  const [addressFieldConfig, setAddressFieldConfig] = useState<AddressFieldConfig | null>(null)
  const locationLevelLabels = useMemo(() => extractLocationLevelLabels(addressFieldConfig), [addressFieldConfig])

  if (cart.items.length === 0) {
    setLocation('/cart')
    return null
  }

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  const selectedQuote = useMemo(() => {
    if (!deliveryMethod) return null
    return shippingQuotes.find((q, index) => quoteKey(q, index) === deliveryMethod) ?? null
  }, [deliveryMethod, shippingQuotes])

  const selectedShippingCost = useMemo(() => {
    const amount = selectedQuote ? quoteAmount(selectedQuote) : null
    return amount === null ? cart.shipping : amount
  }, [cart.shipping, selectedQuote])

  const displayTotal = useMemo(() => {
    return cart.subtotal + cart.tax + selectedShippingCost - cart.discount
  }, [cart.discount, cart.subtotal, cart.tax, selectedShippingCost])

  useEffect(() => {
    if (currentStep !== 'delivery') return
    const locationId = shippingAddress.locationId.trim()
    if (!locationId) {
      setShippingQuotes([])
      setDeliveryMethod('')
      return
    }

    const controller = new AbortController()
    let didCancel = false

    ;(async () => {
      setIsLoadingQuotes(true)
      try {
        const payload = await apiRequest<any>(endpoints.shipping.quotes, {
          method: 'POST',
          signal: controller.signal,
          body: {
            locationId,
            currency: 'KES',
            totals: {
              subtotal: cart.subtotal,
              tax: cart.tax,
              discount: cart.discount,
              total: cart.total,
            },
            items: cart.items.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal,
              selectedVariants: item.selectedVariants,
            })),
          },
        })

        if (didCancel) return
        const next = asArray<QuoteOption>(payload)
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
      controller.abort()
    }
  }, [cart.discount, cart.items, cart.shipping, cart.subtotal, cart.tax, cart.total, currentStep, shippingAddress.locationId, deliveryMethod])

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

        setShippingAddress((prev) => ({
          ...prev,
          countryCode: String(data?.countryCode || prev.countryCode || 'KE'),
          locationId: String(data?.locationId || prev.locationId || ''),
          firstName: String(data?.contact?.firstName || data?.firstName || prev.firstName || ''),
          lastName: String(data?.contact?.lastName || data?.lastName || prev.lastName || ''),
          email: String(data?.contact?.email || data?.email || prev.email || ''),
          phone: String(data?.contact?.phone || data?.contact?.phoneNumber || data?.phone || data?.phoneNumber || prev.phone || ''),
          addressLine1: String(data?.address?.addressLine1 || data?.addressLine1 || data?.address1 || prev.addressLine1 || ''),
          addressLine2: String(data?.address?.addressLine2 || data?.addressLine2 || data?.address2 || prev.addressLine2 || ''),
          city: String(data?.address?.city || data?.city || prev.city || ''),
          state: String(data?.address?.state || data?.state || prev.state || ''),
          postalCode: String(data?.address?.postalCode || data?.postalCode || prev.postalCode || ''),
          notes: String(data?.address?.notes || data?.notes || data?.instructions || prev.notes || ''),
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

        // Default country: Kenya.
        const currentCode = (shippingAddress.countryCode || 'KE').trim() || 'KE'
        const match = options.find((c) => c.code === currentCode || c.id === currentCode) || options.find((c) => c.code === 'KE' || c.id === 'KE')
        if (match) {
          setSelectedCountryId(match.id)
          setShippingAddress((prev) => ({ ...prev, countryCode: match.code || currentCode }))
        } else {
          setShippingAddress((prev) => ({ ...prev, countryCode: currentCode }))
        }
      } catch {
        if (didCancel) return
        setCountryOptions([])
      } finally {
        if (!didCancel) setIsLoadingCountries(false)
      }
    })()

    return () => {
      didCancel = true
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const countryCode = shippingAddress.countryCode.trim() || 'KE'
    const controller = new AbortController()
    let didCancel = false

    ;(async () => {
      try {
        // Optional: fetch schema/field-config (best-effort). We use it to label location hierarchy fields.
        const payload = await apiRequest<any>(endpoints.addresses.fieldConfig({ countryCode }), {
          method: 'GET',
          signal: controller.signal,
        })
        if (didCancel) return
        setAddressFieldConfig(unwrap(payload) || null)
      } catch {
        if (didCancel) return
        setAddressFieldConfig(null)
      }
    })()

    // Location hierarchy: load first level.
    ;(async () => {
      setIsLoadingLocations(true)
      try {
        let options: LocationOption[] = []

        if (selectedCountryId) {
          const payloadByParent = await apiRequest<any>(endpoints.locations.list({ parentId: selectedCountryId }), {
            method: 'GET',
            signal: controller.signal,
          })
          if (didCancel) return
          options = toLocationOptions(payloadByParent)
        }

        if (options.length === 0) {
          const payloadByCountry = await apiRequest<any>(endpoints.locations.list({ countryCode }), {
            method: 'GET',
            signal: controller.signal,
          })
          if (didCancel) return
          options = toLocationOptions(payloadByCountry)
        }

        setLocationLevels(options.length > 0 ? [options] : [])
        setLocationPath([])
        setShippingAddress((prev) => ({ ...prev, locationId: '' }))
      } catch {
        if (didCancel) return
        setLocationLevels([])
        setLocationPath([])
        setShippingAddress((prev) => ({ ...prev, locationId: '' }))
      } finally {
        if (!didCancel) setIsLoadingLocations(false)
      }
    })()

    return () => {
      didCancel = true
      controller.abort()
    }
  }, [selectedCountryId, shippingAddress.countryCode])

  const selectLocationAtLevel = async (levelIndex: number, selectedId: string) => {
    const currentLevelOptions = locationLevels[levelIndex] || []
    const chosen = currentLevelOptions.find((o) => o.id === selectedId)
    if (!chosen) return

    const nextPath = [...locationPath.slice(0, levelIndex), chosen]
    setLocationPath(nextPath)
    // Optimistically set; if it has children we clear it.
    setShippingAddress((prev) => ({ ...prev, locationId: chosen.id }))

    const controller = new AbortController()
    try {
      setIsLoadingLocations(true)
      const payload = await apiRequest<any>(endpoints.locations.list({ parentId: chosen.id }), {
        method: 'GET',
        signal: controller.signal,
      })
      const children = toLocationOptions(payload)
      const nextLevels = [...locationLevels.slice(0, levelIndex + 1)]
      if (children.length > 0) {
        nextLevels.push(children)
        // Not at the leaf yet.
        setShippingAddress((prev) => ({ ...prev, locationId: '' }))
      }
      setLocationLevels(nextLevels)
    } catch {
      // If children fetch fails, keep the selected location as the leaf.
      setLocationLevels([...locationLevels.slice(0, levelIndex + 1)])
    } finally {
      setIsLoadingLocations(false)
    }
  }

  const selectedCountryLabel = useMemo(() => {
    const code = shippingAddress.countryCode.trim()
    if (!code) return null
    const match = countryOptions.find((c) => c.code === code || c.id === code)
    return match?.name || null
  }, [countryOptions, shippingAddress.countryCode])

  const selectedCountrySelectValue = useMemo(() => {
    const code = shippingAddress.countryCode.trim()
    if (!code) return ''
    const match = countryOptions.find((c) => c.code === code || c.id === code)
    return match?.id || ''
  }, [countryOptions, shippingAddress.countryCode])

  const setCountryCode = (value: string) => {
    const next = value.trim()
    setShippingAddress((prev) => ({ ...prev, countryCode: next || prev.countryCode }))

    const match = countryOptions.find((c) => c.code === next || c.id === next)
    if (match) setSelectedCountryId(match.id)
  }

  const saveShippingAddress = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to continue')
      setLocation(`/login?redirect=${encodeURIComponent(location)}`)
      return { success: false as const }
    }

    const draft = shippingAddress

    const firstNameState = readFieldState(addressFieldConfig, ['firstName', 'first_name'], 'First Name')
    const lastNameState = readFieldState(addressFieldConfig, ['lastName', 'last_name'], 'Last Name')
    const emailState = readFieldState(addressFieldConfig, ['email'], 'Email')
    const phoneState = readFieldState(addressFieldConfig, ['phone', 'phoneNumber', 'phone_number'], 'Phone')
    const address1State = readFieldState(addressFieldConfig, ['addressLine1', 'address1', 'address_line_1'], 'Address line 1')
    const cityState = readFieldState(addressFieldConfig, ['city'], 'City')
    const stateState = readFieldState(addressFieldConfig, ['state', 'region', 'province'], 'State')
    const postalState = readFieldState(addressFieldConfig, ['postalCode', 'zip', 'postcode'], 'Postal Code')

    const missing: string[] = []
    if (!draft.locationId.trim()) missing.push('Delivery location')
    if (firstNameState.visible && firstNameState.required && !draft.firstName.trim()) missing.push(firstNameState.label || 'First name')
    if (lastNameState.visible && lastNameState.required && !draft.lastName.trim()) missing.push(lastNameState.label || 'Last name')
    if (emailState.visible && emailState.required && !draft.email.trim()) missing.push(emailState.label || 'Email')
    if (phoneState.visible && phoneState.required && !draft.phone.trim()) missing.push(phoneState.label || 'Phone')
    if (address1State.visible && address1State.required && !draft.addressLine1.trim()) missing.push(address1State.label || 'Address line 1')
    if (cityState.visible && cityState.required && !draft.city.trim()) missing.push(cityState.label || 'City')
    if (stateState.visible && stateState.required && !draft.state.trim()) missing.push(stateState.label || 'State')
    if (postalState.visible && postalState.required && !draft.postalCode.trim()) missing.push(postalState.label || 'Postal Code')

    // If neither email nor phone are required by schema, still enforce at least one for reachability.
    if (!emailState.required && !phoneState.required && !draft.phone.trim() && !draft.email.trim()) {
      missing.push('Phone or email')
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
          address: {
            addressLine1: draft.addressLine1,
            addressLine2: draft.addressLine2 || undefined,
            city: draft.city,
            state: draft.state || undefined,
            postalCode: draft.postalCode || undefined,
            notes: draft.notes || undefined,
          },
          contact: {
            firstName: draft.firstName,
            lastName: draft.lastName,
            email: draft.email || undefined,
            phone: draft.phone || undefined,
          },
        },
      })
      toast.success('Shipping address saved')
      return { success: true as const }
    } catch (e: any) {
      toast.error('Failed to save shipping address', { description: e?.message || 'Please try again.' })
      return { success: false as const }
    } finally {
      setIsSavingAddress(false)
    }
  }

  const placeOrder = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to place your order')
      setLocation(`/login?redirect=${encodeURIComponent(location)}`)
      return { success: false as const }
    }

    if (!shippingAddress.locationId.trim()) {
      toast.error('Missing delivery location')
      setCurrentStep('shipping')
      return { success: false as const }
    }

    const methodCode = deliveryMethod.trim()
    if (shippingQuotes.length > 0 && !methodCode) {
      toast.error('Select a delivery option to continue')
      setCurrentStep('delivery')
      return { success: false as const }
    }

    setIsPlacingOrder(true)
    try {
      const payload = await authorizedRequest<any>(endpoints.orders.base, {
        method: 'POST',
        body: {
          shippingMethodCode: methodCode || undefined,
          paymentMethod,
          payment: paymentMethod === 'mpesa' ? { phone: mpesaPhone || undefined } : undefined,
          currency: 'KES',
          totals: {
            subtotal: cart.subtotal,
            tax: cart.tax,
            discount: cart.discount,
            shipping: selectedShippingCost,
            total: displayTotal,
          },
          items: cart.items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            unitPrice: item.price,
            subtotal: item.subtotal,
            selectedVariants: item.selectedVariants,
          })),
        },

                    <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">Location & Address</p>
                          <p className="text-xs text-muted-foreground">Choose where we should deliver, then enter your address.</p>
                        </div>
                        <Badge variant="secondary">Step 1</Badge>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Country</Label>
                          {isLoadingCountries ? (
                            <div className="text-sm text-muted-foreground">Loading countries…</div>
                          ) : countryOptions.length > 0 ? (
                            <Select
                              value={selectedCountryId || selectedCountrySelectValue}
                              onValueChange={(value) => {
                                const selected = countryOptions.find((c) => c.id === value)
                                const code = selected?.code || selected?.id || value
                                setSelectedCountryId(value)
                                setShippingAddress((prev) => ({ ...prev, countryCode: code || 'KE', locationId: '' }))
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
                              onChange={(e) => setCountryCode(e.target.value)}
                              placeholder="Country code (e.g. KE)"
                            />
                          )}
                          {selectedCountryLabel && (
                            <p className="text-xs text-muted-foreground">Selected: {selectedCountryLabel}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Delivery location</Label>
                          <div className="text-xs text-muted-foreground">
                            {shippingAddress.locationId ? (
                              <>Chosen: <span className="font-mono">{shippingAddress.locationId}</span></>
                            ) : (
                              'Select the lowest available location.'
                            )}
                          </div>
                        </div>
                      </div>

                      {isLoadingLocations && locationLevels.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Loading locations for {shippingAddress.countryCode || 'KE'}…</div>
                      ) : locationLevels.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No locations found for {shippingAddress.countryCode || 'KE'}.
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {locationLevels.map((options, levelIndex) => {
                            const selected = locationPath[levelIndex]?.id || ''
                            const label = locationLevelLabels[levelIndex] || `Location level ${levelIndex + 1}`
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

                      {(() => {
                        const address1 = readFieldState(addressFieldConfig, ['addressLine1', 'address1', 'address_line_1'], 'Address line 1', 'Street address')
                        const address2 = readFieldState(addressFieldConfig, ['addressLine2', 'address2', 'address_line_2'], 'Address line 2 (optional)', 'Apartment, suite, building')
                        const city = readFieldState(addressFieldConfig, ['city'], 'City', 'City')
                        const state = readFieldState(addressFieldConfig, ['state', 'region', 'province'], 'State', 'State/Region')
                        const postal = readFieldState(addressFieldConfig, ['postalCode', 'zip', 'postcode'], 'Postal Code', 'Postal code')
                        const notes = readFieldState(addressFieldConfig, ['notes', 'instructions', 'deliveryNotes'], 'Delivery notes (optional)', 'Gate code, landmarks, instructions')

                        return (
                          <div className="space-y-4">
                            {address1.visible && (
                              <div>
                                <Label htmlFor="addressLine1">
                                  {address1.label}
                                  {address1.required ? ' *' : ''}
                                </Label>
                                <Input
                                  id="addressLine1"
                                  placeholder={address1.placeholder}
                                  value={shippingAddress.addressLine1}
                                  onChange={(e) => setShippingAddress((prev) => ({ ...prev, addressLine1: e.target.value }))}
                                />
                              </div>
                            )}

                            {address2.visible && (
                              <div>
                                <Label htmlFor="addressLine2">{address2.label}</Label>
                                <Input
                                  id="addressLine2"
                                  placeholder={address2.placeholder}
                                  value={shippingAddress.addressLine2}
                                  onChange={(e) => setShippingAddress((prev) => ({ ...prev, addressLine2: e.target.value }))}
                                />
                              </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-3">
                              {city.visible && (
                                <div>
                                  <Label htmlFor="city">
                                    {city.label}
                                    {city.required ? ' *' : ''}
                                  </Label>
                                  <Input
                                    id="city"
                                    placeholder={city.placeholder}
                                    value={shippingAddress.city}
                                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, city: e.target.value }))}
                                  />
                                </div>
                              )}

                              {state.visible && (
                                <div>
                                  <Label htmlFor="state">
                                    {state.label}
                                    {state.required ? ' *' : ''}
                                  </Label>
                                  <Input
                                    id="state"
                                    placeholder={state.placeholder}
                                    value={shippingAddress.state}
                                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, state: e.target.value }))}
                                  />
                                </div>
                              )}

                              {postal.visible && (
                                <div>
                                  <Label htmlFor="postalCode">
                                    {postal.label}
                                    {postal.required ? ' *' : ''}
                                  </Label>
                                  <Input
                                    id="postalCode"
                                    placeholder={postal.placeholder}
                                    value={shippingAddress.postalCode}
                                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, postalCode: e.target.value }))}
                                  />
                                </div>
                              )}
                            </div>

                            {notes.visible && (
                              <div>
                                <Label htmlFor="notes">{notes.label}</Label>
                                <Input
                                  id="notes"
                                  placeholder={notes.placeholder}
                                  value={shippingAddress.notes}
                                  onChange={(e) => setShippingAddress((prev) => ({ ...prev, notes: e.target.value }))}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">Contact details</p>
                          <p className="text-xs text-muted-foreground">So we can reach you about your delivery.</p>
                        </div>
                        <Badge variant="secondary">Step 2</Badge>
                      </div>

                      {(() => {
                        const first = readFieldState(addressFieldConfig, ['firstName', 'first_name'], 'First Name', 'John')
                        const last = readFieldState(addressFieldConfig, ['lastName', 'last_name'], 'Last Name', 'Doe')
                        const phone = readFieldState(addressFieldConfig, ['phone', 'phoneNumber', 'phone_number'], 'Phone', '2547…')
                        const email = readFieldState(addressFieldConfig, ['email'], 'Email', 'john@example.com')

                        return (
                          <div className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              {first.visible && (
                                <div>
                                  <Label htmlFor="firstName">
                                    {first.label}
                                    {first.required ? ' *' : ''}
                                  </Label>
                                  <Input
                                    id="firstName"
                                    placeholder={first.placeholder}
                                    value={shippingAddress.firstName}
                                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, firstName: e.target.value }))}
                                  />
                                </div>
                              )}

                              {last.visible && (
                                <div>
                                  <Label htmlFor="lastName">
                                    {last.label}
                                    {last.required ? ' *' : ''}
                                  </Label>
                                  <Input
                                    id="lastName"
                                    placeholder={last.placeholder}
                                    value={shippingAddress.lastName}
                                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, lastName: e.target.value }))}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              {phone.visible && (
                                <div>
                                  <Label htmlFor="phone">
                                    {phone.label}
                                    {phone.required ? ' *' : ''}
                                  </Label>
                                  <Input
                                    id="phone"
                                    type="tel"
                                    placeholder={phone.placeholder}
                                    value={shippingAddress.phone}
                                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, phone: e.target.value }))}
                                  />
                                </div>
                              )}

                              {email.visible && (
                                <div>
                                  <Label htmlFor="email">
                                    {email.label}
                                    {email.required ? ' *' : ''}
                                  </Label>
                                  <Input
                                    id="email"
                                    type="email"
                                    placeholder={email.placeholder}
                                    value={shippingAddress.email}
                                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, email: e.target.value }))}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {!isAuthenticated && (
                        <div className="text-sm text-muted-foreground">
                          You’ll need to sign in to save your shipping address.
                        </div>
                      )}
                    </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {locationLevels.map((options, levelIndex) => {
                            const selected = locationPath[levelIndex]?.id || ''
                            const label = locationLevelLabels[levelIndex] || `Location level ${levelIndex + 1}`
                            return (
                              <div key={levelIndex} className="space-y-1">
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
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Contact</h3>
                        <span className="text-xs text-muted-foreground">Provide phone or email</span>
                      </div>

                      {(() => {
                        const firstNameSpec = findFieldSpec(addressFieldConfig, 'firstName')
                        const lastNameSpec = findFieldSpec(addressFieldConfig, 'lastName')
                        const emailSpec = findFieldSpec(addressFieldConfig, 'email')
                        const phoneSpec = findFieldSpec(addressFieldConfig, 'phone')

                        const showEmail = isSpecVisible(emailSpec, true)
                        const showPhone = isSpecVisible(phoneSpec, true)

                        return (
                          <>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="firstName">
                                  {fieldLabel(firstNameSpec, 'First name')}
                                </Label>
                                <Input
                                  id="firstName"
                                  placeholder={fieldPlaceholder(firstNameSpec, 'John')}
                                  value={shippingAddress.firstName}
                                  onChange={(e) => setShippingAddress((prev) => ({ ...prev, firstName: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="lastName">
                                  {fieldLabel(lastNameSpec, 'Last name')}
                                </Label>
                                <Input
                                  id="lastName"
                                  placeholder={fieldPlaceholder(lastNameSpec, 'Doe')}
                                  value={shippingAddress.lastName}
                                  onChange={(e) => setShippingAddress((prev) => ({ ...prev, lastName: e.target.value }))}
                                />
                              </div>
                            </div>

                            <div className={cn('grid gap-4', showEmail && showPhone ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}>
                              {showEmail && (
                                <div className="space-y-2">
                                  <Label htmlFor="email">{fieldLabel(emailSpec, 'Email')}</Label>
                                  <Input
                                    id="email"
                                    type="email"
                                    placeholder={fieldPlaceholder(emailSpec, 'john@example.com')}
                                    value={shippingAddress.email}
                                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, email: e.target.value }))}
                                  />
                                </div>
                              )}
                              {showPhone && (
                                <div className="space-y-2">
                                  <Label htmlFor="phone">{fieldLabel(phoneSpec, 'Phone')}</Label>
                                  <Input
                                    id="phone"
                                    type="tel"
                                    placeholder={fieldPlaceholder(phoneSpec, '2547…')}
                                    value={shippingAddress.phone}
                                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, phone: e.target.value }))}
                                  />
                                </div>
                              )}
                            </div>
                          </>
                        )
                      })()}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Address</h3>

                      {(() => {
                        const line1Spec = findFieldSpec(addressFieldConfig, 'addressLine1')
                        const line2Spec = findFieldSpec(addressFieldConfig, 'addressLine2')
                        const citySpec = findFieldSpec(addressFieldConfig, 'city')
                        const stateSpec = findFieldSpec(addressFieldConfig, 'state')
                        const postalSpec = findFieldSpec(addressFieldConfig, 'postalCode')
                        const notesSpec = findFieldSpec(addressFieldConfig, 'notes')

                        const showLine2 = isSpecVisible(line2Spec, false) || shippingAddress.addressLine2.trim().length > 0
                        const showState = isSpecVisible(stateSpec, true)
                        const showPostal = isSpecVisible(postalSpec, true)
                        const showNotes = isSpecVisible(notesSpec, false) || shippingAddress.notes.trim().length > 0

                        return (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="addressLine1">{fieldLabel(line1Spec, 'Address line 1')}</Label>
                              <Input
                                id="addressLine1"
                                placeholder={fieldPlaceholder(line1Spec, 'Street address')}
                                value={shippingAddress.addressLine1}
                                onChange={(e) => setShippingAddress((prev) => ({ ...prev, addressLine1: e.target.value }))}
                              />
                            </div>

                            {showLine2 && (
                              <div className="space-y-2">
                                <Label htmlFor="addressLine2">{fieldLabel(line2Spec, 'Address line 2')}</Label>
                                <Input
                                  id="addressLine2"
                                  placeholder={fieldPlaceholder(line2Spec, 'Apartment, suite, building')}
                                  value={shippingAddress.addressLine2}
                                  onChange={(e) => setShippingAddress((prev) => ({ ...prev, addressLine2: e.target.value }))}
                                />
                              </div>
                            )}

                            <div className={cn('grid gap-4', showState && showPostal ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
                              <div className="space-y-2">
                                <Label htmlFor="city">{fieldLabel(citySpec, 'City')}</Label>
                                <Input
                                  id="city"
                                  placeholder={fieldPlaceholder(citySpec, 'City')}
                                  value={shippingAddress.city}
                                  onChange={(e) => setShippingAddress((prev) => ({ ...prev, city: e.target.value }))}
                                />
                              </div>

                              {showState && (
                                <div className="space-y-2">
                                  <Label htmlFor="state">{fieldLabel(stateSpec, 'State / Region')}</Label>
                                  <Input
                                    id="state"
                                    placeholder={fieldPlaceholder(stateSpec, 'State/Region')}
                                    value={shippingAddress.state}
                                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, state: e.target.value }))}
                                  />
                                </div>
                              )}

                              {showPostal && (
                                <div className="space-y-2">
                                  <Label htmlFor="postalCode">{fieldLabel(postalSpec, 'Postal code')}</Label>
                                  <Input
                                    id="postalCode"
                                    placeholder={fieldPlaceholder(postalSpec, 'Postal code')}
                                    value={shippingAddress.postalCode}
                                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, postalCode: e.target.value }))}
                                  />
                                </div>
                              )}
                            </div>

                            {showNotes && (
                              <div className="space-y-2">
                                <Label htmlFor="notes">{fieldLabel(notesSpec, 'Delivery notes')}</Label>
                                <Input
                                  id="notes"
                                  placeholder={fieldPlaceholder(notesSpec, 'Gate code, landmarks, instructions')}
                                  value={shippingAddress.notes}
                                  onChange={(e) => setShippingAddress((prev) => ({ ...prev, notes: e.target.value }))}
                                />
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>

                    {!isAuthenticated && (
                      <div className="rounded-lg border bg-muted/10 p-3 text-sm text-muted-foreground">
                        You’ll need to sign in to save your shipping address.
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 'delivery' && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Delivery Method</h2>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Quotes for: <span className="font-mono">{shippingAddress.locationId || '—'}</span></p>
                    </div>

                    <div className="space-y-3">
                      {isLoadingQuotes && <div className="text-sm text-muted-foreground">Fetching shipping options…</div>}

                      {!isLoadingQuotes && shippingAddress.locationId.trim() && shippingQuotes.length === 0 && (
                        <div className="text-sm text-muted-foreground">No shipping options available for this location.</div>
                      )}

                      {shippingQuotes.length > 0 && (
                        <RadioGroup value={deliveryMethod} onValueChange={setDeliveryMethod}>
                          <div className="space-y-3">
                            {shippingQuotes.map((q, index) => {
                              const key = quoteKey(q, index)
                              const label = quoteLabel(q, index)
                              const amount = quoteAmount(q)
                              const hint = q.description || q.estimatedDays || q.eta

                              return (
                                <Label
                                  key={key}
                                  htmlFor={`quote-${key}`}
                                  className="flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer hover:border-primary transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <RadioGroupItem value={key} id={`quote-${key}`} />
                                    <div className="min-w-0">
                                      <p className="font-medium truncate">{label}</p>
                                      <p className="text-sm text-muted-foreground truncate">{hint || '—'}</p>
                                    </div>
                                  </div>
                                  <span className="font-medium">{amount === null ? '—' : `${q.currency || 'KES'} ${amount}`}</span>
                                </Label>
                              )
                            })}
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                  </div>
                )}

                {currentStep === 'payment' && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Payment Method</h2>
                    
                    <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                      <div className="space-y-4">
                        <div>
                          <Label
                            htmlFor="mpesa"
                            className={cn(
                              "flex items-center justify-between p-5 border-2 rounded-t-xl cursor-pointer transition-all duration-200",
                              paymentMethod === 'mpesa' 
                                ? 'border-neon-green bg-neon-green/5 rounded-b-none shadow-md' 
                                : 'hover:border-neon-green/30 hover:bg-neon-green/5 rounded-b-xl'
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <RadioGroupItem value="mpesa" id="mpesa" />
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-200",
                                  paymentMethod === 'mpesa' ? 'bg-neon-green/20 shadow-lg shadow-neon-green/20' : 'bg-neon-green/10'
                                )}>
                                  <Phone size={28} weight="bold" className="text-neon-green" />
                                </div>
                                <div>
                                  <p className="font-bold text-base">M-Pesa</p>
                                  <p className="text-sm text-muted-foreground">STK Push Payment</p>
                                </div>
                              </div>
                            </div>
                            <Badge className="bg-neon-green/10 text-neon-green border-0 font-semibold">
                              Instant
                            </Badge>
                          </Label>
                          {paymentMethod === 'mpesa' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
                              className="p-5 border-2 border-t-0 border-neon-green bg-neon-green/5 rounded-b-xl space-y-4 shadow-md"
                            >
                              <div className="space-y-2">
                                <Label htmlFor="mpesaPhone" className="font-semibold">
                                  M-Pesa Phone Number
                                </Label>
                                <Input 
                                  id="mpesaPhone" 
                                  type="tel"
                                  placeholder="254712345678" 
                                  value={mpesaPhone}
                                  onChange={(e) => setMpesaPhone(e.target.value)}
                                  className="border-neon-green/30 focus:border-neon-green"
                                />
                              </div>
                              <div className="p-3 rounded-lg bg-background/50 border border-neon-green/20">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  <strong className="text-foreground">Instructions:</strong> Enter your M-Pesa registered phone number above. 
                                  After clicking "Continue", you'll receive an STK push notification on your phone to authorize the payment.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </div>

                        <div>
                          <Label
                            htmlFor="pesapal"
                            className={cn(
                              "flex items-center justify-between p-5 border-2 rounded-t-xl cursor-pointer transition-all duration-200",
                              paymentMethod === 'pesapal' 
                                ? 'border-primary bg-primary/5 rounded-b-none shadow-md' 
                                : 'hover:border-primary/30 hover:bg-primary/5 rounded-b-xl'
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <RadioGroupItem value="pesapal" id="pesapal" />
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-200",
                                  paymentMethod === 'pesapal' ? 'bg-primary/20 shadow-lg shadow-primary/20' : 'bg-primary/10'
                                )}>
                                  <CreditCard size={28} weight="bold" className="text-primary" />
                                </div>
                                <div>
                                  <p className="font-bold text-base">Pesapal</p>
                                  <p className="text-sm text-muted-foreground">Cards, Mobile Money & Bank</p>
                                </div>
                              </div>
                            </div>
                            <Badge className="bg-primary/10 text-primary border-0 font-semibold">
                              Secure
                            </Badge>
                          </Label>
                          {paymentMethod === 'pesapal' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
                              className="p-5 border-2 border-t-0 border-primary bg-primary/5 rounded-b-xl shadow-md"
                            >
                              <div className="p-3 rounded-lg bg-background/50 border border-primary/20">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  <strong className="text-foreground">Instructions:</strong> You'll be securely redirected to Pesapal's payment gateway 
                                  where you can complete your payment using credit/debit cards, mobile money, or bank transfer.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </div>

                        <div>
                          <Label
                            htmlFor="ipay"
                            className={cn(
                              "flex items-center justify-between p-5 border-2 rounded-t-xl cursor-pointer transition-all duration-200",
                              paymentMethod === 'ipay' 
                                ? 'border-cyber-cyan bg-cyber-cyan/5 rounded-b-none shadow-md' 
                                : 'hover:border-cyber-cyan/30 hover:bg-cyber-cyan/5 rounded-b-xl'
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <RadioGroupItem value="ipay" id="ipay" />
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-200",
                                  paymentMethod === 'ipay' ? 'bg-cyber-cyan/20 shadow-lg shadow-cyber-cyan/20' : 'bg-cyber-cyan/10'
                                )}>
                                  <Wallet size={28} weight="bold" className="text-cyber-cyan" />
                                </div>
                                <div>
                                  <p className="font-bold text-base">iPay</p>
                                  <p className="text-sm text-muted-foreground">Multiple Payment Options</p>
                                </div>
                              </div>
                            </div>
                            <Badge className="bg-cyber-cyan/10 text-cyber-cyan border-0 font-semibold">
                              Fast
                            </Badge>
                          </Label>
                          {paymentMethod === 'ipay' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
                              className="p-5 border-2 border-t-0 border-cyber-cyan bg-cyber-cyan/5 rounded-b-xl shadow-md"
                            >
                              <div className="p-3 rounded-lg bg-background/50 border border-cyber-cyan/20">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  <strong className="text-foreground">Instructions:</strong> You'll be redirected to iPay's secure payment platform 
                                  to complete your transaction using your preferred payment method.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </div>

                        <div>
                          <Label
                            htmlFor="paystack"
                            className={cn(
                              "flex items-center justify-between p-5 border-2 rounded-t-xl cursor-pointer transition-all duration-200",
                              paymentMethod === 'paystack' 
                                ? 'border-accent bg-accent/5 rounded-b-none shadow-md' 
                                : 'hover:border-accent/30 hover:bg-accent/5 rounded-b-xl'
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <RadioGroupItem value="paystack" id="paystack" />
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-200",
                                  paymentMethod === 'paystack' ? 'bg-accent/20 shadow-lg shadow-accent/20' : 'bg-accent/10'
                                )}>
                                  <CreditCard size={28} weight="bold" className="text-accent" />
                                </div>
                                <div>
                                  <p className="font-bold text-base">Paystack</p>
                                  <p className="text-sm text-muted-foreground">Cards & Mobile Money</p>
                                </div>
                              </div>
                            </div>
                            <Badge className="bg-accent/10 text-accent border-0 font-semibold">
                              Trusted
                            </Badge>
                          </Label>
                          {paymentMethod === 'paystack' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
                              className="p-5 border-2 border-t-0 border-accent bg-accent/5 rounded-b-xl shadow-md"
                            >
                              <div className="p-3 rounded-lg bg-background/50 border border-accent/20">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  <strong className="text-foreground">Instructions:</strong> You'll be redirected to Paystack's trusted payment gateway 
                                  to securely complete your payment with cards or mobile money.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {currentStep === 'review' && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Review Your Order</h2>
                    
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Order Items</h3>
                      {cart.items.map((item) => (
                        <div key={item.id} className="flex gap-4 p-4 rounded-lg border bg-card">
                          <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <img
                              src={item.product.images[0]?.url}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.product.brand}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                              <span className="text-xs text-muted-foreground">•</span>
                              <Price price={item.product.price} currency="KES" size="sm" />
                            </div>
                          </div>
                          <div className="text-right">
                            <Price price={item.subtotal} currency="KES" size="md" className="font-bold" />
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <h3 className="text-sm font-semibold mb-2">Shipping Address</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{formatShippingAddress(shippingAddress) || '—'}</p>
                      </div>

                      <div className="p-4 rounded-lg border bg-muted/30">
                        <h3 className="text-sm font-semibold mb-2">Payment Method</h3>
                        <div className="flex items-center gap-2">
                          {paymentMethod === 'mpesa' && (
                            <>
                              <div className="w-8 h-8 rounded-md bg-neon-green/10 flex items-center justify-center">
                                <Phone size={16} weight="bold" className="text-neon-green" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">M-Pesa</p>
                                <p className="text-xs text-muted-foreground">{mpesaPhone || 'Not provided'}</p>
                              </div>
                            </>
                          )}
                          {paymentMethod === 'pesapal' && (
                            <>
                              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                                <CreditCard size={16} weight="bold" className="text-primary" />
                              </div>
                              <p className="text-sm font-medium">Pesapal</p>
                            </>
                          )}
                          {paymentMethod === 'ipay' && (
                            <>
                              <div className="w-8 h-8 rounded-md bg-cyber-cyan/10 flex items-center justify-center">
                                <Wallet size={16} weight="bold" className="text-cyber-cyan" />
                              </div>
                              <p className="text-sm font-medium">iPay</p>
                            </>
                          )}
                          {paymentMethod === 'paystack' && (
                            <>
                              <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center">
                                <CreditCard size={16} weight="bold" className="text-accent" />
                              </div>
                              <p className="text-sm font-medium">Paystack</p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="p-4 rounded-lg border bg-muted/30">
                        <h3 className="text-sm font-semibold mb-2">Delivery Method</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedQuote
                            ? `${quoteLabel(selectedQuote, 0)}${selectedQuote.estimatedDays ? ` (${selectedQuote.estimatedDays})` : ''}`
                            : shippingAddress.locationId.trim()
                              ? 'No delivery option selected'
                              : 'No delivery location selected'}
                        </p>
                      </div>

                      <div className="p-4 rounded-lg border bg-primary/5">
                        <h3 className="text-sm font-semibold mb-2 text-primary">Order Total</h3>
                        <Price price={displayTotal} currency="KES" size="lg" className="font-bold" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-8">
                  <Button variant="outline" onClick={handleBack} className="flex-1">
                    <ArrowLeft size={16} className="mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleNext} className="flex-1" disabled={isSavingAddress || isPlacingOrder}>
                    {currentStep === 'review'
                      ? isPlacingOrder
                        ? 'Placing Order…'
                        : 'Place Order'
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
                  <h3 className="font-semibold mb-4">Order Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <Price price={cart.subtotal} currency="KES" size="sm" />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      {selectedShippingCost === 0 ? (
                        <span className="text-primary font-medium">Free</span>
                      ) : (
                        <Price price={selectedShippingCost} currency="KES" size="sm" />
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <Price price={cart.tax} currency="KES" size="sm" />
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-semibold">Total</span>
                      <Price price={displayTotal} currency="KES" size="lg" />
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

*/
