import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { ChevronRight, CornerDownRight, MapPin, Plus, Search, Settings2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { usePriceLists } from '@/hooks/use-pricing'
import { useCurrencies } from '@/hooks/use-currencies'
import { endpoints } from '@/lib/endpoints'

type LocationType = 'Country' | 'County' | 'Sub-county' | 'Ward' | 'Town'

type LocationNode = {
  id: string
  name: string
  type: LocationType
  code?: string
  children: LocationNode[]
}

type CountryOption = {
  code: string
  name: string
}

const DEFAULT_LOCATION_LEVELS: GoogleMappingCandidateForm[] = [
  { locationType: 'country', googleComponentTypes: '' },
  { locationType: 'county', googleComponentTypes: '' },
  { locationType: 'subcounty', googleComponentTypes: '' },
  { locationType: 'ward', googleComponentTypes: 'administrative_area_level_3,sublocality_level_1,sublocality' },
  { locationType: 'town', googleComponentTypes: 'locality,postal_town,neighborhood' },
]

const DEFAULT_LOCATION_CHAIN = DEFAULT_LOCATION_LEVELS.map((l) => l.locationType).join(',')

const prettyJson = (value: unknown) => JSON.stringify(value, null, 2)

function safeJsonParse(input: string, label: string) {
  try {
    return { ok: true as const, value: JSON.parse(input) }
  } catch (e: any) {
    return { ok: false as const, error: `${label} must be valid JSON` }
  }
}

function parseCsvList(value: string) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

type GoogleMappingCandidateForm = {
  locationType: string
  googleComponentTypes: string
}

function normalizeGoogleComponentTypes(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean)
  if (typeof raw === 'string') return parseCsvList(raw)
  return []
}

function inferLocationLevelsFromConfigs(schema: any, config: any): GoogleMappingCandidateForm[] {
  // Handle both old format (string[]) and new format ({ type, display }[])
  const chainRaw: any[] = Array.isArray(schema?.locationChain)
    ? schema.locationChain
    : []
  
  const chain: string[] = chainRaw.map((item) => {
    if (typeof item === 'string') return item.trim()
    if (item && typeof item === 'object' && 'type' in item) return String(item.type || '').trim()
    return ''
  }).filter(Boolean)

  const candidatesRaw: any[] = Array.isArray(config?.googleLocationMapping?.candidates)
    ? config.googleLocationMapping.candidates
    : []

  const candidateMap = new Map<string, string>()
  for (const c of candidatesRaw) {
    const loc = String(c?.locationType ?? '').trim().toLowerCase()
    if (!loc) continue
    const types = normalizeGoogleComponentTypes(c?.googleComponentTypes)
    if (types.length === 0) continue
    candidateMap.set(loc, types.join(','))
  }

  const rows: GoogleMappingCandidateForm[] = []
  const seen = new Set<string>()

  const ordered = chain.length ? chain : Array.from(candidateMap.keys())
  for (const locRaw of ordered) {
    const loc = String(locRaw).trim().toLowerCase()
    if (!loc || seen.has(loc)) continue
    seen.add(loc)
    rows.push({ locationType: loc, googleComponentTypes: candidateMap.get(loc) ?? '' })
  }

  for (const [loc, googleComponentTypes] of candidateMap.entries()) {
    if (seen.has(loc)) continue
    seen.add(loc)
    rows.push({ locationType: loc, googleComponentTypes })
  }

  return rows
}

