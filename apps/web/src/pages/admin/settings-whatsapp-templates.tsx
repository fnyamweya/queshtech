import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { CornerDownRight, Loader2, Plus, RefreshCw, Send, Trash2, Wand2 } from 'lucide-react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'

type WhatsappTemplateCategory = 'utility' | 'marketing' | 'authentication' | string

type WhatsappTemplateStatus = string

type WhatsappTemplate = {
  id: string
  name: string
  category?: WhatsappTemplateCategory
  language?: string
  status?: WhatsappTemplateStatus
  isActive?: boolean
  body?: string
  components?: unknown
  createdAt?: string
  updatedAt?: string
}

type HeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'

type TemplateButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
type TemplateButtonDraft = {
  id: string
  type: TemplateButtonType
  text: string
  url?: string
  phoneNumber?: string
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function safeStringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return 'null'
  }
}

function parseJsonArray(text: string): { ok: true; value: any[] } | { ok: false; error: string } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: true, value: [] }

  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) return { ok: false, error: 'Must be a JSON array.' }
    return { ok: true, value: parsed }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Invalid JSON.' }
  }
}

function buildBodyComponent(body: string) {
  return [{ type: 'BODY', text: body }]
}

function buildGuidedComponents(opts: {
  body: string
  header?: { enabled: boolean; format: HeaderFormat; text?: string }
  footer?: { enabled: boolean; text?: string }
  buttons?: { enabled: boolean; items: TemplateButtonDraft[] }
}) {
  const components: any[] = []

  if (opts.header?.enabled) {
    const header: any = {
      type: 'HEADER',
      format: opts.header.format,
    }
    if (opts.header.format === 'TEXT') {
      const text = (opts.header.text || '').trim()
      if (text) header.text = text
    }
    components.push(header)
  }

  components.push({ type: 'BODY', text: opts.body })

  if (opts.footer?.enabled) {
    const text = (opts.footer.text || '').trim()
    if (text) components.push({ type: 'FOOTER', text })
  }

  if (opts.buttons?.enabled) {
    const buttons = (opts.buttons.items || [])
      .map((b) => {
        const base: any = { type: b.type, text: (b.text || '').trim() }
        if (!base.text) return null

        if (b.type === 'URL') {
          const url = (b.url || '').trim()
          if (url) base.url = url
        }

        if (b.type === 'PHONE_NUMBER') {
          const phone = (b.phoneNumber || '').trim()
          if (phone) base.phone_number = phone
        }

        return base
      })
      .filter(Boolean)

    if (buttons.length > 0) {
      components.push({ type: 'BUTTONS', buttons })
    }
  }

  return components
}

function extractBodyPreview(t: WhatsappTemplate): string {
  if (typeof t.body === 'string' && t.body.trim()) return t.body.trim()

  // Best-effort for common WA template structures.
  const anyT = t as any
  const components = anyT?.components
  if (Array.isArray(components)) {
    const body = components.find((c: any) => (c?.type || c?.component_type) === 'BODY')
    const text = body?.text || body?.example?.body_text?.[0]
    if (typeof text === 'string' && text.trim()) return text.trim()
  }

  const content = anyT?.content
  if (typeof content === 'string' && content.trim()) return content.trim()

  return ''
}

function formatCategory(value?: string) {
  if (!value) return '—'
  return value.toLowerCase()
}

function formatStatus(value?: string) {
  if (!value) return '—'
  return value.toLowerCase().replace(/_/g, ' ')
}

function normalizeTemplate(raw: any): WhatsappTemplate {
  return {
    id: String(raw?.id ?? raw?._id ?? raw?.templateId ?? ''),
    name: String(raw?.name ?? ''),
    category: raw?.category,
    language: raw?.language,
    status: raw?.status,
    isActive: typeof raw?.isActive === 'boolean' ? raw.isActive : raw?.active,
    body: raw?.body,
    components: raw?.components,
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  }
}

