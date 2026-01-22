import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { CornerDownRight, RefreshCcw, Save, TestTube, Wand2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import { useAdminAuth } from '@/hooks/use-admin-auth'

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const parsed = JSON.parse(trimmed)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Value must be a JSON object')
  }
  return parsed as Record<string, unknown>
}

type AlgoliaCatalogSettingResponseDto = {
  enabled?: boolean
  appId?: string
  hasAdminApiKey?: boolean
  hasSearchApiKey?: boolean
  searchApiKey?: string
  indexPrefix?: string
  productsIndexName?: string
  effectiveProductsIndexName?: string
  indexSettingsJson?: Record<string, unknown>
  searchParamsJson?: Record<string, unknown>
  minQueryLength?: number
  debounceMs?: number
  createdAt?: string
  updatedAt?: string
}

export function AdminSettingsAlgoliaPage() {
  const { accessToken } = useAdminAuth()
  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])

  const [enabled, setEnabled] = useState(false)
  const [appId, setAppId] = useState('')
  const [searchApiKey, setSearchApiKey] = useState('')
  const [indexPrefix, setIndexPrefix] = useState('')
  const [productsIndexName, setProductsIndexName] = useState('catalog_products')
  const [minQueryLength, setMinQueryLength] = useState('2')
  const [debounceMs, setDebounceMs] = useState('150')

  const [indexSettingsJsonText, setIndexSettingsJsonText] = useState('')
  const [searchParamsJsonText, setSearchParamsJsonText] = useState('')

  const [effectiveIndexName, setEffectiveIndexName] = useState('')
  const [hasAdminApiKey, setHasAdminApiKey] = useState<boolean | null>(null)
  const [hasSearchApiKey, setHasSearchApiKey] = useState<boolean | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState('')

  const [adminApiKey, setAdminApiKey] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingSecret, setIsSavingSecret] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isReindexing, setIsReindexing] = useState(false)
  const [lastResponse, setLastResponse] = useState('')

  const load = async () => {
    setIsLoading(true)
    setLastResponse('')
    try {
      const resp = await api.get<AlgoliaCatalogSettingResponseDto>(endpoints.settings.algoliaCatalog)
      setLastResponse(safeJson(resp))

      setEnabled(Boolean(resp?.enabled))
      setAppId(resp?.appId || '')
      setSearchApiKey(resp?.searchApiKey || '')
      setIndexPrefix(resp?.indexPrefix || '')
      setProductsIndexName(resp?.productsIndexName || 'catalog_products')
      setEffectiveIndexName(resp?.effectiveProductsIndexName || '')
      setMinQueryLength(String(resp?.minQueryLength ?? 2))
      setDebounceMs(String(resp?.debounceMs ?? 150))

      setIndexSettingsJsonText(resp?.indexSettingsJson ? safeJson(resp.indexSettingsJson) : '')
      setSearchParamsJsonText(resp?.searchParamsJson ? safeJson(resp.searchParamsJson) : '')

      setHasAdminApiKey(typeof resp?.hasAdminApiKey === 'boolean' ? resp.hasAdminApiKey : null)
      setHasSearchApiKey(typeof resp?.hasSearchApiKey === 'boolean' ? resp.hasSearchApiKey : null)
      setLastUpdatedAt(resp?.updatedAt || '')
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('Load failed', { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSave = async () => {
    setIsSaving(true)
    setLastResponse('')

    try {
      const payload = {
        enabled: Boolean(enabled),
        appId: appId.trim() || undefined,
        searchApiKey: searchApiKey.trim() || undefined,
        indexPrefix: indexPrefix.trim() || undefined,
        productsIndexName: productsIndexName.trim() || undefined,
        minQueryLength: minQueryLength.trim() ? Number(minQueryLength) : undefined,
        debounceMs: debounceMs.trim() ? Number(debounceMs) : undefined,
        indexSettingsJson: parseJsonObject(indexSettingsJsonText),
        searchParamsJson: parseJsonObject(searchParamsJsonText),
      }

      const resp = await api.post(endpoints.settings.algoliaCatalog, payload)
      setLastResponse(safeJson(resp))
      toast.success('Algolia settings saved')
      await load()
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('Save failed', { description: message })
    } finally {
      setIsSaving(false)
    }
  }

  const onSaveSecret = async () => {
    const next = adminApiKey.trim()
    if (!next) {
      toast.error('Nothing to update', { description: 'Enter an Admin API key.' })
      return
    }

    setIsSavingSecret(true)
    setLastResponse('')
    try {
      const resp = await api.post(endpoints.settings.algoliaCatalogSecret, { adminApiKey: next })
      setLastResponse(safeJson(resp))
      toast.success('Admin API key updated')
      setAdminApiKey('')
      await load()
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('Update failed', { description: message })
    } finally {
      setIsSavingSecret(false)
    }
  }

  const onTest = async () => {
    setIsTesting(true)
    setLastResponse('')
    try {
      const resp = await api.post(endpoints.catalog.algoliaTest)
      setLastResponse(safeJson(resp))
      toast.success('Algolia connection test completed')
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('Test failed', { description: message })
    } finally {
      setIsTesting(false)
    }
  }

  const onApply = async () => {
    setIsApplying(true)
    setLastResponse('')
    try {
      const resp = await api.post(endpoints.catalog.algoliaApplySettings)
      setLastResponse(safeJson(resp))
      toast.success('Index settings applied')
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('Apply failed', { description: message })
    } finally {
      setIsApplying(false)
    }
  }

  const onReindex = async () => {
    setIsReindexing(true)
    setLastResponse('')
    try {
      const resp = await api.post(endpoints.catalog.algoliaReindex)
      setLastResponse(safeJson(resp))
      toast.success('Reindex started/completed')
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('Reindex failed', { description: message })
    } finally {
      setIsReindexing(false)
    }
  }

  return (
    <AdminLayout
      title="Settings · Algolia"
      description="Configure Algolia-powered full-text search for the catalog (products only)."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/axis/settings">
            <Button variant="outline" size="sm">
              <CornerDownRight className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Catalog search (Algolia)</CardTitle>
              <CardDescription>Search configuration used by the storefront search UI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Enabled</div>
                  <div className="text-xs text-muted-foreground">Turns Algolia search on/off for products.</div>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Application ID</Label>
                  <Input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="ABC123DEF" />
                </div>
                <div className="space-y-2">
                  <Label>Search-Only API Key</Label>
                  <Input
                    value={searchApiKey}
                    onChange={(e) => setSearchApiKey(e.target.value)}
                    placeholder="Search-only key (safe for storefront)"
                  />
                  <div className="text-xs text-muted-foreground">
                    Status: {hasSearchApiKey === null ? 'unknown' : hasSearchApiKey ? 'saved' : 'missing'}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Index prefix (optional)</Label>
                  <Input value={indexPrefix} onChange={(e) => setIndexPrefix(e.target.value)} placeholder="dev" />
                  <div className="text-xs text-muted-foreground">Recommended to separate environments.</div>
                </div>
                <div className="space-y-2">
                  <Label>Products index name</Label>
                  <Input
                    value={productsIndexName}
                    onChange={(e) => setProductsIndexName(e.target.value)}
                    placeholder="catalog_products"
                  />
                  <div className="text-xs text-muted-foreground">Effective: {effectiveIndexName || '—'}</div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Minimum query length</Label>
                  <Input value={minQueryLength} onChange={(e) => setMinQueryLength(e.target.value)} placeholder="2" />
                </div>
                <div className="space-y-2">
                  <Label>Debounce (ms)</Label>
                  <Input value={debounceMs} onChange={(e) => setDebounceMs(e.target.value)} placeholder="150" />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Index settings JSON (setSettings)</Label>
                <Textarea
                  value={indexSettingsJsonText}
                  onChange={(e) => setIndexSettingsJsonText(e.target.value)}
                  placeholder='{"searchableAttributes":["title","brandName"],"attributesForFaceting":["filterOnly(status)"]}'
                  className="min-h-[160px] font-mono text-xs"
                />
                <div className="text-xs text-muted-foreground">
                  Optional. Full Algolia index settings payload (advanced).
                </div>
              </div>

              <div className="space-y-2">
                <Label>Default search params JSON</Label>
                <Textarea
                  value={searchParamsJsonText}
                  onChange={(e) => setSearchParamsJsonText(e.target.value)}
                  placeholder='{"hitsPerPage":8,"attributesToHighlight":["title","brandName"]}'
                  className="min-h-[140px] font-mono text-xs"
                />
                <div className="text-xs text-muted-foreground">
                  Optional. Passed to the storefront search call (advanced).
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">Last updated: {lastUpdatedAt || '—'}</div>
                <Button onClick={onSave} disabled={isSaving || isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save settings
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin key (secret)</CardTitle>
              <CardDescription>Required for indexing and applying index settings. Stored encrypted at rest.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Admin API Key</Label>
                <Input
                  value={adminApiKey}
                  onChange={(e) => setAdminApiKey(e.target.value)}
                  placeholder="Admin key (never shown again)"
                />
                <div className="text-xs text-muted-foreground">
                  Status: {hasAdminApiKey === null ? 'unknown' : hasAdminApiKey ? 'saved' : 'missing'}
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Button onClick={onSaveSecret} disabled={isSavingSecret || isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  Update secret
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Operational tools</CardTitle>
              <CardDescription>Validate and maintain the Algolia index.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={onTest} disabled={isTesting || isLoading}>
                <TestTube className="h-4 w-4 mr-2" />
                Test connection
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onApply}
                disabled={isApplying || isLoading}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Apply index settings
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onReindex}
                disabled={isReindexing || isLoading}
              >
                <Zap className="h-4 w-4 mr-2" />
                Reindex all products
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Last response</CardTitle>
              <CardDescription>Raw response/debug output (helpful for support).</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={lastResponse} readOnly className="min-h-[240px] font-mono text-xs" />
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
