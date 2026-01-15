import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useRoute } from 'wouter'
import { ArrowLeft, Check, ChevronsUpDown, Eye, MapPin, Pencil, Plus, RefreshCcw, Save, Settings2, Trash2, Truck, X } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { endpoints } from '@/lib/endpoints'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/commerce/confirm-dialog'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

type ShippingZone = {
  id: string
  name?: string
  code?: string
  isActive?: boolean
  priority?: number
}

type ZoneLocation = {
  id?: string
  locationId: string
  name?: string
}

type LocationOption = {
  id: string
  label: string
  countryCode?: string | null
  code?: string | null
}

type LocationDetail = {
  id: string
  name: string
  code?: string | null
  countryCode?: string | null
}

type ShippingMethod = {
  id: string
  code?: string
  displayName?: string
  provider?: string
  isActive?: boolean
  priority?: number
}

type ShippingRate = {
  id: string
  name?: string
  isActive?: boolean
  priority?: number
  currency?: string
  calculationType?: string
  amount?: number
  formula?: string
  table?: any
}

type MethodDraft = {
  code: string
  displayName: string
  provider: string
  isActive: boolean
}

type RateDraft = {
  name: string
  currency: string
  calculationType: string
  priority: string
  isActive: boolean
  amount: string
  formula: string
  tableJson: string
}

type QuoteOption = {
  id?: string
  methodId?: string
  name?: string
  label?: string
  description?: string
  amount?: number
  price?: number
  currency?: string
  estimatedDays?: string
  eta?: string
}

type TabId = 'destinations' | 'methods' | 'rates' | 'preview'

const TABS: { id: TabId; label: string; icon: typeof MapPin }[] = [
  { id: 'destinations', label: 'Destinations', icon: MapPin },
  { id: 'methods', label: 'Methods', icon: Settings2 },
  { id: 'rates', label: 'Rates', icon: Truck },
  { id: 'preview', label: 'Preview Quotes', icon: Eye },
]

const unwrap = (payload: any) => payload?.data ?? payload

const asArray = <T,>(payload: any): T[] => {
  const unwrapped = unwrap(payload)
  if (Array.isArray(unwrapped)) return unwrapped as T[]
  if (Array.isArray(unwrapped?.items)) return unwrapped.items as T[]
  return []
}

const toZoneLocation = (raw: any): ZoneLocation => {
  if (typeof raw === 'string') return { locationId: raw }
  return {
    id: raw?.id ? String(raw.id) : undefined,
    locationId: String(raw?.locationId ?? raw?.location?.id ?? raw?.id ?? ''),
    name: raw?.name ? String(raw.name) : undefined,
  }
}

const toQuoteKey = (q: QuoteOption, index: number) => String(q.id || q.methodId || q.name || q.label || index)