export function AdminSettingsWhatsappTemplatesPage() {
  const { accessToken } = useAdminAuth()
  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])

  const [templates, setTemplates] = useState<WhatsappTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const [filterName, setFilterName] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterActiveOnly, setFilterActiveOnly] = useState(false)

  const [name, setName] = useState('')
  const [category, setCategory] = useState<WhatsappTemplateCategory>('UTILITY')
  const [language, setLanguage] = useState('en_US')
  const [body, setBody] = useState('')

  const [submitToProvider, setSubmitToProvider] = useState(true)

  const [componentsMode, setComponentsMode] = useState<'guided' | 'advanced'>('guided')

  const [headerEnabled, setHeaderEnabled] = useState(false)
  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>('TEXT')
  const [headerText, setHeaderText] = useState('')

  const [footerEnabled, setFooterEnabled] = useState(false)
  const [footerText, setFooterText] = useState('')

  const [buttonsEnabled, setButtonsEnabled] = useState(false)
  const [buttons, setButtons] = useState<TemplateButtonDraft[]>([])

  const guidedComponents = useMemo(() => {
    return buildGuidedComponents({
      body: body.trim(),
      header: { enabled: headerEnabled, format: headerFormat, text: headerText },
      footer: { enabled: footerEnabled, text: footerText },
      buttons: { enabled: buttonsEnabled, items: buttons },
    })
  }, [body, buttons, buttonsEnabled, footerEnabled, footerText, headerEnabled, headerFormat, headerText])

  const [componentsJsonText, setComponentsJsonText] = useState(safeStringifyJson(buildBodyComponent('')))
  const [componentsJsonError, setComponentsJsonError] = useState<string | null>(null)

  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    try {
      const qs = new URLSearchParams()
      if (filterName.trim()) qs.set('name', filterName.trim())
      if (filterCategory.trim()) qs.set('category', filterCategory.trim())
      if (filterStatus.trim()) qs.set('status', filterStatus.trim())
      if (filterActiveOnly) qs.set('isActive', 'true')

      const url = qs.toString() ? `${endpoints.whatsappTemplates.base}?${qs.toString()}` : endpoints.whatsappTemplates.base
      const resp = await api.get<any>(url)

      const list = Array.isArray(resp) ? resp : Array.isArray((resp as any)?.items) ? (resp as any).items : []
      const normalized = list.map(normalizeTemplate).filter((t) => t.id && t.name)
      setTemplates(normalized)
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      toast.error('Failed to load templates', { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onRefresh = async () => {
    await load()
  }

  const onSyncFromMeta = async () => {
    setIsSyncing(true)
    try {
      await api.get(endpoints.whatsappTemplates.fetchProvider)
      toast.success('Synced templates')
      await load()
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      toast.error('Sync failed', { description: message })
    } finally {
      setIsSyncing(false)
    }
  }

  const canCreate = useMemo(() => {
    return Boolean(name.trim()) && Boolean(language.trim()) && Boolean(body.trim())
  }, [body, language, name])

  const onSubmitToProvider = async (id: string) => {
    setSubmittingId(id)
    try {
      await api.post(endpoints.whatsappTemplates.submitById(id))
      toast.success('Template submitted')
      await load()
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      toast.error('Submit failed', { description: message })
    } finally {
      setSubmittingId(null)
    }
  }

  const onCreate = async () => {
    if (!canCreate) {
      toast.error('Missing fields', { description: 'Enter a name, language, and message body.' })
      return
    }

    try {
      const bodyText = body.trim()

      const components = (() => {
        if (componentsMode === 'advanced') {
          const parsed = parseJsonArray(componentsJsonText)
          if (!parsed.ok) {
            setComponentsJsonError(parsed.error)
            return null
          }
          return parsed.value.length > 0 ? parsed.value : buildBodyComponent(bodyText)
        }
        return guidedComponents.length > 0 ? guidedComponents : buildBodyComponent(bodyText)
      })()

      if (!components) {
        toast.error('Fix components JSON before creating', { description: componentsJsonError || 'Invalid JSON.' })
        return
      }

      const payload = {
        name: name.trim(),
        language: language.trim(),
        category: asString(category) ?? undefined,
        components,
        submitToProvider,
      }

      await api.post(endpoints.whatsappTemplates.base, payload)
      toast.success('Template created')
      setName('')
      setBody('')

      setHeaderEnabled(false)
      setHeaderFormat('TEXT')
      setHeaderText('')
      setFooterEnabled(false)
      setFooterText('')
      setButtonsEnabled(false)
      setButtons([])
      setComponentsMode('guided')
      setComponentsJsonText(safeStringifyJson(buildBodyComponent('')))
      setComponentsJsonError(null)
      await load()
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      toast.error('Create failed', { description: message })
    }
  }

  const onDelete = async (id: string) => {
    try {
      await api.delete(endpoints.whatsappTemplates.byId(id))
      toast.success('Template removed')
      await load()
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      toast.error('Delete failed', { description: message })
    }
  }

  return (
    <AdminLayout
      title="WhatsApp Templates"
      description="Create reusable WhatsApp message templates for customer communication."
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href="/axis/settings">
              <CornerDownRight className="h-4 w-4 mr-2" />
              Back to Settings
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/axis/settings/whatsapp">WhatsApp Settings</Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New template</CardTitle>
            <CardDescription>
              Define a reusable WhatsApp template. Use placeholders like {'{{1}}'}, {'{{2}}'} for variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. order_update" />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. en_US" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as WhatsappTemplateCategory)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[180px]"
                placeholder="Hi {{1}}, your order {{2}} is ready for pickup."
              />
              <div className="text-xs text-muted-foreground">
                Tip: Names are usually lowercase with underscores. Variables are positional, like {'{{1}}'}.
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Submit to provider after create</div>
                <div className="text-xs text-muted-foreground">Sends the created template to your WhatsApp provider for approval.</div>
              </div>
              <Switch checked={submitToProvider} onCheckedChange={setSubmitToProvider} />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Components</h3>
                  <p className="text-xs text-muted-foreground">Use Guided to add common parts fast, or Advanced for full control.</p>
                </div>

                <Select
                  value={componentsMode}
                  onValueChange={(v) => {
                    const mode = v as 'guided' | 'advanced'
                    setComponentsMode(mode)
                    if (mode === 'advanced') {
                      setComponentsJsonText(safeStringifyJson(guidedComponents))
                      setComponentsJsonError(null)
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guided">Guided</SelectItem>
                    <SelectItem value="advanced">Advanced JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {componentsMode === 'guided' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Header</div>
                      <div className="text-xs text-muted-foreground">Optional header (text or media placeholder).</div>
                    </div>
                    <Switch checked={headerEnabled} onCheckedChange={setHeaderEnabled} />
                  </div>

                  {headerEnabled ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Header format</Label>
                        <Select value={headerFormat} onValueChange={(v) => setHeaderFormat(v as HeaderFormat)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TEXT">Text</SelectItem>
                            <SelectItem value="IMAGE">Image</SelectItem>
                            <SelectItem value="VIDEO">Video</SelectItem>
                            <SelectItem value="DOCUMENT">Document</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Header text</Label>
                        <Input
                          value={headerText}
                          onChange={(e) => setHeaderText(e.target.value)}
                          placeholder={headerFormat === 'TEXT' ? 'e.g. Order update' : 'Optional (only used for TEXT)'}
                          disabled={headerFormat !== 'TEXT'}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Footer</div>
                      <div className="text-xs text-muted-foreground">Optional footer text.</div>
                    </div>
                    <Switch checked={footerEnabled} onCheckedChange={setFooterEnabled} />
                  </div>

                  {footerEnabled ? (
                    <div className="space-y-2">
                      <Label>Footer text</Label>
                      <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="e.g. Thank you for shopping with us" />
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Buttons</div>
                      <div className="text-xs text-muted-foreground">Add quick replies, URLs, or phone numbers.</div>
                    </div>
                    <Switch checked={buttonsEnabled} onCheckedChange={setButtonsEnabled} />
                  </div>

                  {buttonsEnabled ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">{buttons.length} button(s)</div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
                            setButtons((prev) => [
                              ...prev,
                              { id, type: 'QUICK_REPLY', text: '' },
                            ])
                          }}
                        >
                          Add button
                        </Button>
                      </div>

                      {buttons.map((b, idx) => (
                        <div key={b.id} className="rounded-md border p-3 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">Button {idx + 1}</div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setButtons((prev) => prev.filter((x) => x.id !== b.id))}
                            >
                              Remove
                            </Button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <Select
                                value={b.type}
                                onValueChange={(v) =>
                                  setButtons((prev) =>
                                    prev.map((x) => (x.id === b.id ? { ...x, type: v as TemplateButtonType } : x))
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="QUICK_REPLY">Quick reply</SelectItem>
                                  <SelectItem value="URL">URL</SelectItem>
                                  <SelectItem value="PHONE_NUMBER">Phone number</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Text</Label>
                              <Input
                                value={b.text}
                                onChange={(e) =>
                                  setButtons((prev) =>
                                    prev.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x))
                                  )
                                }
                                placeholder="e.g. Track order"
                              />
                            </div>

                            {b.type === 'URL' ? (
                              <div className="space-y-2 sm:col-span-2">
                                <Label>URL</Label>
                                <Input
                                  value={b.url || ''}
                                  onChange={(e) =>
                                    setButtons((prev) =>
                                      prev.map((x) => (x.id === b.id ? { ...x, url: e.target.value } : x))
                                    )
                                  }
                                  placeholder="https://example.com/orders/{{1}}"
                                />
                              </div>
                            ) : null}

                            {b.type === 'PHONE_NUMBER' ? (
                              <div className="space-y-2 sm:col-span-2">
                                <Label>Phone number</Label>
                                <Input
                                  value={b.phoneNumber || ''}
                                  onChange={(e) =>
                                    setButtons((prev) =>
                                      prev.map((x) => (x.id === b.id ? { ...x, phoneNumber: e.target.value } : x))
                                    )
                                  }
                                  placeholder="+254700000000"
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Preview (generated components JSON)</div>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs font-mono text-muted-foreground">{safeStringifyJson(guidedComponents)}</pre>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Components (JSON array)</Label>
                  <Textarea
                    value={componentsJsonText}
                    onChange={(e) => {
                      const v = e.target.value
                      setComponentsJsonText(v)
                      const parsed = parseJsonArray(v)
                      setComponentsJsonError(parsed.ok ? null : parsed.error)
                    }}
                    className="min-h-[260px] font-mono text-xs"
                    placeholder={safeStringifyJson([
                      { type: 'HEADER', format: 'TEXT', text: 'Order update' },
                      { type: 'BODY', text: 'Hi {{1}}, your order {{2}} was placed successfully.' },
                      { type: 'FOOTER', text: 'Thank you for shopping with us.' },
                      { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Track order' }] },
                    ])}
                  />
                  {componentsJsonError ? <div className="text-xs text-destructive">{componentsJsonError}</div> : null}
                  <div className="text-xs text-muted-foreground">
                    Tip: This should be a JSON array matching WhatsApp template components.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end">
              <Button onClick={onCreate} disabled={!canCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create template
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Templates</CardTitle>
                <CardDescription>Browse templates and sync them from Meta.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh
                </Button>
                <Button type="button" size="sm" onClick={onSyncFromMeta} disabled={isSyncing}>
                  {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                  Sync
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Search</Label>
                  <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Search by name" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Input value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} placeholder="e.g. approved" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} placeholder="e.g. utility" />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3 mt-6 sm:mt-0">
                  <div>
                    <div className="text-sm font-medium">Active only</div>
                    <div className="text-xs text-muted-foreground">Show only active templates.</div>
                  </div>
                  <Switch checked={filterActiveOnly} onCheckedChange={setFilterActiveOnly} />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Button type="button" variant="outline" size="sm" onClick={load} disabled={isLoading}>
                  Apply filters
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{templates.length} templates</div>
            </div>

            <ScrollArea className="h-[360px]">
              <div className="space-y-3 pr-3">
                {isLoading ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Loading templates…</div>
                ) : templates.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No templates found.</div>
                ) : (
                  templates.map((t) => {
                    const bodyText = extractBodyPreview(t)
                    const firstLine = (bodyText.split('\n')[0] || '').trim()
                    return (
                      <div key={t.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="text-sm font-medium truncate">{t.name}</div>
                              {t.isActive ? <Badge variant="secondary">active</Badge> : <Badge variant="outline">inactive</Badge>}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatCategory(t.category as any)}</span>
                              <span>·</span>
                              <span>{t.language || '—'}</span>
                              <span>·</span>
                              <span>{formatStatus(t.status)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onSubmitToProvider(t.id)}
                              disabled={submittingId === t.id}
                              aria-label={`Submit ${t.name}`}
                            >
                              {submittingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onDelete(t.id)}
                              aria-label={`Delete ${t.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {firstLine ? (
                          <>
                            <Separator className="my-3" />
                            <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{firstLine}</div>
                          </>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