function MultiSelectAdd(props: {
  label: string
  placeholder?: string
  helperText?: string
  disabled?: boolean
  options: Array<{ value: string; label: string; disabled?: boolean }>
  values: string[]
  onChange: (next: string[]) => void
}) {
  const [nextValue, setNextValue] = useState('')

  const add = (value: string) => {
    const v = value.trim()
    if (!v) return
    if (props.values.includes(v)) return
    props.onChange([...props.values, v])
  }

  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Select
        value={nextValue}
        onValueChange={(v) => {
          setNextValue('')
          add(v)
        }}
        disabled={props.disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={props.placeholder || 'Select'} />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={Boolean(o.disabled)}>
              <span className="whitespace-pre">{o.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {props.values.length ? (
        <div className="flex flex-wrap gap-2">
          {props.values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button
                type="button"
                className="ml-1 rounded-sm hover:bg-muted"
                onClick={() => props.onChange(props.values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                disabled={props.disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : props.helperText ? (
        <div className="text-xs text-muted-foreground">{props.helperText}</div>
      ) : null}
    </div>
  )
}

function extractSchemaFromFieldConfig(payload: any) {
  const u = unwrap(payload)
  if (!u || typeof u !== 'object') return null
  const schema = (u as any).schema ?? (u as any).data?.schema
  if (schema && typeof schema === 'object') return schema
  // Some APIs may return the schema directly.
  return u
}

function extractConfigFromCountryConfig(payload: any) {
  const u = unwrap(payload)
  if (!u || typeof u !== 'object') return null
  const cfg = (u as any).config ?? (u as any).data?.config
  if (cfg && typeof cfg === 'object') return cfg
  // Some APIs may return the config directly.
  return u
}

function buildGoogleCandidates(candidates: GoogleMappingCandidateForm[]) {
  return candidates
    .map((c) => {
      const locationType = c.locationType.trim().toLowerCase()
      const googleComponentTypes = parseCsvList(c.googleComponentTypes)
      if (!locationType) return null
      if (googleComponentTypes.length === 0) return null
      return {
        locationType,
        googleComponentTypes,
      }
    })
    .filter(Boolean) as Array<{ locationType: string; googleComponentTypes: string[] }>
}

const CHILD_TYPES: Record<LocationType, LocationType[]> = {
  Country: ['County'],
  County: ['Sub-county'],
  'Sub-county': ['Ward'],
  Ward: ['Town'],
  Town: [],
}

function cloneTree(root: LocationNode): LocationNode {
  return {
    ...root,
    children: root.children.map(cloneTree),
  }
}

function unwrap(payload: any) {
  if (!payload || typeof payload !== 'object') return payload
  if ('data' in payload) return (payload as any).data ?? payload
  return payload
}

function asArray(payload: any): any[] {
  const u = unwrap(payload)
  if (Array.isArray(u)) return u
  if (Array.isArray(u?.items)) return u.items
  if (Array.isArray(u?.results)) return u.results
  if (Array.isArray(u?.data)) return u.data
  if (Array.isArray(u?.data?.items)) return u.data.items
  return []
}

function normalizeLocationType(raw: any): LocationType {
  const text = String(raw ?? '').trim()
  if (!text) return 'Town'
  const key = text
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z-]/g, '')

  if (key === 'country') return 'Country'
  if (key === 'county') return 'County'
  if (key === 'sub-county' || key === 'subcounty') return 'Sub-county'
  if (key === 'ward') return 'Ward'
  if (key === 'town' || key === 'city') return 'Town'
  return 'Town'
}

function typeToApi(type: LocationType): string {
  switch (type) {
    case 'Country':
      return 'country'
    case 'County':
      return 'county'
    case 'Sub-county':
      return 'sub_county'
    case 'Ward':
      return 'ward'
    case 'Town':
      return 'town'
  }
}

function typeCandidates(type: LocationType): string[] {
  // Backend expects lowercase; format varies across implementations.
  switch (type) {
    case 'Country':
      return ['country']
    case 'County':
      return ['county']
    case 'Sub-county':
      return ['sub_county', 'sub-county', 'subcounty']
    case 'Ward':
      return ['ward']
    case 'Town':
      return ['town', 'city']
  }
}

function getChildren(raw: any): any[] {
  if (!raw || typeof raw !== 'object') return []
  if (Array.isArray(raw.children)) return raw.children
  if (Array.isArray(raw.childLocations)) return raw.childLocations
  if (Array.isArray(raw.subLocations)) return raw.subLocations
  if (Array.isArray(raw.nodes)) return raw.nodes
  if (Array.isArray(raw.items)) return raw.items
  return []
}

function normalizeNode(raw: any, fallbackCountryCode?: string): LocationNode | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id ?? raw._id ?? raw.locationId ?? raw.code ?? '').trim()
  const code = String(raw.code ?? raw.countryCode ?? raw.key ?? '').trim() || undefined
  const name = String(raw.name ?? raw.label ?? raw.displayName ?? code ?? id).trim()
  if (!id && !code) return null
  const children = getChildren(raw)
    .map((c) => normalizeNode(c, fallbackCountryCode))
    .filter(Boolean) as LocationNode[]

  const type = normalizeLocationType(raw.type ?? raw.locationType)
  return {
    id: id || (code as string),
    name: name || (code as string),
    type,
    code,
    children,
  }
}

function findPath(root: LocationNode, targetId: string): LocationNode[] | null {
  if (root.id === targetId) return [root]
  for (const child of root.children) {
    const childPath = findPath(child, targetId)
    if (childPath) return [root, ...childPath]
  }
  return null
}

function addChild(root: LocationNode, parentId: string, child: LocationNode): LocationNode {
  if (root.id === parentId) {
    return { ...root, children: [...root.children, child] }
  }
  return { ...root, children: root.children.map((c) => addChild(c, parentId, child)) }
}

function removeNode(root: LocationNode, targetId: string): { next: LocationNode; removed: boolean } {
  if (root.id === targetId) {
    // Disallow removing the root node from within a tree.
    return { next: root, removed: false }
  }

  let removed = false
  const nextChildren = root.children
    .filter((child) => {
      if (child.id === targetId) {
        removed = true
        return false
      }
      return true
    })
    .map((child) => {
      const result = removeNode(child, targetId)
      if (result.removed) removed = true
      return result.next
    })

  return { next: { ...root, children: nextChildren }, removed }
}

function collectSearchState(root: LocationNode, term: string) {
  const matches = new Set<string>()
  const visible = new Set<string>()
  const autoExpanded = new Set<string>()

  const normalized = term.trim().toLowerCase()
  if (!normalized) return { matches, visible: null as Set<string> | null, autoExpanded }

  const walk = (node: LocationNode, stack: LocationNode[]) => {
    const nextStack = [...stack, node]
    const isMatch = node.name.toLowerCase().includes(normalized)

    if (isMatch) {
      matches.add(node.id)
      for (const ancestor of nextStack) visible.add(ancestor.id)
      for (const ancestor of nextStack.slice(0, -1)) autoExpanded.add(ancestor.id)
    }

    for (const child of node.children) walk(child, nextStack)
  }

  walk(root, [])
  return { matches, visible, autoExpanded }
}

export function AdminSettingsLocationsPage() {
  const { authorizedRequest, accessToken } = useAdminAuth()
  const { priceLists, isLoading: isLoadingPriceLists } = usePriceLists({ token: accessToken })
  const { currencies, isLoading: isLoadingCurrencies } = useCurrencies({ token: accessToken })

  const [countries, setCountries] = useState<CountryOption[]>([])
  const [isLoadingCountries, setIsLoadingCountries] = useState(false)

  const [countryCode, setCountryCode] = useState<string>('')
  const [treeByCountry, setTreeByCountry] = useState<Record<string, LocationNode>>({})
  const [isLoadingTree, setIsLoadingTree] = useState(false)

  const root = useMemo<LocationNode>(() => {
    const existing = countryCode ? treeByCountry[countryCode] : undefined
    if (existing) return existing
    return {
      id: countryCode || 'COUNTRY',
      name: countryCode || 'Country',
      code: countryCode || undefined,
      type: 'Country',
      children: [],
    }
  }, [countryCode, treeByCountry])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  const [search, setSearch] = useState('')

  const { matches, visible, autoExpanded } = useMemo(() => collectSearchState(root, search), [root, search])
  const effectiveExpanded = useMemo(() => {
    if (!search.trim()) return expandedIds
    return new Set<string>([...expandedIds, ...autoExpanded])
  }, [autoExpanded, expandedIds, search])

  const selectedPath = useMemo(() => {
    if (!selectedId) return null
    return findPath(root, selectedId)
  }, [root, selectedId])

  const selectedNode = selectedPath ? selectedPath[selectedPath.length - 1] : null
  const parentNode = selectedPath && selectedPath.length > 1 ? selectedPath[selectedPath.length - 2] : null
  const isRootSelected = Boolean(selectedNode && selectedNode.id === root.id)

  const loadCountries = useCallback(async () => {
    setIsLoadingCountries(true)
    try {
      // Prefer API-driven countries (type=COUNTRY) if supported.
      const payload = await authorizedRequest<any>(endpoints.locations.list({ type: 'country' }), { method: 'GET' })
      const list = asArray(payload)
      const options: CountryOption[] = list
        .map((raw) => {
          const code = String(raw?.code ?? raw?.countryCode ?? '').trim().toUpperCase()
          const name = String(raw?.name ?? raw?.label ?? raw?.displayName ?? code).trim()
          return code ? { code, name: name || code } : null
        })
        .filter(Boolean) as CountryOption[]

      options.sort((a, b) => a.name.localeCompare(b.name))
      setCountries(options)
      if (!countryCode && options.length) {
        setCountryCode(options[0].code)
      }
    } catch (e: any) {
      setCountries([])
      toast.error('Failed to load countries', { description: e?.message || 'Please try again.' })
    } finally {
      setIsLoadingCountries(false)
    }
  }, [authorizedRequest, countryCode])

  const loadTree = useCallback(
    async (code: string) => {
      const cc = code.trim().toUpperCase()
      if (!cc) return
      setIsLoadingTree(true)
      try {
        const payload = await authorizedRequest<any>(endpoints.locations.tree(cc), { method: 'GET' })
        const u = unwrap(payload)

        let nextRoot: LocationNode | null = null
        if (Array.isArray(u)) {
          const kids = u.map((x) => normalizeNode(x, cc)).filter(Boolean) as LocationNode[]
          nextRoot = { id: cc, name: cc, code: cc, type: 'Country', children: kids }
        } else if (u && typeof u === 'object') {
          const rootRaw = (u as any).root ?? (u as any).tree ?? (u as any).country ?? u
          nextRoot = normalizeNode(rootRaw, cc)

          // Some APIs return just children for the country (not a root node).
          if (nextRoot && nextRoot.type !== 'Country') {
            const children = getChildren(rootRaw)
              .map((x) => normalizeNode(x, cc))
              .filter(Boolean) as LocationNode[]
            nextRoot = { id: cc, name: cc, code: cc, type: 'Country', children }
          }
        }

        if (!nextRoot) {
          nextRoot = { id: cc, name: cc, code: cc, type: 'Country', children: [] }
        }

        setTreeByCountry((prev) => ({ ...prev, [cc]: cloneTree(nextRoot!) }))
        setExpandedIds(new Set([nextRoot.id]))
      } catch (e: any) {
        toast.error('Failed to load location tree', { description: e?.message || 'Please try again.' })
        setTreeByCountry((prev) => ({ ...prev, [cc]: { id: cc, name: cc, code: cc, type: 'Country', children: [] } }))
        setExpandedIds(new Set([cc]))
      } finally {
        setIsLoadingTree(false)
      }
    },
    [authorizedRequest]
  )

  useEffect(() => {
    loadCountries()
  }, [loadCountries])

  useEffect(() => {
    if (!countryCode) return
    if (treeByCountry[countryCode]) return
    loadTree(countryCode)
  }, [countryCode, loadTree, treeByCountry])

  const onSelectCountry = useCallback((value: string) => {
    const next = value.trim().toUpperCase()
    setCountryCode(next)
    setSearch('')
    setSelectedId(null)
    setExpandedIds(new Set())
  }, [])

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectNode = useCallback(
    (node: LocationNode) => {
      setSelectedId(node.id)
      if (node.children.length > 0) {
        setExpandedIds((prev) => new Set(prev).add(node.id))
      }
    },
    []
  )

  const [isAddChildOpen, setIsAddChildOpen] = useState(false)
  const [newChildName, setNewChildName] = useState('')
  const [newChildCode, setNewChildCode] = useState('')
  const [newChildType, setNewChildType] = useState<LocationType | ''>('')

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingDeleteSelected, setPendingDeleteSelected] = useState(false)

  const allowedChildTypes = useMemo(() => {
    if (!selectedNode) return [] as LocationType[]
    return CHILD_TYPES[selectedNode.type]
  }, [selectedNode])

  const effectiveNewChildType = useMemo(() => {
    if (newChildType) return newChildType
    return allowedChildTypes[0] ?? ''
  }, [allowedChildTypes, newChildType])

  const canCreateChild = Boolean(selectedNode) && allowedChildTypes.length > 0

  useEffect(() => {
    setIsAddChildOpen(false)
    setNewChildName('')
    setNewChildCode('')
    setNewChildType('')
    setPendingDeleteId(null)
    setPendingDeleteSelected(false)
  }, [selectedId])

  const onCreateChild = useCallback(async () => {
    if (!selectedNode) return
    if (!canCreateChild) return
    const name = newChildName.trim()
    if (!name) return

    const nextType = effectiveNewChildType
    if (!nextType) return

    try {
      const baseBody: any = {
        name,
        parentId: selectedNode.id,
        countryCode: countryCode || root.code,
      }
      if (newChildCode.trim()) baseBody.code = newChildCode.trim()

      let created: any = null
      let lastErr: any = null
      for (const t of typeCandidates(nextType)) {
        try {
          created = await authorizedRequest<any>(endpoints.locations.base, { method: 'POST', body: { ...baseBody, type: t } })
          break
        } catch (err: any) {
          lastErr = err
        }
      }

      if (!created) throw lastErr

      const createdId = String(unwrap(created)?.id ?? unwrap(created)?._id ?? '')

      await loadTree(countryCode)
      setExpandedIds((prev) => new Set(prev).add(selectedNode.id))
      setSelectedId(createdId || selectedNode.id)
      setIsAddChildOpen(false)
      setNewChildName('')
      setNewChildCode('')
      setNewChildType('')
      toast.success('Location created')
    } catch (e: any) {
      toast.error('Failed to create location', { description: e?.message || 'Please try again.' })
    }
  }, [authorizedRequest, canCreateChild, countryCode, effectiveNewChildType, loadTree, newChildCode, newChildName, root.code, selectedNode])

  const onDeleteNode = useCallback(
    async (targetId: string, fallbackSelectedId?: string | null) => {
      if (!targetId) return
      try {
        await authorizedRequest(endpoints.locations.byId(targetId), { method: 'DELETE' })
        await loadTree(countryCode)
        setSelectedId((current) => {
          if (current !== targetId) return current
          return fallbackSelectedId ?? null
        })
        toast.success('Location deleted')
      } catch (e: any) {
        toast.error('Failed to delete location', { description: e?.message || 'Please try again.' })
      } finally {
        setPendingDeleteId(null)
        setPendingDeleteSelected(false)
      }
    },
    [authorizedRequest, countryCode, loadTree]
  )

  const [isCreateCountryOpen, setIsCreateCountryOpen] = useState(false)
  const [newCountryName, setNewCountryName] = useState('')
  const [newCountryCode, setNewCountryCode] = useState('')
  const [newCountryCurrencies, setNewCountryCurrencies] = useState<string[]>([])

  const [newCountryAddressFields, setNewCountryAddressFields] = useState<string[]>([])
  const [newCountryLocationLevels, setNewCountryLocationLevels] = useState<GoogleMappingCandidateForm[]>([])

  const [includeDefaultPriceListId, setIncludeDefaultPriceListId] = useState(false)
  const [defaultPriceListId, setDefaultPriceListId] = useState('')

  const [addressSchemaTouched, setAddressSchemaTouched] = useState(false)
  const [countryConfigTouched, setCountryConfigTouched] = useState(false)

  const [newCountryAddressSchemaJson, setNewCountryAddressSchemaJson] = useState(() =>
    prettyJson({ version: 1, locationChain: parseCsvList(DEFAULT_LOCATION_CHAIN), fields: [] })
  )
  const [newCountryConfigJson, setNewCountryConfigJson] = useState(() =>
    prettyJson({ version: 1 })
  )

  const [isEditCountryOpen, setIsEditCountryOpen] = useState(true)
  const [editCountryCode, setEditCountryCode] = useState('')
  const [editCountryLoadedCode, setEditCountryLoadedCode] = useState<string | null>(null)
  const [isLoadingEditCountryConfig, setIsLoadingEditCountryConfig] = useState(false)

  const [editCountryCurrencies, setEditCountryCurrencies] = useState<string[]>([])
  const [editCountryAddressFields, setEditCountryAddressFields] = useState<string[]>([])
  const [editCountryLocationLevels, setEditCountryLocationLevels] = useState<GoogleMappingCandidateForm[]>([])

  const [editIncludeDefaultPriceListId, setEditIncludeDefaultPriceListId] = useState(false)
  const [editDefaultPriceListId, setEditDefaultPriceListId] = useState('')

  const [editAddressSchemaTouched, setEditAddressSchemaTouched] = useState(false)
  const [editCountryConfigTouched, setEditCountryConfigTouched] = useState(false)

  const [editCountryAddressSchemaJson, setEditCountryAddressSchemaJson] = useState(() =>
    prettyJson({ version: 1, locationChain: parseCsvList(DEFAULT_LOCATION_CHAIN), fields: [] })
  )
  const [editCountryConfigJson, setEditCountryConfigJson] = useState(() =>
    prettyJson({ version: 1 })
  )

  const loadEditCountryConfig = useCallback(
    async (code: string) => {
      const cc = code.trim().toUpperCase()
      if (!cc) return
      setIsLoadingEditCountryConfig(true)
      try {
        const [schemaPayload, configPayload] = await Promise.all([
          authorizedRequest<any>(endpoints.addresses.fieldConfig({ countryCode: cc }), { method: 'GET' }),
          authorizedRequest<any>(endpoints.countries.config({ countryCode: cc }), { method: 'GET' }),
        ])

        const schema = extractSchemaFromFieldConfig(schemaPayload) ?? { version: 1, locationChain: [], fields: [] }
        const config =
          extractConfigFromCountryConfig(configPayload) ??
          ({ version: 1 } as any)

        const currencies = Array.isArray((config as any)?.currencies)
          ? (config as any).currencies.map((x: any) => String(x).trim().toUpperCase()).filter(Boolean)
          : []

        const fields = Array.isArray((schema as any)?.fields) ? (schema as any).fields : []
        const locationLevels = inferLocationLevelsFromConfigs(schema, config)

        const cfgDefaultPriceListId = String((config as any)?.defaultPriceListId ?? '').trim()

        setEditCountryCode(cc)
        setEditCountryCurrencies(currencies)
        setEditCountryAddressFields(fields.map((f: any) => prettyJson(f)))
        setEditCountryLocationLevels(locationLevels)

        setEditIncludeDefaultPriceListId(Boolean(cfgDefaultPriceListId))
        setEditDefaultPriceListId(cfgDefaultPriceListId)

        setEditAddressSchemaTouched(false)
        setEditCountryConfigTouched(false)
        setEditCountryAddressSchemaJson(prettyJson(schema))
        setEditCountryConfigJson(prettyJson(config))
        setEditCountryLoadedCode(cc)
      } catch (e: any) {
        toast.error('Failed to load country config', { description: e?.message || 'Please try again.' })
      } finally {
        setIsLoadingEditCountryConfig(false)
      }
    },
    [authorizedRequest]
  )

  const onSaveEditCountryConfig = useCallback(async () => {
    const code = editCountryCode.trim().toUpperCase()
    if (!code) return

    // Validate address fields (each item is JSON).
    const addressFields: any[] = []
    for (let i = 0; i < editCountryAddressFields.length; i++) {
      const parsed = safeJsonParse(editCountryAddressFields[i], `Address field #${i + 1}`)
      if (!parsed.ok) {
        toast.error('Cannot save country config', { description: parsed.error })
        return
      }
      addressFields.push(parsed.value)
    }

    const locationChain = editCountryLocationLevels
      .map((l) => l.locationType.trim().toLowerCase())
      .filter(Boolean)

    const currencies = editCountryCurrencies.map((s) => String(s).trim().toUpperCase()).filter(Boolean)

    const googleCandidates = buildGoogleCandidates(editCountryLocationLevels)

    const schemaParsed = safeJsonParse(editCountryAddressSchemaJson, 'Address schema')
    if (!schemaParsed.ok) {
      toast.error('Cannot save country config', { description: schemaParsed.error })
      return
    }
    const configParsed = safeJsonParse(editCountryConfigJson, 'Country config')
    if (!configParsed.ok) {
      toast.error('Cannot save country config', { description: configParsed.error })
      return
    }

    const schemaOverride = schemaParsed.value as any
    const configOverride = configParsed.value as any

    const effectiveSchema = {
      ...(typeof schemaOverride === 'object' && schemaOverride ? schemaOverride : {}),
      version: (schemaOverride as any)?.version ?? 1,
      locationChain: Array.isArray((schemaOverride as any)?.locationChain)
        ? (schemaOverride as any).locationChain
        : locationChain.length
          ? locationChain
          : parseCsvList(DEFAULT_LOCATION_CHAIN),
      fields: Array.isArray((schemaOverride as any)?.fields) ? (schemaOverride as any).fields : addressFields,
    }

    const effectiveConfig: any = {
      ...(typeof configOverride === 'object' && configOverride ? configOverride : {}),
    }
    if (effectiveConfig.version === undefined) effectiveConfig.version = (configOverride as any)?.version ?? 1

    const overrideHasCurrencies = Boolean(configOverride && typeof configOverride === 'object' && 'currencies' in (configOverride as any))
    if (!overrideHasCurrencies) {
      if (currencies.length) effectiveConfig.currencies = currencies
      else delete effectiveConfig.currencies
    }

    const overrideHasGoogle = Boolean(
      configOverride && typeof configOverride === 'object' && 'googleLocationMapping' in (configOverride as any)
    )
    if (!overrideHasGoogle) {
      if (googleCandidates.length) effectiveConfig.googleLocationMapping = { candidates: googleCandidates }
      else delete effectiveConfig.googleLocationMapping
    }

    if (editIncludeDefaultPriceListId && editDefaultPriceListId && (effectiveConfig as any).defaultPriceListId === undefined) {
      ;(effectiveConfig as any).defaultPriceListId = editDefaultPriceListId
    }

    try {
      await authorizedRequest<any>(endpoints.addresses.fieldConfig({ countryCode: code }), {
        method: 'PUT',
        body: { schema: effectiveSchema },
      })
      await authorizedRequest<any>(endpoints.countries.config({ countryCode: code }), {
        method: 'PUT',
        body: { config: effectiveConfig },
      })
      toast.success('Country updated')
      await loadEditCountryConfig(code)
    } catch (e: any) {
      toast.error('Failed to update country', { description: e?.message || 'Please try again.' })
    }
  }, [
    authorizedRequest,
    editCountryAddressFields,
    editCountryAddressSchemaJson,
    editCountryCode,
    editCountryConfigJson,
    editCountryCurrencies,
    editCountryLocationLevels,
    editDefaultPriceListId,
    editIncludeDefaultPriceListId,
    loadEditCountryConfig,
  ])

  useEffect(() => {
    if (addressSchemaTouched) return
    const locationChain = newCountryLocationLevels
      .map((l) => l.locationType.trim().toLowerCase())
      .filter(Boolean)
    const fields = newCountryAddressFields
      .map((raw) => {
        try {
          return JSON.parse(raw)
        } catch {
          return null
        }
      })
      .filter(Boolean)
    setNewCountryAddressSchemaJson(
      prettyJson({
        version: 1,
        locationChain: locationChain.length ? locationChain : parseCsvList(DEFAULT_LOCATION_CHAIN),
        fields,
      })
    )
  }, [addressSchemaTouched, newCountryAddressFields, newCountryLocationLevels])

  useEffect(() => {
    if (countryConfigTouched) return
    const currencies = newCountryCurrencies.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
    const candidates = buildGoogleCandidates(newCountryLocationLevels)
    const cfg: any = { version: 1 }
    if (currencies.length) cfg.currencies = currencies
    if (candidates.length) cfg.googleLocationMapping = { candidates }
    if (includeDefaultPriceListId && defaultPriceListId) {
      cfg.defaultPriceListId = defaultPriceListId
    }
    setNewCountryConfigJson(prettyJson(cfg))
  }, [countryConfigTouched, defaultPriceListId, includeDefaultPriceListId, newCountryCurrencies, newCountryLocationLevels])

  useEffect(() => {
    if (selectedId) {
      setIsCreateCountryOpen(false)
      setNewCountryName('')
      setNewCountryCode('')
      setNewCountryCurrencies([])
      setNewCountryAddressFields([])
      setNewCountryLocationLevels([])
      setIncludeDefaultPriceListId(false)
      setDefaultPriceListId('')
      setAddressSchemaTouched(false)
      setCountryConfigTouched(false)
      setNewCountryAddressSchemaJson(prettyJson({ version: 1, locationChain: parseCsvList(DEFAULT_LOCATION_CHAIN), fields: [] }))
      setNewCountryConfigJson(prettyJson({ version: 1 }))
    }
  }, [selectedId])

  useEffect(() => {
    if (!selectedNode) return
    if (selectedNode.type !== 'Country') return
    const code = String(selectedNode.code ?? root.code ?? countryCode ?? '').trim().toUpperCase()
    if (!code) return
    setEditCountryCode(code)
    if (editCountryLoadedCode === code) return
    if (!isEditCountryOpen) return
    loadEditCountryConfig(code)
  }, [
    countryCode,
    editCountryLoadedCode,
    isEditCountryOpen,
    loadEditCountryConfig,
    root.code,
    selectedNode,
  ])

  useEffect(() => {
    if (editAddressSchemaTouched) return
    const locationChain = editCountryLocationLevels
      .map((l) => l.locationType.trim().toLowerCase())
      .filter(Boolean)
    const fields = editCountryAddressFields
      .map((raw) => {
        try {
          return JSON.parse(raw)
        } catch {
          return null
        }
      })
      .filter(Boolean)
    setEditCountryAddressSchemaJson(
      prettyJson({
        version: 1,
        locationChain: locationChain.length ? locationChain : parseCsvList(DEFAULT_LOCATION_CHAIN),
        fields,
      })
    )
  }, [editAddressSchemaTouched, editCountryAddressFields, editCountryLocationLevels])

  useEffect(() => {
    if (editCountryConfigTouched) return
    const currencies = editCountryCurrencies.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
    const candidates = buildGoogleCandidates(editCountryLocationLevels)
    const cfg: any = { version: 1 }
    if (currencies.length) cfg.currencies = currencies
    if (candidates.length) cfg.googleLocationMapping = { candidates }
    if (editIncludeDefaultPriceListId && editDefaultPriceListId) {
      cfg.defaultPriceListId = editDefaultPriceListId
    }
    setEditCountryConfigJson(prettyJson(cfg))
  }, [
    editCountryConfigTouched,
    editCountryCurrencies,
    editCountryLocationLevels,
    editDefaultPriceListId,
    editIncludeDefaultPriceListId,
  ])

  const onCreateCountry = useCallback(async () => {
    const name = newCountryName.trim()
    const code = newCountryCode.trim().toUpperCase()
    if (!name) return
    if (!code) return

    const locationChain = newCountryLocationLevels
      .map((l) => l.locationType.trim().toLowerCase())
      .filter(Boolean)

    const currencies = newCountryCurrencies.map((s) => String(s).trim().toUpperCase()).filter(Boolean)

    // Validate address fields (each item is JSON).
    const addressFields: any[] = []
    for (let i = 0; i < newCountryAddressFields.length; i++) {
      const parsed = safeJsonParse(newCountryAddressFields[i], `Address field #${i + 1}`)
      if (!parsed.ok) {
        toast.error('Cannot save country', { description: parsed.error })
        return
      }
      addressFields.push(parsed.value)
    }

    const googleCandidates = buildGoogleCandidates(newCountryLocationLevels)

    // Advanced overrides allow supporting any API fields without hardcoding DTOs.
    // We still seed sensible defaults from the friendly inputs when JSON editors are untouched.
    const schemaParsed = safeJsonParse(newCountryAddressSchemaJson, 'Address schema')
    if (!schemaParsed.ok) {
      toast.error('Cannot save country', { description: schemaParsed.error })
      return
    }
    const configParsed = safeJsonParse(newCountryConfigJson, 'Country config')
    if (!configParsed.ok) {
      toast.error('Cannot save country', { description: configParsed.error })
      return
    }

    const schemaOverride = schemaParsed.value as any
    const configOverride = configParsed.value as any

    // Merge in friendly values if user left them empty in the JSON.
    const effectiveSchema = {
      ...(typeof schemaOverride === 'object' && schemaOverride ? schemaOverride : {}),
      version: (schemaOverride as any)?.version ?? 1,
      locationChain: Array.isArray((schemaOverride as any)?.locationChain)
        ? (schemaOverride as any).locationChain
        : locationChain.length
          ? locationChain
          : parseCsvList(DEFAULT_LOCATION_CHAIN),
      fields: Array.isArray((schemaOverride as any)?.fields)
        ? (schemaOverride as any).fields
        : addressFields,
    }

    const effectiveConfig: any = {
      ...(typeof configOverride === 'object' && configOverride ? configOverride : {}),
    }
    if (effectiveConfig.version === undefined) effectiveConfig.version = (configOverride as any)?.version ?? 1

    const overrideHasCurrencies = Boolean(configOverride && typeof configOverride === 'object' && 'currencies' in (configOverride as any))
    if (!overrideHasCurrencies) {
      if (currencies.length) effectiveConfig.currencies = currencies
      else delete effectiveConfig.currencies
    }

    const overrideHasGoogle = Boolean(
      configOverride && typeof configOverride === 'object' && 'googleLocationMapping' in (configOverride as any)
    )
    if (!overrideHasGoogle) {
      if (googleCandidates.length) effectiveConfig.googleLocationMapping = { candidates: googleCandidates }
      else delete effectiveConfig.googleLocationMapping
    }

    if (includeDefaultPriceListId && defaultPriceListId && (effectiveConfig as any).defaultPriceListId === undefined) {
      ;(effectiveConfig as any).defaultPriceListId = defaultPriceListId
    }

    try {
      const body: any = {
        name,
        code,
        type: 'country',
        countryCode: code,
      }

      const created = await authorizedRequest<any>(endpoints.locations.base, { method: 'POST', body })
      const createdId = String(unwrap(created)?.id ?? unwrap(created)?._id ?? '')

      // Configure address schema for the country (stored server-side).
      try {
        await authorizedRequest<any>(endpoints.addresses.fieldConfig({ countryCode: code }), {
          method: 'PUT',
          body: {
            schema: effectiveSchema,
          },
        })
      } catch (e: any) {
        // Attempt rollback so we don't leave a partially configured country.
        if (createdId) {
          await authorizedRequest(endpoints.locations.byId(createdId), { method: 'DELETE' }).catch(() => null)
        }
        throw new Error(e?.message ? `Address config failed: ${e.message}` : 'Address config failed')
      }

      // Configure country-level settings (currencies, mappings, etc.).
      try {
        await authorizedRequest<any>(endpoints.countries.config({ countryCode: code }), {
          method: 'PUT',
          body: {
            config: effectiveConfig,
          },
        })
      } catch (e: any) {
        if (createdId) {
          await authorizedRequest(endpoints.locations.byId(createdId), { method: 'DELETE' }).catch(() => null)
        }
        throw new Error(e?.message ? `Country config failed: ${e.message}` : 'Country config failed')
      }

      toast.success('Country created')
      await loadCountries()
      setCountryCode(code)
      await loadTree(code)
      setSelectedId(createdId || code)
      setIsCreateCountryOpen(false)
      setNewCountryName('')
      setNewCountryCode('')
      setNewCountryCurrencies([])
      setNewCountryAddressFields([])
      setNewCountryLocationLevels([])
      setIncludeDefaultPriceListId(false)
      setDefaultPriceListId('')
      setAddressSchemaTouched(false)
      setCountryConfigTouched(false)
      setNewCountryAddressSchemaJson(prettyJson({ version: 1, locationChain: parseCsvList(DEFAULT_LOCATION_CHAIN), fields: [] }))
      setNewCountryConfigJson(prettyJson({ version: 1 }))
    } catch (e: any) {
      toast.error('Failed to create country', { description: e?.message || 'Please try again.' })
    }
  }, [authorizedRequest, defaultPriceListId, includeDefaultPriceListId, loadCountries, loadTree, newCountryAddressFields, newCountryAddressSchemaJson, newCountryCode, newCountryConfigJson, newCountryCurrencies, newCountryLocationLevels, newCountryName])

  const TreeNode = ({ node, depth }: { node: LocationNode; depth: number }) => {
    const isExpanded = effectiveExpanded.has(node.id)
    const isSelected = node.id === selectedId
    const isMatch = matches.has(node.id)
    const isVisible = !visible || visible.has(node.id)

    if (!isVisible) return null

    const hasChildren = node.children.length > 0

    return (
      <div>
        <div
          className={cn(
            'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/40',
            !isSelected && isMatch ? 'ring-1 ring-primary/20 bg-primary/5' : null
          )}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', !hasChildren && 'invisible')}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleExpanded(node.id)
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
          </Button>

          <button
            type="button"
            onClick={() => handleSelectNode(node)}
            className="flex flex-1 items-center gap-2 min-w-0 text-left"
          >
            <MapPin className={cn('h-4 w-4 shrink-0', isSelected ? 'text-foreground' : 'text-muted-foreground')} />
            <span className={cn('truncate', isMatch && !isSelected ? 'font-medium text-foreground' : null)}>
              {node.type === 'Country' && node.code ? `${node.name} (${node.code})` : node.name}
            </span>
            <Badge variant="secondary" className="ml-auto shrink-0">
              {node.type}
            </Badge>
          </button>
        </div>

        {hasChildren && isExpanded ? (
          <div className="mt-1">
            {node.children.map((child) => (
              <TreeNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <AdminLayout
      title="Settings · Locations"
      description="Manage delivery locations as a hierarchy (like a folder tree)."
      actions={
        <Link href="/axis/settings">
          <Button variant="outline" size="sm">
            <CornerDownRight className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Location hierarchy
                </CardTitle>
                <CardDescription>
                  Select a parent to view children and add new locations.
                </CardDescription>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={countryCode} onValueChange={(v) => onSelectCountry(v)} disabled={isLoadingCountries}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.length ? (
                      countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__empty" disabled>
                        No countries found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Search (optional)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search Nairobi…"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <Separator />

          <CardContent className="p-0">
            <ScrollArea className="h-[520px]">
              <div className="p-3">
                {isLoadingTree ? null : <TreeNode node={root} depth={0} />}
                {search.trim() && matches.size === 0 ? (
                  <div className="px-2 py-6 text-sm text-muted-foreground">
                    No matches. Try a different term.
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              You always know where you are — breadcrumbs reflect the hierarchy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedNode ? (
              <div className="space-y-6">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm font-medium">No location selected</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select a node in the tree to view details, or create a new country.
                  </p>
                </div>

                <div className="flex items-center justify-end">
                  <Button type="button" onClick={() => setIsCreateCountryOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create country
                  </Button>
                </div>

                {isCreateCountryOpen ? (
                  <div className="rounded-lg border bg-card p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">Create country</p>
                        <p className="text-sm text-muted-foreground">Type is fixed to Country.</p>
                      </div>
                      <Badge variant="secondary">Country</Badge>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={newCountryName}
                          onChange={(e) => setNewCountryName(e.target.value)}
                          placeholder="e.g., Tanzania"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Code</Label>
                        <Input
                          value={newCountryCode}
                          onChange={(e) => setNewCountryCode(e.target.value)}
                          placeholder="e.g., TZ"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Location levels (chain + Google mapping)</Label>
                          <p className="text-xs text-muted-foreground">
                            One ordered list drives both <span className="font-mono">schema.locationChain</span> and <span className="font-mono">config.googleLocationMapping</span>.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setNewCountryLocationLevels([...DEFAULT_LOCATION_LEVELS])}
                          >
                            Reset
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setNewCountryLocationLevels((prev) => [...prev, { locationType: '', googleComponentTypes: '' }])
                            }
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add level
                          </Button>
                        </div>
                      </div>

                      {newCountryLocationLevels.length === 0 ? (
                        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                          No levels yet. Add at least <span className="font-mono">country</span>.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {newCountryLocationLevels.map((lvl, idx) => (
                            <div key={idx} className="rounded-md border bg-card p-3 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">Level #{idx + 1}</p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setNewCountryLocationLevels((prev) => prev.filter((_, i) => i !== idx))}
                                  aria-label="Remove level"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Location type</Label>
                                  <Input
                                    value={lvl.locationType}
                                    onChange={(e) =>
                                      setNewCountryLocationLevels((prev) =>
                                        prev.map((v, i) => (i === idx ? { ...v, locationType: e.target.value } : v))
                                      )
                                    }
                                    placeholder={idx === 0 ? 'country' : 'e.g., county'}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Lowercase recommended. This becomes an entry in <span className="font-mono">locationChain</span>.
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Label>Google component types (optional)</Label>
                                  <Input
                                    value={lvl.googleComponentTypes}
                                    onChange={(e) =>
                                      setNewCountryLocationLevels((prev) =>
                                        prev.map((v, i) => (i === idx ? { ...v, googleComponentTypes: e.target.value } : v))
                                      )
                                    }
                                    placeholder="e.g., locality,postal_town"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    If set, we generate a mapping candidate for this level.
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <MultiSelectAdd
                      label="Currencies"
                      placeholder="Select currency"
                      helperText="Optional. Uses the Currencies API list."
                      disabled={isLoadingCurrencies}
                      options={currencies
                        .map((c) => {
                          const name = (c.name || '').trim()
                          const label = name ? `${c.code} — ${name}` : c.code
                          return { value: c.code, label }
                        })
                        .sort((a, b) => a.value.localeCompare(b.value))}
                      values={newCountryCurrencies}
                      onChange={(next) => setNewCountryCurrencies(next)}
                    />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Address fields</Label>
                          <p className="text-xs text-muted-foreground">
                            Add/remove field definitions for the address schema. Each item is JSON.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNewCountryAddressFields((prev) => [
                              ...prev,
                              prettyJson({ key: '', label: '', type: 'text', required: false }),
                            ])
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add field
                        </Button>
                      </div>

                      {newCountryAddressFields.length === 0 ? (
                        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                          No fields yet. Add one if your checkout/address form needs it.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {newCountryAddressFields.map((field, idx) => (
                            <div key={idx} className="rounded-md border bg-card p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">Field #{idx + 1}</p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    setNewCountryAddressFields((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  aria-label="Remove field"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <Textarea
                                value={field}
                                onChange={(e) =>
                                  setNewCountryAddressFields((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                                }
                                className="min-h-28 font-mono text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>



                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={includeDefaultPriceListId}
                          onCheckedChange={(v) => setIncludeDefaultPriceListId(Boolean(v))}
                          id="defaultPriceList"
                        />
                        <Label htmlFor="defaultPriceList">Set default price list</Label>
                        <Badge variant="outline">Optional</Badge>
                      </div>
                      <Select
                        value={defaultPriceListId}
                        onValueChange={(v) => setDefaultPriceListId(v)}
                        disabled={!includeDefaultPriceListId || isLoadingPriceLists}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select price list" />
                        </SelectTrigger>
                        <SelectContent>
                          {priceLists.map((pl) => (
                            <SelectItem key={pl.id} value={pl.id}>
                              {pl.name} ({pl.code}) • {pl.currencyCode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Writes <span className="font-mono">defaultPriceListId</span> into the country config JSON. If your backend uses a different key,
                        set it in Advanced JSON instead.
                      </p>
                    </div>

                    <Accordion type="single" collapsible>
                      <AccordionItem value="advanced">
                        <AccordionTrigger>Advanced API fields (JSON)</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Address schema JSON (sent as {`{ schema: ... }`})</Label>
                              <Textarea
                                value={newCountryAddressSchemaJson}
                                onChange={(e) => {
                                  setAddressSchemaTouched(true)
                                  setNewCountryAddressSchemaJson(e.target.value)
                                }}
                                className="min-h-48 font-mono text-xs"
                              />
                              <p className="text-xs text-muted-foreground">
                                Use this to set any additional schema fields supported by the API.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Country config JSON (sent as {`{ config: ... }`})</Label>
                              <Textarea
                                value={newCountryConfigJson}
                                onChange={(e) => {
                                  setCountryConfigTouched(true)
                                  setNewCountryConfigJson(e.target.value)
                                }}
                                className="min-h-48 font-mono text-xs"
                              />
                              <p className="text-xs text-muted-foreground">
                                Use this to set currencies and any other country config fields (e.g. googleLocationMapping).
                              </p>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreateCountryOpen(false)
                          setNewCountryName('')
                          setNewCountryCode('')
                          setNewCountryCurrencies([])
                          setNewCountryAddressFields([])
                          setNewCountryLocationLevels([])
                          setIncludeDefaultPriceListId(false)
                          setDefaultPriceListId('')
                          setAddressSchemaTouched(false)
                          setCountryConfigTouched(false)
                          setNewCountryAddressSchemaJson(prettyJson({ version: 1, locationChain: parseCsvList(DEFAULT_LOCATION_CHAIN), fields: [] }))
                          setNewCountryConfigJson(prettyJson({ version: 1 }))
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={onCreateCountry}
                        disabled={!newCountryName.trim() || !newCountryCode.trim()}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  {selectedPath ? (
                    <Breadcrumb>
                      <BreadcrumbList>
                        {selectedPath.map((node, idx) => {
                          const isLast = idx === selectedPath.length - 1
                          return (
                            <div key={node.id} className="contents">
                              <BreadcrumbItem>
                                {isLast ? (
                                  <BreadcrumbPage>
                                    {node.type === 'Country' && node.code ? `${node.name} (${node.code})` : node.name}
                                  </BreadcrumbPage>
                                ) : (
                                  <BreadcrumbLink
                                    href="#"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      setSelectedId(node.id)
                                      setExpandedIds((prev) => new Set(prev).add(node.id))
                                    }}
                                  >
                                    {node.type === 'Country' && node.code ? `${node.name} (${node.code})` : node.name}
                                  </BreadcrumbLink>
                                )}
                              </BreadcrumbItem>
                              {!isLast ? <BreadcrumbSeparator /> : null}
                            </div>
                          )
                        })}
                      </BreadcrumbList>
                    </Breadcrumb>
                  ) : null}

                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xl font-semibold truncate">{selectedNode.name}</p>
                          <Badge variant="secondary">{selectedNode.type}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {selectedNode.children.length} child {selectedNode.children.length === 1 ? 'node' : 'nodes'}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedId(null)}>
                        Clear selection
                      </Button>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Country</p>
                        <p className="text-sm font-medium">{root.code ?? root.id}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="text-sm font-medium">{selectedNode.type}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Parent</p>
                        <p className="text-sm font-medium">{parentNode ? parentNode.name : '—'}</p>
                      </div>
                      <div className="space-y-1 sm:col-span-3">
                        <p className="text-xs text-muted-foreground">Code</p>
                        <p className="text-sm font-medium">{selectedNode.code || '—'}</p>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {!isRootSelected ? (
                      <div className="flex items-center justify-end">
                        {!pendingDeleteSelected ? (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setPendingDeleteSelected(true)}
                          >
                            Delete location
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-muted-foreground mr-2">Delete this location and all children?</p>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setPendingDeleteSelected(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => onDeleteNode(selectedNode.id, parentNode?.id ?? null)}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Country root can’t be deleted from here.</p>
                    )}
                  </div>

                  {selectedNode.type === 'Country' ? (
                    <>
                      <Separator />

                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">Edit country</p>
                            <p className="text-sm text-muted-foreground">
                              Update address field-config and country config for{' '}
                              <span className="font-medium text-foreground">{editCountryCode || selectedNode.code || root.code}</span>.
                            </p>
                          </div>
                          <Button type="button" variant="outline" onClick={() => setIsEditCountryOpen((v) => !v)}>
                            {isEditCountryOpen ? 'Hide' : 'Show'}
                          </Button>
                        </div>

                        {isEditCountryOpen ? (
                          <div className="rounded-lg border bg-card p-4 space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{editCountryCode || selectedNode.code || root.code}</Badge>
                                {isLoadingEditCountryConfig ? null : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => loadEditCountryConfig(editCountryCode || selectedNode.code || root.code || '')}
                                  disabled={isLoadingEditCountryConfig}
                                >
                                  Reload
                                </Button>
                                <Button
                                  type="button"
                                  onClick={onSaveEditCountryConfig}
                                  disabled={isLoadingEditCountryConfig || !String(editCountryCode || selectedNode.code || root.code || '').trim()}
                                >
                                  Save changes
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <MultiSelectAdd
                                  label="Currencies"
                                  placeholder="Select currency"
                                  helperText="Optional. Uses the Currencies API list."
                                  disabled={isLoadingCurrencies}
                                  options={currencies
                                    .map((c) => {
                                      const name = (c.name || '').trim()
                                      const label = name ? `${c.code} — ${name}` : c.code
                                      return { value: c.code, label }
                                    })
                                    .sort((a, b) => a.value.localeCompare(b.value))}
                                  values={editCountryCurrencies}
                                  onChange={(next) => {
                                    setEditCountryCurrencies(next)
                                    setEditCountryConfigTouched(false)
                                  }}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Default price list (optional)</Label>
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={editIncludeDefaultPriceListId}
                                    onCheckedChange={(v) => setEditIncludeDefaultPriceListId(Boolean(v))}
                                    id="edit-default-price-list"
                                  />
                                  <Label htmlFor="edit-default-price-list" className="text-sm text-muted-foreground">
                                    Enable
                                  </Label>
                                </div>
                                <Select
                                  value={editDefaultPriceListId}
                                  onValueChange={(v) => setEditDefaultPriceListId(v)}
                                  disabled={!editIncludeDefaultPriceListId || isLoadingPriceLists}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select price list" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {priceLists.map((pl) => (
                                      <SelectItem key={pl.id} value={pl.id}>
                                        {pl.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                  Writes <span className="font-mono">defaultPriceListId</span> into the country config JSON. If your backend uses a different key,
                                  set it in the advanced JSON editor.
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <p className="font-medium">Location levels (chain + Google mapping)</p>
                                <p className="text-sm text-muted-foreground">
                                  Ordered list. Left is your internal <span className="font-mono">locationChain</span>; right maps to Google component types.
                                </p>
                              </div>

                              <div className="space-y-3">
                                {editCountryLocationLevels.map((row, idx) => (
                                  <div key={idx} className="grid gap-3 sm:grid-cols-[180px_1fr_auto] items-start">
                                    <div className="space-y-2">
                                      <Label>Location type</Label>
                                      <Input
                                        value={row.locationType}
                                        onChange={(e) => {
                                          const v = e.target.value
                                          setEditCountryLocationLevels((prev) => {
                                            const next = [...prev]
                                            next[idx] = { ...next[idx], locationType: v }
                                            return next
                                          })
                                        }}
                                        placeholder="e.g. ward"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Google component types (comma-separated)</Label>
                                      <Input
                                        value={row.googleComponentTypes}
                                        onChange={(e) => {
                                          const v = e.target.value
                                          setEditCountryLocationLevels((prev) => {
                                            const next = [...prev]
                                            next[idx] = { ...next[idx], googleComponentTypes: v }
                                            return next
                                          })
                                        }}
                                        placeholder="e.g. locality,postal_town"
                                      />
                                    </div>
                                    <div className="pt-7">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                          setEditCountryLocationLevels((prev) => prev.filter((_, i) => i !== idx))
                                        }
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    setEditCountryLocationLevels((prev) => [...prev, { locationType: '', googleComponentTypes: '' }])
                                  }
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add level
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => setEditCountryLocationLevels([...DEFAULT_LOCATION_LEVELS])}>
                                  Reset
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <p className="font-medium">Address fields</p>
                                <p className="text-sm text-muted-foreground">Each item must be valid JSON. These are written into the address schema.</p>
                              </div>

                              {editCountryAddressFields.length === 0 ? (
                                <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                                  No fields yet.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {editCountryAddressFields.map((raw, idx) => (
                                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-medium">Field #{idx + 1}</p>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setEditCountryAddressFields((prev) => prev.filter((_, i) => i !== idx))}
                                        >
                                          Remove
                                        </Button>
                                      </div>
                                      <Textarea
                                        value={raw}
                                        onChange={(e) => {
                                          const v = e.target.value
                                          setEditCountryAddressFields((prev) => {
                                            const next = [...prev]
                                            next[idx] = v
                                            return next
                                          })
                                        }}
                                        className="font-mono text-xs"
                                        rows={6}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}

                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditCountryAddressFields((prev) => [...prev, prettyJson({})])}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add field
                              </Button>
                            </div>

                            <Accordion type="single" collapsible>
                              <AccordionItem value="advanced">
                                <AccordionTrigger>Advanced JSON (full API surface)</AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Address schema JSON (sent as {`{ schema: ... }`})</Label>
                                      <Textarea
                                        value={editCountryAddressSchemaJson}
                                        onChange={(e) => {
                                          setEditCountryAddressSchemaJson(e.target.value)
                                          setEditAddressSchemaTouched(true)
                                        }}
                                        rows={10}
                                        className="font-mono text-xs"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Country config JSON (sent as {`{ config: ... }`})</Label>
                                      <Textarea
                                        value={editCountryConfigJson}
                                        onChange={(e) => {
                                          setEditCountryConfigJson(e.target.value)
                                          setEditCountryConfigTouched(true)
                                        }}
                                        rows={10}
                                        className="font-mono text-xs"
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        Use this to set currencies and any other country config fields (e.g. googleLocationMapping).
                                      </p>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Add child</p>
                      <p className="text-sm text-muted-foreground">
                        Add children under <span className="font-medium text-foreground">{selectedNode.name}</span>.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setIsAddChildOpen((v) => !v)}
                      disabled={!canCreateChild}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add child
                    </Button>
                  </div>

                  {!canCreateChild ? (
                    <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                      This node can’t have children.
                    </div>
                  ) : null}

                  {isAddChildOpen && canCreateChild ? (
                    <div className="rounded-lg border bg-card p-4 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Parent</Label>
                          <Input value={`${selectedNode.name} (${selectedNode.type})`} readOnly />
                        </div>
                        <div className="space-y-2">
                          <Label>Child type</Label>
                          <Select
                            value={String(effectiveNewChildType)}
                            onValueChange={(v) => setNewChildType(v as LocationType)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {allowedChildTypes.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={newChildName}
                            onChange={(e) => setNewChildName(e.target.value)}
                            placeholder="Required"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Code (optional)</Label>
                          <Input
                            value={newChildCode}
                            onChange={(e) => setNewChildCode(e.target.value)}
                            placeholder="Optional"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddChildOpen(false)
                            setNewChildName('')
                            setNewChildCode('')
                            setNewChildType('')
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={onCreateChild}
                          disabled={!newChildName.trim() || !effectiveNewChildType}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Children</p>
                      <p className="text-sm text-muted-foreground">{selectedNode.children.length} total</p>
                    </div>
                  </div>

                  {selectedNode.children.length === 0 ? (
                    <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                      No children yet.
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <div className="divide-y">
                        {selectedNode.children.map((child) => {
                          const isConfirming = pendingDeleteId === child.id
                          return (
                            <div key={child.id} className="p-3 flex items-center gap-3">
                              <button
                                type="button"
                                className="flex-1 min-w-0 text-left"
                                onClick={() => {
                                  setSelectedId(child.id)
                                  setExpandedIds((prev) => new Set(prev).add(selectedNode.id))
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="truncate font-medium">{child.name}</span>
                                  <Badge variant="secondary" className="shrink-0">{child.type}</Badge>
                                  {child.code ? (
                                    <span className="text-xs text-muted-foreground shrink-0">{child.code}</span>
                                  ) : null}
                                </div>
                              </button>

                              {!isConfirming ? (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setPendingDeleteId(child.id)}
                                >
                                  Delete
                                </Button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setPendingDeleteId(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => onDeleteNode(child.id, selectedNode.id)}
                                  >
                                    Confirm
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