export function AdminShippingZonePage() {
  const [, params] = useRoute('/axis/shipping/:zoneId/:tab?')
  const [, setLocation] = useLocation()
  const { authorizedRequest } = useAdminAuth()

  const zoneId = params?.zoneId ? decodeURIComponent(params.zoneId) : null
  const tab = (params?.tab as TabId | undefined) || 'destinations'

  const [zone, setZone] = useState<ShippingZone | null>(null)
  const [isLoadingZone, setIsLoadingZone] = useState(false)

  const [locations, setLocations] = useState<ZoneLocation[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)

  const locationsRef = useRef<ZoneLocation[]>([])

  useEffect(() => {
    locationsRef.current = locations
  }, [locations])

  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState('')
  const [locationSearchResults, setLocationSearchResults] = useState<LocationOption[]>([])
  const [isSearchingLocations, setIsSearchingLocations] = useState(false)
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null)

  const [locationDetailsById, setLocationDetailsById] = useState<Record<string, LocationDetail>>({})
  const locationDetailsByIdRef = useRef<Record<string, LocationDetail>>({})

  useEffect(() => {
    locationDetailsByIdRef.current = locationDetailsById
  }, [locationDetailsById])

  const [methods, setMethods] = useState<ShippingMethod[]>([])
  const [isLoadingMethods, setIsLoadingMethods] = useState(false)

  const [editingMethodId, setEditingMethodId] = useState<string | null>(null)
  const [methodDraft, setMethodDraft] = useState<MethodDraft | null>(null)
  const [isSavingMethod, setIsSavingMethod] = useState(false)
  const [deleteMethodId, setDeleteMethodId] = useState<string | null>(null)
  const [isDeletingMethod, setIsDeletingMethod] = useState(false)

  const [selectedMethodId, setSelectedMethodId] = useState<string>('')
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [isLoadingRates, setIsLoadingRates] = useState(false)

  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const [rateDraft, setRateDraft] = useState<RateDraft | null>(null)
  const [isSavingRate, setIsSavingRate] = useState(false)
  const [deleteRateId, setDeleteRateId] = useState<string | null>(null)
  const [isDeletingRate, setIsDeletingRate] = useState(false)

  const loadZone = useCallback(async () => {
    if (!zoneId) return
    setIsLoadingZone(true)
    try {
      const payload = await authorizedRequest<any>(endpoints.shipping.zoneById(zoneId), { method: 'GET' })
      const z = unwrap(payload)
      setZone({
        id: String(z?.id ?? zoneId),
        name: z?.name ? String(z.name) : undefined,
        code: z?.code ? String(z.code) : undefined,
        isActive: typeof z?.isActive === 'boolean' ? z.isActive : undefined,
        priority: typeof z?.priority === 'number' ? z.priority : undefined,
      })
    } catch (e: any) {
      toast.error('Failed to load zone', { description: e?.message || 'Please try again.' })
    } finally {
      setIsLoadingZone(false)
    }
  }, [authorizedRequest, zoneId])

  const loadLocations = useCallback(async () => {
    if (!zoneId) return
    setIsLoadingLocations(true)
    try {
      const payload = await authorizedRequest<any>(endpoints.shipping.zoneLocations(zoneId), { method: 'GET' })
      const list = asArray<any>(payload).map(toZoneLocation).filter((l) => l.locationId)
      setLocations(list)

      const ids = Array.from(new Set(list.map((l) => l.locationId))).filter(Boolean)
      await Promise.all(
        ids
          .filter((id) => !locationDetailsByIdRef.current[id])
          .map(async (id) => {
            try {
              const raw = unwrap(await authorizedRequest<any>(endpoints.locations.byId(id), { method: 'GET' }))
              const detail: LocationDetail = {
                id,
                name: String(raw?.name ?? raw?.label ?? raw?.displayName ?? raw?.code ?? id),
                code: raw?.code ? String(raw.code) : (raw?.locationId ? String(raw.locationId) : null),
                countryCode: raw?.countryCode ? String(raw.countryCode) : (raw?.country?.code ? String(raw.country.code) : null),
              }
              setLocationDetailsById((prev) => ({ ...prev, [id]: detail }))
            } catch {
              // Best-effort only.
            }
          })
      )
    } catch (e: any) {
      toast.error('Failed to load destinations', { description: e?.message || 'Please try again.' })
    } finally {
      setIsLoadingLocations(false)
    }
  }, [authorizedRequest, zoneId])

  const searchLocations = useCallback(
    async (q: string) => {
      const query = q.trim()
      if (!query) {
        setLocationSearchResults([])
        setLocationSearchError(null)
        return
      }

      setIsSearchingLocations(true)
      setLocationSearchError(null)
      try {
        const payload = await authorizedRequest<any>(endpoints.locations.list({ q: query }), { method: 'GET' })
        const items = asArray<any>(payload)
        const options: LocationOption[] = items
          .map((raw) => {
            const id = String(raw?.id ?? raw?.code ?? raw?.locationId ?? '')
            const label = String(raw?.name ?? raw?.label ?? raw?.displayName ?? id)
            const countryCode =
              String(
                raw?.countryCode ??
                  raw?.country?.code ??
                  raw?.country?.iso2 ??
                  raw?.address?.countryCode ??
                  ''
              ).trim() || null
            const code = String(raw?.code ?? raw?.locationId ?? '').trim() || null
            return id ? { id, label, countryCode, code } : null
          })
          .filter(Boolean) as LocationOption[]

        options.sort((a, b) => a.label.localeCompare(b.label))
        setLocationSearchResults(options)
      } catch (e: any) {
        setLocationSearchResults([])
        setLocationSearchError(e?.message ? String(e.message) : 'Failed to search locations')
      } finally {
        setIsSearchingLocations(false)
      }
    },
    [authorizedRequest]
  )

  const loadMethods = useCallback(async () => {
    if (!zoneId) return
    setIsLoadingMethods(true)
    try {
      const payload = await authorizedRequest<any>(endpoints.shipping.methodsByZone(zoneId), { method: 'GET' })
      const list = asArray<any>(payload).map((m) => ({
        id: String(m?.id ?? ''),
        code: m?.code ? String(m.code) : undefined,
        displayName: m?.displayName ? String(m.displayName) : m?.name ? String(m.name) : undefined,
        provider: m?.provider ? String(m.provider) : undefined,
        isActive: typeof m?.isActive === 'boolean' ? m.isActive : undefined,
        priority: typeof m?.priority === 'number' ? m.priority : undefined,
      }))
      setMethods(list.filter((m) => m.id))

      if (!selectedMethodId && list.length > 0) {
        setSelectedMethodId(String(list[0].id))
      }
    } catch (e: any) {
      toast.error('Failed to load methods', { description: e?.message || 'Please try again.' })
    } finally {
      setIsLoadingMethods(false)
    }
  }, [authorizedRequest, selectedMethodId, zoneId])

  const patchMethod = useCallback(
    async (methodId: string, body: any) => {
      await authorizedRequest<void>(endpoints.shipping.methodById(methodId), { method: 'PATCH', body })
    },
    [authorizedRequest]
  )

  const removeMethod = useCallback(
    async (methodId: string) => {
      await authorizedRequest<void>(endpoints.shipping.methodById(methodId), { method: 'DELETE' })
    },
    [authorizedRequest]
  )

  const beginEditMethod = useCallback((method: ShippingMethod) => {
    setEditingMethodId(method.id)
    setMethodDraft({
      code: method.code || '',
      displayName: method.displayName || '',
      provider: method.provider || '',
      isActive: method.isActive !== false,
    })
  }, [])

  const cancelEditMethod = useCallback(() => {
    setEditingMethodId(null)
    setMethodDraft(null)
  }, [])

  const loadRates = useCallback(async () => {
    if (!selectedMethodId) return
    setIsLoadingRates(true)
    try {
      const payload = await authorizedRequest<any>(endpoints.shipping.ratesByMethod(selectedMethodId), { method: 'GET' })
      const list = asArray<any>(payload).map((r) => ({
        id: String(r?.id ?? ''),
        name: r?.name ? String(r.name) : undefined,
        isActive: typeof r?.isActive === 'boolean' ? r.isActive : undefined,
        priority: typeof r?.priority === 'number' ? r.priority : undefined,
        currency: r?.currency ? String(r.currency) : undefined,
        calculationType: r?.calculationType ? String(r.calculationType) : undefined,
        amount: typeof r?.amount === 'number' ? r.amount : undefined,
        formula: r?.formula ? String(r.formula) : undefined,
        table: r?.table,
      }))
      setRates(list.filter((r) => r.id))
    } catch (e: any) {
      toast.error('Failed to load rates', { description: e?.message || 'Please try again.' })
    } finally {
      setIsLoadingRates(false)
    }
  }, [authorizedRequest, selectedMethodId])

  const patchRate = useCallback(
    async (rateId: string, body: any) => {
      await authorizedRequest<void>(endpoints.shipping.rateById(rateId), { method: 'PATCH', body })
    },
    [authorizedRequest]
  )

  const removeRate = useCallback(
    async (rateId: string) => {
      await authorizedRequest<void>(endpoints.shipping.rateById(rateId), { method: 'DELETE' })
    },
    [authorizedRequest]
  )

  const beginEditRate = useCallback((rate: ShippingRate) => {
    setEditingRateId(rate.id)
    setRateDraft({
      name: rate.name || '',
      currency: rate.currency || 'KES',
      calculationType: rate.calculationType || 'flat',
      priority: typeof rate.priority === 'number' ? String(rate.priority) : '',
      isActive: rate.isActive !== false,
      amount: typeof rate.amount === 'number' ? String(rate.amount) : '',
      formula: rate.formula || '',
      tableJson: rate.table ? JSON.stringify(rate.table, null, 2) : '',
    })
  }, [])

  const cancelEditRate = useCallback(() => {
    setEditingRateId(null)
    setRateDraft(null)
  }, [])

  useEffect(() => {
    loadZone()
  }, [loadZone])

  useEffect(() => {
    if (!zoneId) return
    if (tab === 'destinations') loadLocations()
    if (tab === 'methods') loadMethods()
    if (tab === 'rates') {
      loadMethods()
    }
  }, [loadLocations, loadMethods, tab, zoneId])

  useEffect(() => {
    if (tab !== 'destinations') return
    const q = locationSearch.trim()
    if (!q) {
      setLocationSearchResults([])
      setLocationSearchError(null)
      return
    }

    const t = setTimeout(() => {
      searchLocations(q)
    }, 250)

    return () => clearTimeout(t)
  }, [locationSearch, searchLocations, tab])

  useEffect(() => {
    if (tab !== 'rates') return
    if (!selectedMethodId) return
    loadRates()
  }, [loadRates, selectedMethodId, tab])

  const zoneTitle = zone?.name || zoneId || 'Zone'

  const activeTab = useMemo<TabId>(() => {
    const match = TABS.find((t) => t.id === tab)
    return match ? match.id : 'destinations'
  }, [tab])

  const navigateTab = (next: TabId) => {
    if (!zoneId) return
    setLocation(`/axis/shipping/${encodeURIComponent(zoneId)}/${next}`)
  }

  const [newLocationId, setNewLocationId] = useState('')
  const [isAddingLocation, setIsAddingLocation] = useState(false)

  const selectedLocationLabel = useMemo(() => {
    if (!newLocationId) return ''
    const fromResults = locationSearchResults.find((o) => o.id === newLocationId)
    if (fromResults) return fromResults.label
    const fromAttached = locations.find((l) => l.locationId === newLocationId)
    if (fromAttached) return fromAttached.name ? `${fromAttached.name} (${fromAttached.locationId})` : fromAttached.locationId
    return newLocationId
  }, [locationSearchResults, locations, newLocationId])

  const canAddLocation = newLocationId.trim().length > 0 && newLocationId.trim() !== '__none'

  const handleAddLocation = useCallback(async () => {
    if (!zoneId || !canAddLocation) return
    setIsAddingLocation(true)
    try {
      const locationId = newLocationId.trim()
      const selected = locationSearchResults.find((o) => o.id === locationId)

      let countryCode: string | null =
        (selected?.countryCode ? String(selected.countryCode) : null) ||
        (locationDetailsById[locationId]?.countryCode ? String(locationDetailsById[locationId].countryCode) : null)

      if (!countryCode) {
        try {
          const raw = unwrap(await authorizedRequest<any>(endpoints.locations.byId(locationId), { method: 'GET' }))
          countryCode = raw?.countryCode ? String(raw.countryCode) : (raw?.country?.code ? String(raw.country.code) : null)
          const detail: LocationDetail = {
            id: locationId,
            name: String(raw?.name ?? raw?.label ?? raw?.displayName ?? raw?.code ?? locationId),
            code: raw?.code ? String(raw.code) : (raw?.locationId ? String(raw.locationId) : null),
            countryCode,
          }
          setLocationDetailsById((prev) => ({ ...prev, [locationId]: detail }))
        } catch {
          // ignore
        }
      }

      if (!countryCode) {
        toast.error('Country code is required', {
          description: 'Select a location with a country code, then try again.',
        })
        return
      }

      const body = { locationId, countryCode }
      await authorizedRequest<void>(endpoints.shipping.zoneLocations(zoneId), { method: 'POST', body })
      toast.success('Destination added')
      setNewLocationId('')
      await loadLocations()
    } catch (e: any) {
      toast.error('Failed to add destination', { description: e?.message || 'Please try again.' })
    } finally {
      setIsAddingLocation(false)
    }
  }, [authorizedRequest, canAddLocation, loadLocations, locationDetailsById, locationSearchResults, newLocationId, zoneId])

  const handleRemoveLocation = useCallback(
    async (locationId: string) => {
      if (!zoneId) return
      try {
        const body = { locationId }
        await authorizedRequest<void>(endpoints.shipping.zoneLocations(zoneId), { method: 'DELETE', body })
        toast.success('Destination removed')
        await loadLocations()
      } catch (e: any) {
        toast.error('Failed to remove destination', { description: e?.message || 'Please try again.' })
      }
    },
    [authorizedRequest, loadLocations, zoneId]
  )

  const [newMethodCode, setNewMethodCode] = useState('')
  const [newMethodDisplayName, setNewMethodDisplayName] = useState('')
  const [newMethodProvider, setNewMethodProvider] = useState('')
  const [isCreatingMethod, setIsCreatingMethod] = useState(false)

  const canCreateMethod = newMethodCode.trim().length > 0 && newMethodDisplayName.trim().length > 0

  const handleCreateMethod = useCallback(async () => {
    if (!zoneId || !canCreateMethod) return
    setIsCreatingMethod(true)
    try {
      const body = {
        code: newMethodCode.trim(),
        displayName: newMethodDisplayName.trim(),
        ...(newMethodProvider.trim() ? { provider: newMethodProvider.trim() } : {}),
      }

      await authorizedRequest<void>(endpoints.shipping.methodsByZone(zoneId), { method: 'POST', body })
      toast.success('Method created')
      setNewMethodCode('')
      setNewMethodDisplayName('')
      setNewMethodProvider('')
      await loadMethods()
    } catch (e: any) {
      toast.error('Failed to create method', { description: e?.message || 'Please try again.' })
    } finally {
      setIsCreatingMethod(false)
    }
  }, [authorizedRequest, canCreateMethod, loadMethods, newMethodCode, newMethodDisplayName, newMethodProvider, zoneId])

  const handleSaveMethod = useCallback(async () => {
    if (!editingMethodId || !methodDraft) return
    if (!methodDraft.code.trim()) {
      toast.error('Method code is required')
      return
    }
    if (!methodDraft.displayName.trim()) {
      toast.error('Method display name is required')
      return
    }

    setIsSavingMethod(true)
    try {
      await patchMethod(editingMethodId, {
        code: methodDraft.code.trim(),
        displayName: methodDraft.displayName.trim(),
        ...(methodDraft.provider.trim() ? { provider: methodDraft.provider.trim() } : {}),
        isActive: methodDraft.isActive,
      })
      toast.success('Method updated')
      cancelEditMethod()
      await loadMethods()
    } catch (e: any) {
      toast.error('Failed to update method', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSavingMethod(false)
    }
  }, [cancelEditMethod, editingMethodId, loadMethods, methodDraft, patchMethod])

  const handleConfirmDeleteMethod = useCallback(async () => {
    if (!deleteMethodId) return
    setIsDeletingMethod(true)
    try {
      await removeMethod(deleteMethodId)
      toast.success('Method deleted')
      setDeleteMethodId(null)
      if (editingMethodId === deleteMethodId) cancelEditMethod()
      if (selectedMethodId === deleteMethodId) setSelectedMethodId('')
      await loadMethods()
    } catch (e: any) {
      toast.error('Failed to delete method', { description: e?.message || 'Please try again.' })
    } finally {
      setIsDeletingMethod(false)
    }
  }, [cancelEditMethod, deleteMethodId, editingMethodId, loadMethods, removeMethod, selectedMethodId])

  const [rateName, setRateName] = useState('')
  const [rateCurrency, setRateCurrency] = useState('KES')
  const [ratePriority, setRatePriority] = useState('100')
  const [rateType, setRateType] = useState('flat')
  const [rateAmount, setRateAmount] = useState('')
  const [rateFormula, setRateFormula] = useState('')
  const [rateTableJson, setRateTableJson] = useState('')
  const [isCreatingRate, setIsCreatingRate] = useState(false)

  const canCreateRate = Boolean(selectedMethodId) && rateType.trim().length > 0

  const handleCreateRate = useCallback(async () => {
    if (!selectedMethodId || !canCreateRate) return

    let parsedTable: any = undefined
    if (rateType === 'table_rate' && rateTableJson.trim()) {
      try {
        parsedTable = JSON.parse(rateTableJson)
      } catch (e) {
        toast.error('Invalid table JSON', { description: 'Please provide valid JSON for table rates.' })
        return
      }
    }

    setIsCreatingRate(true)
    try {
      const body = {
        ...(rateName.trim() ? { name: rateName.trim() } : {}),
        calculationType: rateType,
        currency: rateCurrency,
        ...(ratePriority.trim() ? { priority: Number(ratePriority) } : {}),
        ...(rateAmount.trim() ? { amount: Number(rateAmount) } : {}),
        ...(rateType === 'formula' && rateFormula.trim() ? { formula: rateFormula.trim() } : {}),
        ...(rateType === 'table_rate' && parsedTable !== undefined ? { table: parsedTable } : {}),
      }

      await authorizedRequest<void>(endpoints.shipping.ratesByMethod(selectedMethodId), { method: 'POST', body })
      toast.success('Rate created')
      setRateName('')
      setRateAmount('')
      setRateFormula('')
      setRateTableJson('')
      await loadRates()
    } catch (e: any) {
      toast.error('Failed to create rate', { description: e?.message || 'Please try again.' })
    } finally {
      setIsCreatingRate(false)
    }
  }, [authorizedRequest, canCreateRate, loadRates, rateAmount, rateCurrency, rateFormula, rateName, ratePriority, rateTableJson, rateType, selectedMethodId])

  const handleSaveRate = useCallback(async () => {
    if (!editingRateId || !rateDraft) return

    let parsedTable: any = undefined
    if (rateDraft.calculationType === 'table_rate' && rateDraft.tableJson.trim()) {
      try {
        parsedTable = JSON.parse(rateDraft.tableJson)
      } catch {
        toast.error('Invalid table JSON', { description: 'Please provide valid JSON for table rates.' })
        return
      }
    }

    setIsSavingRate(true)
    try {
      await patchRate(editingRateId, {
        ...(rateDraft.name.trim() ? { name: rateDraft.name.trim() } : {}),
        calculationType: rateDraft.calculationType,
        currency: rateDraft.currency,
        ...(rateDraft.priority.trim() ? { priority: Number(rateDraft.priority) } : {}),
        isActive: rateDraft.isActive,
        ...(rateDraft.amount.trim() ? { amount: Number(rateDraft.amount) } : {}),
        ...(rateDraft.calculationType === 'formula' && rateDraft.formula.trim() ? { formula: rateDraft.formula.trim() } : {}),
        ...(rateDraft.calculationType === 'table_rate' && parsedTable !== undefined ? { table: parsedTable } : {}),
      })
      toast.success('Rate updated')
      cancelEditRate()
      await loadRates()
    } catch (e: any) {
      toast.error('Failed to update rate', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSavingRate(false)
    }
  }, [cancelEditRate, editingRateId, loadRates, patchRate, rateDraft])

  const handleConfirmDeleteRate = useCallback(async () => {
    if (!deleteRateId) return
    setIsDeletingRate(true)
    try {
      await removeRate(deleteRateId)
      toast.success('Rate deleted')
      setDeleteRateId(null)
      if (editingRateId === deleteRateId) cancelEditRate()
      await loadRates()
    } catch (e: any) {
      toast.error('Failed to delete rate', { description: e?.message || 'Please try again.' })
    } finally {
      setIsDeletingRate(false)
    }
  }, [cancelEditRate, deleteRateId, editingRateId, loadRates, removeRate])

  const [previewLocationId, setPreviewLocationId] = useState('')
  const [previewSubtotal, setPreviewSubtotal] = useState('')
  const [previewTotalWeight, setPreviewTotalWeight] = useState('')
  const [previewItemCount, setPreviewItemCount] = useState('')
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewQuotes, setPreviewQuotes] = useState<QuoteOption[]>([])

  const canPreview = previewLocationId.trim().length > 0

  const handlePreview = useCallback(async () => {
    if (!canPreview) return
    setIsPreviewing(true)
    try {
      const body = {
        locationId: previewLocationId.trim(),
        ...(zoneId ? { zoneId } : {}),
        ...(previewSubtotal.trim() ? { subtotal: Number(previewSubtotal) } : {}),
        ...(previewTotalWeight.trim() ? { totalWeight: Number(previewTotalWeight) } : {}),
        ...(previewItemCount.trim() ? { itemCount: Number(previewItemCount) } : {}),
        currency: 'KES',
      }

      const payload = await authorizedRequest<any>(endpoints.shipping.quotes, { method: 'POST', body })
      setPreviewQuotes(asArray<QuoteOption>(payload))

      if (asArray<QuoteOption>(payload).length === 0) {
        toast.message('No shipping options returned')
      }
    } catch (e: any) {
      toast.error('Failed to preview quotes', { description: e?.message || 'Please try again.' })
    } finally {
      setIsPreviewing(false)
    }
  }, [authorizedRequest, canPreview, previewItemCount, previewLocationId, previewSubtotal, previewTotalWeight, zoneId])

  const derivedMethodOptions = useMemo(() => {
    return methods.map((m) => ({ id: m.id, label: m.displayName || m.code || m.id }))
  }, [methods])

  const selectedMethodLabel = useMemo(() => {
    const m = methods.find((x) => x.id === selectedMethodId)
    return m?.displayName || m?.code || selectedMethodId
  }, [methods, selectedMethodId])

  if (!zoneId) {
    return (
      <AdminLayout title="Shipping" description="Zone not found.">
        <div className="text-sm text-muted-foreground">Missing zone id.</div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={zoneTitle} description="Zones → Destinations → Methods → Rates">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href="/axis/shipping">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={loadZone} disabled={isLoadingZone}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {zone?.code && <Badge variant="secondary">{zone.code}</Badge>}
            <Badge variant={zone?.isActive === false ? 'secondary' : 'default'}>{zone?.isActive === false ? 'Inactive' : 'Active'}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = t.id === activeTab
            return (
              <Button
                key={t.id}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => navigateTab(t.id)}
              >
                <Icon className="h-4 w-4 mr-2" />
                {t.label}
              </Button>
            )
          })}
        </div>

        {activeTab === 'destinations' && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Destinations</CardTitle>
              <CardDescription>Attach locations that this shipping zone applies to.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="locationId">Location</Label>
                  <Popover open={locationPickerOpen} onOpenChange={setLocationPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="locationId"
                        variant="outline"
                        role="combobox"
                        aria-expanded={locationPickerOpen}
                        className="w-full justify-between"
                      >
                        <span className={cn('truncate', !newLocationId ? 'text-muted-foreground' : undefined)}>
                          {newLocationId ? selectedLocationLabel : 'Search locations…'}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Type to search…"
                          value={locationSearch}
                          onValueChange={setLocationSearch}
                        />
                        <CommandList>
                          {locationSearchError ? (
                            <CommandEmpty>{locationSearchError}</CommandEmpty>
                          ) : locationSearch.trim().length === 0 ? (
                            <CommandEmpty>Type to search locations.</CommandEmpty>
                          ) : isSearchingLocations ? (
                            <CommandEmpty>Searching…</CommandEmpty>
                          ) : (
                            <CommandEmpty>No locations found.</CommandEmpty>
                          )}

                          {locationSearchResults.map((opt) => (
                            <CommandItem
                              key={opt.id}
                              value={`${opt.label} ${opt.id}`}
                              onSelect={() => {
                                setNewLocationId(opt.id)
                                setLocationPickerOpen(false)
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', newLocationId === opt.id ? 'opacity-100' : 'opacity-0')} />
                              <span className="truncate">{opt.label}</span>
                              <span className="ml-auto text-xs text-muted-foreground truncate">{opt.id}</span>
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddLocation} disabled={!canAddLocation || isAddingLocation} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              <Separator />

              {locations.length === 0 ? (
                <div className="text-sm text-muted-foreground">{isLoadingLocations ? 'Loading destinations…' : 'No destinations yet.'}</div>
              ) : (
                <div className="space-y-2">
                  {locations.map((l, index) => (
                    <div key={`${l.locationId}-${index}`} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {locationDetailsById[l.locationId]?.name || l.name || l.locationId}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {locationDetailsById[l.locationId]?.countryCode
                            ? `${locationDetailsById[l.locationId]?.countryCode}${locationDetailsById[l.locationId]?.code ? ` • ${locationDetailsById[l.locationId]?.code}` : ''}`
                            : locationDetailsById[l.locationId]?.code
                              ? String(locationDetailsById[l.locationId]?.code)
                              : l.locationId}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleRemoveLocation(l.locationId)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'methods' && (
          <>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Methods</CardTitle>
                <CardDescription>Create shipping methods for this zone (e.g. Standard, Express).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="methodCode">Code</Label>
                    <Input
                      id="methodCode"
                      value={newMethodCode}
                      onChange={(e) => setNewMethodCode(e.target.value)}
                      placeholder="e.g. EXPRESS"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="methodDisplayName">Display name</Label>
                    <Input
                      id="methodDisplayName"
                      value={newMethodDisplayName}
                      onChange={(e) => setNewMethodDisplayName(e.target.value)}
                      placeholder="e.g. Express"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="methodProvider">Provider (optional)</Label>
                    <Input
                      id="methodProvider"
                      value={newMethodProvider}
                      onChange={(e) => setNewMethodProvider(e.target.value)}
                      placeholder="e.g. internal"
                    />
                  </div>
                </div>
                <Button onClick={handleCreateMethod} disabled={!canCreateMethod || isCreatingMethod}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add method
                </Button>

                <Separator />

                {methods.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{isLoadingMethods ? 'Loading methods…' : 'No methods yet.'}</div>
                ) : (
                  <div className="space-y-2">
                    {methods.map((m) => {
                      const isEditing = editingMethodId === m.id
                      return (
                        <div
                          key={m.id}
                          className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium truncate">{m.displayName || m.id}</div>
                              <Badge variant={m.isActive === false ? 'secondary' : 'default'} className="shrink-0">
                                {m.isActive === false ? 'Inactive' : 'Active'}
                              </Badge>
                              {m.code ? (
                                <Badge variant="secondary" className="shrink-0">
                                  {m.code}
                                </Badge>
                              ) : null}
                              {isEditing ? <Badge variant="secondary">Editing</Badge> : null}
                            </div>
                            {m.provider ? <div className="text-xs text-muted-foreground truncate">Provider: {m.provider}</div> : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedMethodId(m.id)
                                navigateTab('rates')
                              }}
                            >
                              View rates
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => beginEditMethod(m)}
                              disabled={isSavingMethod || isDeletingMethod}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteMethodId(m.id)}
                              disabled={isSavingMethod || isDeletingMethod}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {editingMethodId && methodDraft ? (
                  <div className="rounded-md border p-4 space-y-4">
                    <div>
                      <div className="font-medium">Edit method</div>
                      <div className="text-xs text-muted-foreground">ID: {editingMethodId}</div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="methodEditCode">Code</Label>
                        <Input
                          id="methodEditCode"
                          value={methodDraft.code}
                          onChange={(e) => setMethodDraft((d) => (d ? { ...d, code: e.target.value } : d))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="methodEditDisplayName">Display name</Label>
                        <Input
                          id="methodEditDisplayName"
                          value={methodDraft.displayName}
                          onChange={(e) => setMethodDraft((d) => (d ? { ...d, displayName: e.target.value } : d))}
                          placeholder="e.g. Express"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="methodEditProvider">Provider (optional)</Label>
                        <Input
                          id="methodEditProvider"
                          value={methodDraft.provider}
                          onChange={(e) => setMethodDraft((d) => (d ? { ...d, provider: e.target.value } : d))}
                          placeholder="e.g. internal"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="grid gap-0.5">
                        <div className="text-sm font-medium">Active</div>
                        <div className="text-xs text-muted-foreground">Disable to hide this method in quotes.</div>
                      </div>
                      <Switch
                        checked={methodDraft.isActive}
                        onCheckedChange={(checked) => setMethodDraft((d) => (d ? { ...d, isActive: checked } : d))}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={cancelEditMethod} disabled={isSavingMethod}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button onClick={handleSaveMethod} disabled={isSavingMethod}>
                        <Save className="h-4 w-4 mr-2" />
                        Save changes
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <ConfirmDialog
              open={!!deleteMethodId}
              onOpenChange={(open) => {
                if (!open) setDeleteMethodId(null)
              }}
              title="Delete shipping method?"
              description="This will remove the method. If your backend also deletes associated rates, you may lose rate configuration too."
              confirmText={isDeletingMethod ? 'Deleting…' : 'Delete'}
              cancelText="Cancel"
              variant="destructive"
              onConfirm={() => {
                if (isDeletingMethod) return
                handleConfirmDeleteMethod()
              }}
            />
          </>
        )}

        {activeTab === 'rates' && (
          <>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Rates</CardTitle>
                <CardDescription>Define how a method calculates shipping cost.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingMethods ? 'Loading…' : 'Select a method'} />
                    </SelectTrigger>
                    <SelectContent>
                      {derivedMethodOptions.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Selected</Label>
                  <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">{selectedMethodLabel || '—'}</div>
                </div>
              </div>

              <Separator />

              {rates.length === 0 ? (
                <div className="text-sm text-muted-foreground">{isLoadingRates ? 'Loading rates…' : 'No rates yet for this method.'}</div>
              ) : (
                <div className="space-y-2">
                  {rates
                    .slice()
                    .sort((a, b) => {
                      const ap = typeof a.priority === 'number' ? a.priority : Number.POSITIVE_INFINITY
                      const bp = typeof b.priority === 'number' ? b.priority : Number.POSITIVE_INFINITY
                      if (ap !== bp) return ap - bp
                      return String(a.name || a.id).localeCompare(String(b.name || b.id))
                    })
                    .map((r) => {
                      const isEditing = editingRateId === r.id
                      return (
                        <div
                          key={r.id}
                          className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium truncate">{r.name || r.id}</div>
                              <Badge variant={r.isActive === false ? 'secondary' : 'default'} className="shrink-0">
                                {r.isActive === false ? 'Inactive' : 'Active'}
                              </Badge>
                              {typeof r.priority === 'number' && <Badge variant="secondary">P{r.priority}</Badge>}
                              {isEditing ? <Badge variant="secondary">Editing</Badge> : null}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {r.calculationType || 'rate'}
                              {typeof r.amount === 'number' ? ` • ${r.currency || 'KES'} ${r.amount}` : ''}
                              {r.formula ? ` • ${r.formula}` : ''}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => beginEditRate(r)}
                              disabled={isSavingRate || isDeletingRate}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteRateId(r.id)}
                              disabled={isSavingRate || isDeletingRate}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}

              {editingRateId && rateDraft ? (
                <div className="rounded-md border p-4 space-y-4">
                  <div>
                    <div className="font-medium">Edit rate</div>
                    <div className="text-xs text-muted-foreground">ID: {editingRateId}</div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="rateEditName">Name</Label>
                      <Input
                        id="rateEditName"
                        value={rateDraft.name}
                        onChange={(e) => setRateDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rateEditCurrency">Currency</Label>
                      <Input
                        id="rateEditCurrency"
                        value={rateDraft.currency}
                        onChange={(e) => setRateDraft((d) => (d ? { ...d, currency: e.target.value } : d))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rateEditType">Calculation type</Label>
                      <Select
                        value={rateDraft.calculationType}
                        onValueChange={(v) => setRateDraft((d) => (d ? { ...d, calculationType: v } : d))}
                      >
                        <SelectTrigger id="rateEditType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat</SelectItem>
                          <SelectItem value="per_weight">Per weight</SelectItem>
                          <SelectItem value="per_item">Per item</SelectItem>
                          <SelectItem value="table_rate">Table rate</SelectItem>
                          <SelectItem value="formula">Formula</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rateEditPriority">Priority</Label>
                      <Input
                        id="rateEditPriority"
                        type="number"
                        value={rateDraft.priority}
                        onChange={(e) => setRateDraft((d) => (d ? { ...d, priority: e.target.value } : d))}
                      />
                    </div>

                    {(rateDraft.calculationType === 'flat' || rateDraft.calculationType === 'per_weight' || rateDraft.calculationType === 'per_item') && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="rateEditAmount">Amount</Label>
                        <Input
                          id="rateEditAmount"
                          type="number"
                          value={rateDraft.amount}
                          onChange={(e) => setRateDraft((d) => (d ? { ...d, amount: e.target.value } : d))}
                        />
                      </div>
                    )}

                    {rateDraft.calculationType === 'formula' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="rateEditFormula">Formula</Label>
                        <Textarea
                          id="rateEditFormula"
                          value={rateDraft.formula}
                          onChange={(e) => setRateDraft((d) => (d ? { ...d, formula: e.target.value } : d))}
                          placeholder="e.g. subtotal * 0.05 + 200"
                        />
                      </div>
                    )}

                    {rateDraft.calculationType === 'table_rate' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="rateEditTable">Table JSON</Label>
                        <Textarea
                          id="rateEditTable"
                          value={rateDraft.tableJson}
                          onChange={(e) => setRateDraft((d) => (d ? { ...d, tableJson: e.target.value } : d))}
                          placeholder='e.g. [{"min":0,"max":5,"amount":300}]'
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="grid gap-0.5">
                      <div className="text-sm font-medium">Active</div>
                      <div className="text-xs text-muted-foreground">Disable to hide this rate in quotes.</div>
                    </div>
                    <Switch
                      checked={rateDraft.isActive}
                      onCheckedChange={(checked) => setRateDraft((d) => (d ? { ...d, isActive: checked } : d))}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={cancelEditRate} disabled={isSavingRate}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleSaveRate} disabled={isSavingRate}>
                      <Save className="h-4 w-4 mr-2" />
                      Save changes
                    </Button>
                  </div>
                </div>
              ) : null}

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  <div className="font-medium">Add rate</div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rateName">Rate name (optional)</Label>
                    <Input id="rateName" value={rateName} onChange={(e) => setRateName(e.target.value)} placeholder="e.g. Default" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rateType">Calculation type</Label>
                    <Select value={rateType} onValueChange={setRateType}>
                      <SelectTrigger id="rateType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat</SelectItem>
                        <SelectItem value="per_weight">Per weight</SelectItem>
                        <SelectItem value="per_item">Per item</SelectItem>
                        <SelectItem value="table_rate">Table rate</SelectItem>
                        <SelectItem value="formula">Formula</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rateCurrency">Currency</Label>
                    <Input id="rateCurrency" value={rateCurrency} onChange={(e) => setRateCurrency(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ratePriority">Priority (lower = higher priority)</Label>
                    <Input id="ratePriority" type="number" value={ratePriority} onChange={(e) => setRatePriority(e.target.value)} />
                  </div>

                  {(rateType === 'flat' || rateType === 'per_weight' || rateType === 'per_item') && (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="rateAmount">Amount</Label>
                      <Input id="rateAmount" type="number" value={rateAmount} onChange={(e) => setRateAmount(e.target.value)} placeholder="e.g. 500" />
                    </div>
                  )}

                  {rateType === 'formula' && (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="rateFormula">Formula</Label>
                      <Input
                        id="rateFormula"
                        value={rateFormula}
                        onChange={(e) => setRateFormula(e.target.value)}
                        placeholder="e.g. subtotal * 0.05 + 200"
                      />
                    </div>
                  )}

                  {rateType === 'table_rate' && (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="rateTable">Table JSON</Label>
                      <Textarea
                        id="rateTable"
                        value={rateTableJson}
                        onChange={(e) => setRateTableJson(e.target.value)}
                        placeholder='e.g. [{"min":0,"max":5,"amount":300}]'
                      />
                    </div>
                  )}
                </div>

                <Button onClick={handleCreateRate} disabled={!canCreateRate || isCreatingRate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add rate
                </Button>
              </div>
              </CardContent>
            </Card>

            <ConfirmDialog
              open={!!deleteRateId}
              onOpenChange={(open) => {
                if (!open) setDeleteRateId(null)
              }}
              title="Delete shipping rate?"
              description="This will remove the rate from the selected method."
              confirmText={isDeletingRate ? 'Deleting…' : 'Delete'}
              cancelText="Cancel"
              variant="destructive"
              onConfirm={() => {
                if (isDeletingRate) return
                handleConfirmDeleteRate()
              }}
            />
          </>
        )}

        {activeTab === 'preview' && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Preview Quotes</CardTitle>
              <CardDescription>Call the live quotes endpoint using sample inputs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="previewLocation">Location ID</Label>
                  <Input id="previewLocation" value={previewLocationId} onChange={(e) => setPreviewLocationId(e.target.value)} placeholder="e.g. KE-NRB-WST" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="previewSubtotal">Subtotal (optional)</Label>
                  <Input id="previewSubtotal" type="number" value={previewSubtotal} onChange={(e) => setPreviewSubtotal(e.target.value)} placeholder="e.g. 10000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="previewWeight">Total weight (optional)</Label>
                  <Input id="previewWeight" type="number" value={previewTotalWeight} onChange={(e) => setPreviewTotalWeight(e.target.value)} placeholder="e.g. 2.5" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="previewCount">Item count (optional)</Label>
                  <Input id="previewCount" type="number" value={previewItemCount} onChange={(e) => setPreviewItemCount(e.target.value)} placeholder="e.g. 3" />
                </div>
              </div>

              <Button onClick={handlePreview} disabled={!canPreview || isPreviewing}>
                <Eye className="h-4 w-4 mr-2" />
                Preview quotes
              </Button>

              <Separator />

              {previewQuotes.length === 0 ? (
                <div className="text-sm text-muted-foreground">{isPreviewing ? 'Fetching quotes…' : 'No quotes yet.'}</div>
              ) : (
                <div className="space-y-2">
                  {previewQuotes.map((q, index) => {
                    const key = toQuoteKey(q, index)
                    const label = q.name || q.label || q.methodId || q.id || `Option ${index + 1}`
                    const amount = typeof q.amount === 'number' ? q.amount : typeof q.price === 'number' ? q.price : null
                    return (
                      <div key={key} className={cn('flex items-start justify-between gap-3 rounded-md border p-3')}> 
                        <div className="min-w-0">
                          <div className="font-medium truncate">{label}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {q.description || q.estimatedDays || q.eta || '—'}
                          </div>
                        </div>
                        <div className="text-sm font-semibold">{amount === null ? '—' : `${q.currency || 'KES'} ${amount}`}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
