import { useMemo, useState, useEffect } from 'react'
import { Plus, RefreshCcw, Save, Trash2, Waypoints } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { createApiClient, createResource } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import { cn } from '@/lib/utils'

type Channel = {
  id: string
  code: string
  name: string
  description?: string | null
  isActive?: boolean | null
  configJson?: unknown
  metadata?: unknown
  createdAt?: string
  updatedAt?: string
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function safeStringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

function parseJsonText(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: true, value: {} }
  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Must be a JSON object.' }
    }
    return { ok: true, value: parsed }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Invalid JSON.' }
  }
}

export function AdminChannelsPage() {
  const { accessToken } = useAdminAuth()

  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])
  const channelsResource = useMemo(() => createResource(api, endpoints.channels.base), [api])

  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')

  const [draftId, setDraftId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Common config helpers (mirrored into configJson/metadata)
  const [currencyCode, setCurrencyCode] = useState('')
  const [locale, setLocale] = useState('')
  const [storefront, setStorefront] = useState(false)

  const [configJsonText, setConfigJsonText] = useState('{}')
  const [metadataText, setMetadataText] = useState('{}')
  const [configJsonError, setConfigJsonError] = useState<string | null>(null)
  const [metadataError, setMetadataError] = useState<string | null>(null)

  const [initialDraft, setInitialDraft] = useState({
    id: null as string | null,
    code: '',
    name: '',
    description: '',
    isActive: true,
    configJsonText: '{}',
    metadataText: '{}',
  })

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const refresh = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await channelsResource.list<Channel[]>()
      setChannels(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load channels')
      setChannels([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  const beginCreate = () => {
    setDraftId(null)
    setCode('')
    setName('')
    setDescription('')
    setIsActive(true)

    setCurrencyCode('')
    setLocale('')
    setStorefront(false)

    setConfigJsonText('{}')
    setMetadataText('{}')
    setConfigJsonError(null)
    setMetadataError(null)

    setInitialDraft({
      id: null,
      code: '',
      name: '',
      description: '',
      isActive: true,
      configJsonText: '{}',
      metadataText: '{}',
    })
  }

  const beginEdit = (id: string) => {
    const c = channels.find((x) => x.id === id)
    if (!c) return

    const cfg = asObject(c.configJson)
    const meta = asObject(c.metadata)

    const nextConfigText = safeStringifyJson(cfg)
    const nextMetadataText = safeStringifyJson(meta)

    setDraftId(id)
    setCode(c.code || '')
    setName(c.name || '')
    setDescription(c.description || '')
    setIsActive(typeof c.isActive === 'boolean' ? c.isActive : true)

    setCurrencyCode(typeof cfg.currencyCode === 'string' ? (cfg.currencyCode as string) : '')
    setLocale(typeof cfg.locale === 'string' ? (cfg.locale as string) : '')
    setStorefront(Boolean(meta.storefront))

    setConfigJsonText(nextConfigText)
    setMetadataText(nextMetadataText)
    setConfigJsonError(null)
    setMetadataError(null)

    setInitialDraft({
      id,
      code: c.code || '',
      name: c.name || '',
      description: c.description || '',
      isActive: typeof c.isActive === 'boolean' ? c.isActive : true,
      configJsonText: nextConfigText,
      metadataText: nextMetadataText,
    })
  }

  const normalizedCode = code.trim().toLowerCase()
  const codeConflict = useMemo(() => {
    if (!normalizedCode) return null
    const other = channels.find((c) => c.id !== draftId && (c.code || '').trim().toLowerCase() === normalizedCode)
    return other || null
  }, [channels, draftId, normalizedCode])

  const canSaveBasic = useMemo(() => code.trim().length > 0 && name.trim().length > 0 && !codeConflict, [code, codeConflict, name])

  const isDirty = useMemo(() => {
    return (
      initialDraft.id !== draftId ||
      initialDraft.code !== code ||
      initialDraft.name !== name ||
      initialDraft.description !== description ||
      initialDraft.isActive !== isActive ||
      initialDraft.configJsonText !== configJsonText ||
      initialDraft.metadataText !== metadataText
    )
  }, [code, configJsonText, description, draftId, initialDraft, isActive, metadataText, name])

  const visibleChannels = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...channels].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    if (!q) return sorted
    return sorted.filter((c) => `${c.name} ${c.code}`.toLowerCase().includes(q))
  }, [channels, query])

  const syncCommonConfigIntoJsonText = (opts: {
    currencyCode?: string
    locale?: string
    storefront?: boolean
  }) => {
    const parsedConfig = parseJsonText(configJsonText)
    const parsedMetadata = parseJsonText(metadataText)

    if (parsedConfig.ok) {
      const next = { ...parsedConfig.value }
      if (typeof opts.currencyCode === 'string') {
        if (opts.currencyCode.trim()) next.currencyCode = opts.currencyCode.trim()
        else delete next.currencyCode
      }
      if (typeof opts.locale === 'string') {
        if (opts.locale.trim()) next.locale = opts.locale.trim()
        else delete next.locale
      }
      setConfigJsonText(safeStringifyJson(next))
      setConfigJsonError(null)
    }

    if (parsedMetadata.ok && typeof opts.storefront === 'boolean') {
      const next = { ...parsedMetadata.value }
      next.storefront = opts.storefront
      setMetadataText(safeStringifyJson(next))
      setMetadataError(null)
    }
  }

  const handleSave = async () => {
    if (!canSaveBasic) {
      if (codeConflict) {
        toast.error('Code must be unique', { description: `“${codeConflict.code}” is already used by “${codeConflict.name}”.` })
      } else {
        toast.error('Code and name are required')
      }
      return
    }

    const parsedConfig = parseJsonText(configJsonText)
    const parsedMetadata = parseJsonText(metadataText)

    setConfigJsonError(parsedConfig.ok ? null : parsedConfig.error)
    setMetadataError(parsedMetadata.ok ? null : parsedMetadata.error)

    if (!parsedConfig.ok || !parsedMetadata.ok) {
      toast.error('Fix JSON errors before saving')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        isActive,
        configJson: parsedConfig.value,
        metadata: parsedMetadata.value,
      }

      if (draftId) {
        await channelsResource.update<Channel>(draftId, payload)
        toast.success('Channel updated')
      } else {
        await channelsResource.create<Channel>(payload)
        toast.success('Channel created')
      }

      await refresh()
      beginCreate()
    } catch (e: any) {
      toast.error('Failed to save channel', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await channelsResource.remove<void>(id)
      toast.success('Channel deleted')
      await refresh()
      if (draftId === id) beginCreate()
    } catch (e: any) {
      toast.error('Failed to delete channel', { description: e?.message || 'Please try again.' })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const selected = useMemo(() => channels.find((c) => c.id === draftId) || null, [channels, draftId])

  return (
    <AdminLayout title="Channels" description="Configure sales channels (storefronts, marketplaces, integrations) and their runtime configuration." >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Channels control configuration and metadata per storefront/integration.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={beginCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New channel
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Channels</CardTitle>
                <Badge variant="secondary">{channels.length}</Badge>
              </div>
              <CardDescription>
                {error ? error : 'Search and select a channel to edit.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Command className="rounded-md border">
                <CommandInput placeholder="Search by name or code…" value={query} onValueChange={setQuery} />
                <CommandList>
                  <ScrollArea className="h-[360px]">
                    {visibleChannels.length === 0 ? (
                      <CommandEmpty>No channels found.</CommandEmpty>
                    ) : null}
                    {visibleChannels.map((c) => {
                      const isSelected = c.id === draftId
                      return (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.code}`}
                          onSelect={() => beginEdit(c.id)}
                          className={cn('flex items-start justify-between gap-3', isSelected ? 'bg-accent text-accent-foreground' : undefined)}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{c.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{c.code}</div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-1">
                            {c.isActive === false ? <Badge variant="outline">inactive</Badge> : <Badge variant="outline">active</Badge>}
                          </div>
                        </CommandItem>
                      )
                    })}
                  </ScrollArea>
                </CommandList>
              </Command>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <Waypoints className="h-5 w-5" />
                    <span className="truncate">{draftId ? 'Edit channel' : 'Create channel'}</span>
                  </CardTitle>
                  <CardDescription>
                    {draftId && selected ? `Editing ${selected.name} (${selected.code})` : 'Define the channel and its JSON configuration.'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {draftId ? (
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  ) : null}
                  <Button onClick={handleSave} disabled={isSaving || !isDirty}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="channel-code">Code</Label>
                  <Input
                    id="channel-code"
                    placeholder="WEB"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  {codeConflict ? (
                    <p className="text-xs text-destructive">Code conflicts with “{codeConflict.name}”.</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="channel-name">Name</Label>
                  <Input
                    id="channel-name"
                    placeholder="Web Store"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="channel-description">Description</Label>
                  <Textarea
                    id="channel-description"
                    placeholder="Primary ecommerce storefront channel."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 sm:col-span-2 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Disable to pause this channel without deleting it.</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Common configuration</h3>
                  <p className="text-xs text-muted-foreground">These keys are written into configJson/metadata, but you can add more below.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="channel-currency">Currency code</Label>
                    <Input
                      id="channel-currency"
                      placeholder="KES"
                      value={currencyCode}
                      onChange={(e) => {
                        const v = e.target.value
                        setCurrencyCode(v)
                        syncCommonConfigIntoJsonText({ currencyCode: v })
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="channel-locale">Locale</Label>
                    <Input
                      id="channel-locale"
                      placeholder="en-KE"
                      value={locale}
                      onChange={(e) => {
                        const v = e.target.value
                        setLocale(v)
                        syncCommonConfigIntoJsonText({ locale: v })
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:col-span-2 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Storefront</p>
                      <p className="text-xs text-muted-foreground">Mark this channel as a storefront channel (metadata.storefront).</p>
                    </div>
                    <Switch
                      checked={storefront}
                      onCheckedChange={(v) => {
                        setStorefront(v)
                        syncCommonConfigIntoJsonText({ storefront: v })
                      }}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Advanced JSON</h3>
                  <p className="text-xs text-muted-foreground">
                    Any additional configuration can be stored in <span className="font-medium">configJson</span> and <span className="font-medium">metadata</span>.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="channel-config">configJson (object)</Label>
                    <Textarea
                      id="channel-config"
                      className="font-mono text-xs min-h-[220px]"
                      value={configJsonText}
                      onChange={(e) => {
                        const v = e.target.value
                        setConfigJsonText(v)
                        const parsed = parseJsonText(v)
                        setConfigJsonError(parsed.ok ? null : parsed.error)
                      }}
                    />
                    {configJsonError ? <p className="text-xs text-destructive">{configJsonError}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="channel-metadata">metadata (object)</Label>
                    <Textarea
                      id="channel-metadata"
                      className="font-mono text-xs min-h-[220px]"
                      value={metadataText}
                      onChange={(e) => {
                        const v = e.target.value
                        setMetadataText(v)
                        const parsed = parseJsonText(v)
                        setMetadataError(parsed.ok ? null : parsed.error)
                      }}
                    />
                    {metadataError ? <p className="text-xs text-destructive">{metadataError}</p> : null}
                  </div>
                </div>
              </div>

              {!canSaveBasic ? (
                <div className="rounded-md border p-3 text-xs text-muted-foreground">
                  <p className="font-medium">To save:</p>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Provide a unique code and a name.</li>
                    <li>Ensure JSON fields are valid objects.</li>
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete channel?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the channel. If you just want to pause it, set it to inactive instead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (draftId) handleDelete(draftId)
                }}
                className={cn(isDeleting ? 'pointer-events-none opacity-60' : undefined)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  )
}
