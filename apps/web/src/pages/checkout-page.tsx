import { useEffect, useMemo, useState } from 'react'
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
}

const steps: { id: Step; label: string }[] = [
  { id: 'shipping', label: 'Shipping' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'payment', label: 'Payment' },
  { id: 'review', label: 'Review' },
]

const unwrap = (payload: any) => payload?.data ?? payload

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
    config.schema?.locationChain,
    config.data?.schema?.locationChain,
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

  return []
}

const getConfigFieldsArray = (config: AddressFieldConfig | null): any[] | null => {
  if (!config) return null
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

export function CheckoutPage({ cart, onComplete }: CheckoutPageProps) {
  const [location, setLocation] = useLocation()
  const { authorizedRequest, isAuthenticated, isReady } = useAuth()

  const [currentStep, setCurrentStep] = useState<Step>('shipping')
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa')
  const [mpesaPhone, setMpesaPhone] = useState('')

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
  }))

  const [addressFieldConfig, setAddressFieldConfig] = useState<AddressFieldConfig | null>(null)
  const locationLevelLabels = useMemo(() => extractLocationLevelLabels(addressFieldConfig), [addressFieldConfig])

  const [countryOptions, setCountryOptions] = useState<LocationOption[]>([])
  const [isLoadingCountries, setIsLoadingCountries] = useState(false)
  const [selectedCountryId, setSelectedCountryId] = useState('')

  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [locationLevels, setLocationLevels] = useState<LocationOption[][]>([])
  const [locationPath, setLocationPath] = useState<LocationOption[]>([])

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

  // Guard: empty cart.
  useEffect(() => {
    if (cart.items.length > 0) return
    setLocation('/cart')
  }, [cart.items.length, setLocation])

  // Guard: require authentication before checkout.
  useEffect(() => {
    if (!isReady) return
    if (cart.items.length === 0) return
    if (isAuthenticated) return
    setLocation(`/login?redirect=${encodeURIComponent('/checkout')}`)
  }, [cart.items.length, isAuthenticated, isReady, setLocation])

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

        setShippingAddress((prev) => ({
          ...prev,
          countryCode: String(data?.countryCode || prev.countryCode || 'KE'),
          locationId: String(data?.locationId || prev.locationId || ''),
          firstName: String(data?.contact?.firstName || data?.firstName || prev.firstName || ''),
          lastName: String(data?.contact?.lastName || data?.lastName || prev.lastName || ''),
          email: String(data?.contact?.email || data?.email || prev.email || ''),
          phone: String(
            data?.contact?.phone ||
              data?.contact?.phoneNumber ||
              data?.phone ||
              data?.phoneNumber ||
              prev.phone ||
              ''
          ),
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

  // Load field-config + first location level when country changes.
  useEffect(() => {
    const countryCode = shippingAddress.countryCode.trim() || 'KE'
    const controller = new AbortController()
    let didCancel = false

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
      setIsLoadingLocations(true)
      try {
        let options: LocationOption[] = []

        if (selectedCountryId) {
          const byParent = await apiRequest<any>(endpoints.locations.list({ parentId: selectedCountryId }), {
            method: 'GET',
            signal: controller.signal,
          })
          if (didCancel) return
          options = toLocationOptions(byParent)
        }

        if (options.length === 0) {
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
  }, [selectedCountryId, shippingAddress.countryCode])

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
      const payload = await apiRequest<any>(endpoints.locations.list({ parentId: chosen.id }), {
        method: 'GET',
        signal: controller.signal,
      })
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
              selectedVariants: (item as any).selectedVariants,
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
  }, [cart.discount, cart.items, cart.subtotal, cart.tax, cart.total, currentStep, deliveryMethod, shippingAddress.locationId])

  const saveShippingAddress = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to continue')
      setLocation(`/login?redirect=${encodeURIComponent(location)}`)
      return { success: false as const }
    }

    const draft = shippingAddress

    const firstNameState = readFieldState(addressFieldConfig, ['firstName', 'first_name'], 'First name')
    const lastNameState = readFieldState(addressFieldConfig, ['lastName', 'last_name'], 'Last name')
    const emailState = readFieldState(addressFieldConfig, ['email'], 'Email')
    const phoneState = readFieldState(addressFieldConfig, ['phone', 'phoneNumber', 'phone_number'], 'Phone')

    const address1State = readFieldState(addressFieldConfig, ['addressLine1', 'address1', 'address_line_1'], 'Address line 1')
    const cityState = readFieldState(addressFieldConfig, ['city'], 'City')
    const stateState = readFieldState(addressFieldConfig, ['state', 'region', 'province'], 'State')
    const postalState = readFieldState(addressFieldConfig, ['postalCode', 'zip', 'postcode'], 'Postal code')

    const missing: string[] = []
    if (!draft.locationId.trim()) missing.push('Delivery location')
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

    if (shippingQuotes.length > 0 && !deliveryMethod.trim()) {
      toast.error('Select a delivery option to continue')
      setCurrentStep('delivery')
      return { success: false as const }
    }

    setIsPlacingOrder(true)
    try {
      await authorizedRequest<any>(endpoints.orders.base, {
        method: 'POST',
        body: {
          shippingMethodCode: deliveryMethod.trim() || undefined,
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
            selectedVariants: (item as any).selectedVariants,
          })),
        },
      })

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
      setCurrentStep('payment')
      return
    }

    if (currentStep === 'payment') {
      if (paymentMethod === 'mpesa' && !mpesaPhone.trim()) {
        toast.error('Enter your M-Pesa phone number')
        return
      }
      setCurrentStep('review')
      return
    }

    if (currentStep === 'review') {
      await placeOrder()
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
              {isLoadingCountries ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : countryOptions.length > 0 ? (
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

            <div className="space-y-2">
              <Label>Delivery location</Label>
              <div className="text-sm text-muted-foreground">
                {shippingAddress.locationId ? (
                  <>Chosen: <span className="font-mono">{shippingAddress.locationId}</span></>
                ) : (
                  'Select the lowest available location.'
                )}
              </div>
            </div>
          </div>

          {isLoadingLocations && locationLevels.length === 0 ? (
            <div className="text-sm text-muted-foreground">Loading locations…</div>
          ) : locationLevels.length === 0 ? (
            <div className="text-sm text-muted-foreground">No locations found for {shippingAddress.countryCode || 'KE'}.</div>
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
        </div>

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
                    <p className="text-sm text-muted-foreground">
                      Quotes for: <span className="font-mono">{shippingAddress.locationId || '—'}</span>
                    </p>

                    {isLoadingQuotes ? <div className="text-sm text-muted-foreground">Fetching shipping options…</div> : null}

                    {!isLoadingQuotes && shippingAddress.locationId.trim() && shippingQuotes.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No shipping options available for this location.</div>
                    ) : null}

                    {shippingQuotes.length > 0 ? (
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
                                className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors"
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
                    ) : null}
                  </div>
                )}

                {currentStep === 'payment' && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Payment method</h2>

                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                      <div className="grid gap-3">
                        {(
                          [
                            { value: 'mpesa', label: 'M-Pesa', description: 'STK push payment' },
                            { value: 'pesapal', label: 'Pesapal', description: 'Cards, mobile money & bank' },
                            { value: 'ipay', label: 'iPay', description: 'Multiple payment options' },
                            { value: 'paystack', label: 'Paystack', description: 'Cards & mobile money' },
                          ] as const
                        ).map((m) => (
                          <Label
                            key={m.value}
                            htmlFor={m.value}
                            className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value={m.value} id={m.value} />
                              <div>
                                <p className="font-medium">{m.label}</p>
                                <p className="text-sm text-muted-foreground">{m.description}</p>
                              </div>
                            </div>
                          </Label>
                        ))}
                      </div>
                    </RadioGroup>

                    {paymentMethod === 'mpesa' ? (
                      <div className="space-y-2">
                        <Label htmlFor="mpesaPhone">M-Pesa phone</Label>
                        <Input
                          id="mpesaPhone"
                          type="tel"
                          placeholder="254712345678"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                        />
                      </div>
                    ) : null}
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
                            <Price price={item.subtotal} currency="KES" size="sm" />
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
                        <p className="text-sm text-muted-foreground">{paymentMethod.toUpperCase()}</p>
                        {paymentMethod === 'mpesa' ? (
                          <p className="text-xs text-muted-foreground mt-1">{mpesaPhone || 'No phone provided'}</p>
                        ) : null}
                      </div>

                      <div className="p-4 rounded-lg border bg-primary/5">
                        <h3 className="text-sm font-semibold mb-2 text-primary">Order total</h3>
                        <Price price={displayTotal} currency="KES" size="lg" className="font-semibold" />
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
                        ? 'Placing order…'
                        : 'Place order'
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
