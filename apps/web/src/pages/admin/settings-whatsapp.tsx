import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { CornerDownRight, RefreshCw, Save, Send } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type WhatsappSettingsDraft = {
  enabled: boolean
  provider: string
  phoneNumberId: string
  businessAccountId: string
  accessToken: string
  verifyToken: string
  webhookUrl: string
  defaultSender: string
}

type WhatsappTemplateLite = {
  id: string
  name: string
  language?: string
  category?: string
  status?: string
  isActive?: boolean
  components?: unknown
  body?: string
}

function normalizeTemplate(raw: any): WhatsappTemplateLite {
  return {
    id: String(raw?.id ?? raw?._id ?? raw?.templateId ?? ''),
    name: String(raw?.name ?? ''),
    language: raw?.language,
    category: raw?.category,
    status: raw?.status,
    isActive: typeof raw?.isActive === 'boolean' ? raw.isActive : raw?.active,
    components: raw?.components,
    body: raw?.body,
  }
}

function extractTemplateBody(t: WhatsappTemplateLite): string {
  if (typeof t.body === 'string' && t.body.trim()) return t.body.trim()
  const anyT = t as any
  const components = anyT?.components
  if (Array.isArray(components)) {
    const body = components.find((c: any) => (c?.type || c?.component_type) === 'BODY')
    const text = body?.text
    if (typeof text === 'string' && text.trim()) return text.trim()
  }
  return ''
}

function extractBodyExampleVars(t: WhatsappTemplateLite): Record<number, string> {
  const anyT = t as any
  const components = anyT?.components
  if (!Array.isArray(components)) return {}
  const body = components.find((c: any) => (c?.type || c?.component_type) === 'BODY')
  const example = body?.example || body?.examples
  const bodyText = example?.body_text
  const firstRow = Array.isArray(bodyText) ? bodyText[0] : null
  if (!Array.isArray(firstRow)) return {}
  const out: Record<number, string> = {}
  for (let i = 0; i < firstRow.length; i++) {
    const value = firstRow[i]
    if (typeof value === 'string') out[i + 1] = value
  }
  return out
}

function placeholderKeys(message: string): number[] {
  const keys = new Set<number>()
  const re = /\{\{\s*(\d+)\s*\}\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(message))) {
    const n = Number(match[1])
    if (Number.isFinite(n)) keys.add(n)
  }
  return Array.from(keys).sort((a, b) => a - b)
}

function applyTemplateVars(message: string, vars: Record<number, string>) {
  return message.replace(/\{\{\s*(\d+)\s*\}\}/g, (full, nRaw) => {
    const n = Number(nRaw)
    if (!Number.isFinite(n)) return full
    const v = vars[n]
    return typeof v === 'string' ? v : full
  })
}

export function AdminSettingsWhatsappPage() {
  const { accessToken } = useAdminAuth()
  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])

  const [enabled, setEnabled] = useState(true)
  const [provider, setProvider] = useState('meta')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [businessAccountId, setBusinessAccountId] = useState('')
  const [accessTokenField, setAccessTokenField] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [defaultSender, setDefaultSender] = useState('')

  const [initial, setInitial] = useState<WhatsappSettingsDraft | null>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [lastRequest, setLastRequest] = useState('')
  const [lastResponse, setLastResponse] = useState('')

  const [isVerifyingWebhook, setIsVerifyingWebhook] = useState(false)
  const [verifyChallenge, setVerifyChallenge] = useState('123456')
  const [verifyTokenTest, setVerifyTokenTest] = useState('')

  const [testTo, setTestTo] = useState('')
  const [testMode, setTestMode] = useState<'freeText' | 'template'>('freeText')
  const [testMessage, setTestMessage] = useState('')

  const [templates, setTemplates] = useState<WhatsappTemplateLite[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [templateVars, setTemplateVars] = useState<Record<number, string>>({})

  const [templateDetail, setTemplateDetail] = useState<WhatsappTemplateLite | null>(null)
  const [isLoadingTemplateDetail, setIsLoadingTemplateDetail] = useState(false)

  const draft: WhatsappSettingsDraft = {
    enabled,
    provider,
    phoneNumberId,
    businessAccountId,
    accessToken: accessTokenField,
    verifyToken,
    webhookUrl,
    defaultSender,
  }

  const isDirty = useMemo(() => {
    if (!initial) return false
    return (
      initial.enabled !== draft.enabled ||
      initial.provider !== draft.provider ||
      initial.phoneNumberId !== draft.phoneNumberId ||
      initial.businessAccountId !== draft.businessAccountId ||
      initial.accessToken !== draft.accessToken ||
      initial.verifyToken !== draft.verifyToken ||
      initial.webhookUrl !== draft.webhookUrl ||
      initial.defaultSender !== draft.defaultSender
    )
  }, [draft, initial])

  const connectionHint = useMemo(() => {
    const hasPhone = Boolean(phoneNumberId.trim())
    const hasBiz = Boolean(businessAccountId.trim())
    const hasToken = Boolean(accessTokenField.trim())
    if (!enabled) return { label: 'Disabled', variant: 'outline' as const }
    if (hasPhone && hasBiz && hasToken) return { label: 'Configured', variant: 'secondary' as const }
    return { label: 'Incomplete', variant: 'outline' as const }
  }, [accessTokenField, businessAccountId, enabled, phoneNumberId])

  const loadSettings = async () => {
    setIsLoadingSettings(true)
    try {
      const resp = await api.get<any>(endpoints.settings.whatsapp)
      const next: WhatsappSettingsDraft = {
        enabled: typeof resp?.enabled === 'boolean' ? resp.enabled : true,
        provider: String(resp?.provider ?? 'meta'),
        phoneNumberId: String(resp?.phoneNumberId ?? ''),
        businessAccountId: String(resp?.businessAccountId ?? ''),
        accessToken: String(resp?.accessToken ?? ''),
        verifyToken: String(resp?.verifyToken ?? ''),
        webhookUrl: String(resp?.webhookUrl ?? ''),
        defaultSender: String(resp?.defaultSender ?? ''),
      }

      setEnabled(next.enabled)
      setProvider(next.provider)
      setPhoneNumberId(next.phoneNumberId)
      setBusinessAccountId(next.businessAccountId)
      setAccessTokenField(next.accessToken)
      setVerifyToken(next.verifyToken)
      setWebhookUrl(next.webhookUrl)
      setDefaultSender(next.defaultSender)

      setInitial(next)
    } catch {
      setInitial({
        enabled: true,
        provider: 'meta',
        phoneNumberId: '',
        businessAccountId: '',
        accessToken: '',
        verifyToken: '',
        webhookUrl: '',
        defaultSender: '',
      })
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const loadTemplates = async () => {
    setIsLoadingTemplates(true)
    try {
      const qs = new URLSearchParams()
      qs.set('isActive', 'true')
      const resp = await api.get<any>(`${endpoints.whatsappTemplates.base}?${qs.toString()}`)
      const list = Array.isArray(resp) ? resp : Array.isArray((resp as any)?.items) ? (resp as any).items : []
      const normalized = list.map(normalizeTemplate).filter((t: WhatsappTemplateLite) => t.id && t.name)
      setTemplates(normalized)
    } catch (e: any) {
      toast.error('Failed to load templates', { description: e?.message || 'Request failed' })
      setTemplates([])
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setVerifyTokenTest(verifyToken)
  }, [verifyToken])

  useEffect(() => {
    if (testMode === 'template' && templates.length === 0 && !isLoadingTemplates) {
      loadTemplates()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testMode])

  useEffect(() => {
    if (testMode !== 'template') return
    if (!selectedTemplateId) {
      setTemplateDetail(null)
      return
    }

    let isCancelled = false
    ;(async () => {
      setIsLoadingTemplateDetail(true)
      try {
        const resp = await api.get<any>(endpoints.whatsappTemplates.byId(selectedTemplateId))
        if (isCancelled) return
        setTemplateDetail(normalizeTemplate(resp))
      } catch {
        if (isCancelled) return
        setTemplateDetail(null)
      } finally {
        if (!isCancelled) setIsLoadingTemplateDetail(false)
      }
    })()

    return () => {
      isCancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, testMode])

  const selectedTemplate = useMemo(() => {
    if (templateDetail && templateDetail.id === selectedTemplateId) return templateDetail
    return templates.find((t) => t.id === selectedTemplateId) || null
  }, [selectedTemplateId, templateDetail, templates])
  const selectedTemplateBody = useMemo(() => (selectedTemplate ? extractTemplateBody(selectedTemplate) : ''), [selectedTemplate])
  const selectedPlaceholderKeys = useMemo(() => placeholderKeys(selectedTemplateBody), [selectedTemplateBody])
  const resolvedTemplateMessage = useMemo(() => applyTemplateVars(selectedTemplateBody, templateVars), [selectedTemplateBody, templateVars])
  const selectedExampleVars = useMemo(() => (selectedTemplate ? extractBodyExampleVars(selectedTemplate) : {}), [selectedTemplate])

  const webhookVerifyUrl = useMemo(() => {
    const base = webhookUrl.trim()
    if (!base) return ''
    const qs = new URLSearchParams()
    qs.set('hub.mode', 'subscribe')
    qs.set('hub.verify_token', verifyTokenTest.trim())
    qs.set('hub.challenge', verifyChallenge.trim())
    return `${base}${base.includes('?') ? '&' : '?'}${qs.toString()}`
  }, [verifyChallenge, verifyTokenTest, webhookUrl])

  const webhookVerifyCurl = useMemo(() => {
    if (!webhookVerifyUrl) return ''
    return `curl -i "${webhookVerifyUrl}"`
  }, [webhookVerifyUrl])

  useEffect(() => {
    if (testMode !== 'template') return
    if (!selectedTemplateId) return

    setTemplateVars((prev) => {
      const keys = selectedPlaceholderKeys
      if (keys.length === 0) return prev
      const next: Record<number, string> = {}
      for (const k of keys) {
        const fromPrev = prev[k]
        if (typeof fromPrev === 'string' && fromPrev.length > 0) {
          next[k] = fromPrev
          continue
        }
        const fromExample = selectedExampleVars[k]
        next[k] = typeof fromExample === 'string' ? fromExample : ''
      }
      return next
    })
  }, [selectedExampleVars, selectedPlaceholderKeys, selectedTemplateId, testMode])

  const onSave = async () => {
    setIsSaving(true)
    setLastRequest('')
    setLastResponse('')
    try {
      const payload = {
        enabled,
        provider: provider.trim() || undefined,
        phoneNumberId: phoneNumberId.trim() || undefined,
        businessAccountId: businessAccountId.trim() || undefined,
        accessToken: accessTokenField.trim() || undefined,
        verifyToken: verifyToken.trim() || undefined,
        webhookUrl: webhookUrl.trim() || undefined,
        defaultSender: defaultSender.trim() || undefined,
      }

      setLastRequest(safeJson({ action: 'saveSettings', url: endpoints.settings.whatsapp, payload }))
      const resp = await api.post(endpoints.settings.whatsapp, payload)
      setLastResponse(safeJson(resp))
      setInitial({
        enabled,
        provider,
        phoneNumberId,
        businessAccountId,
        accessToken: accessTokenField,
        verifyToken,
        webhookUrl,
        defaultSender,
      })
      toast.success('WhatsApp settings saved')
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('Save failed', { description: message })
    } finally {
      setIsSaving(false)
    }
  }

  const onSimulate = async () => {
    const to = testTo.trim()
    const message = testMode === 'template' ? resolvedTemplateMessage.trim() : testMessage.trim()

    if (!to || !message) {
      toast.error('Missing fields', { description: testMode === 'template' ? 'Choose a template, fill variables, and enter a recipient.' : 'Enter a recipient and a message.' })
      return
    }

    setIsSimulating(true)
    setLastRequest('')
    setLastResponse('')
    try {
      const payload = { to, message }
      setLastRequest(safeJson({ action: 'simulate', url: endpoints.settings.whatsappSimulate, payload, mode: testMode }))
      const resp = await api.post(endpoints.settings.whatsappSimulate, payload)
      setLastResponse(safeJson(resp))
      toast.success('Test message sent')
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('Simulation failed', { description: message })
    } finally {
      setIsSimulating(false)
    }
  }

  const onVerifyWebhook = async () => {
    const url = webhookVerifyUrl
    if (!url) {
      toast.error('Missing webhook URL', { description: 'Enter a Webhook URL first.' })
      return
    }
    if (!verifyTokenTest.trim()) {
      toast.error('Missing verify token', { description: 'Enter a Verify token to test verification.' })
      return
    }

    setIsVerifyingWebhook(true)
    setLastRequest('')
    setLastResponse('')
    try {
      setLastRequest(
        safeJson({
          action: 'webhookVerify',
          note: 'This is a browser GET (no auth headers). Meta will call your webhook similarly.',
          url,
          expected: verifyChallenge.trim() || '(challenge string)',
        }),
      )

      const resp = await fetch(url, { method: 'GET' })
      const text = await resp.text()
      setLastResponse(
        safeJson({
          ok: resp.ok,
          status: resp.status,
          statusText: resp.statusText,
          body: text,
          hint: resp.ok && text.trim() === verifyChallenge.trim() ? 'Looks good: challenge echoed.' : 'Expected the response body to equal hub.challenge.',
        }),
      )

      if (resp.ok && text.trim() === verifyChallenge.trim()) {
        toast.success('Webhook verification looks good')
      } else {
        toast.error('Verification did not match expected challenge')
      }
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(
        safeJson({
          error: message,
          hint: 'If this is a cross-origin URL, the browser may block it (CORS). Use the curl command instead.',
          curl: webhookVerifyCurl,
        }),
      )
      toast.error('Verification request failed', { description: message })
    } finally {
      setIsVerifyingWebhook(false)
    }
  }

  return (
    <AdminLayout
      title="Settings · WhatsApp"
      description="Configure WhatsApp integration and send a test message."
      actions={
        <div className="flex items-center gap-2">
          <Link href="/axis/settings">
            <Button variant="outline" size="sm">
              <CornerDownRight className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
          <Link href="/axis/settings/whatsapp/templates">
            <Button variant="outline" size="sm">Templates</Button>
          </Link>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>WhatsApp settings</CardTitle>
                <CardDescription>Manage credentials, webhooks, and defaults.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={connectionHint.variant}>{connectionHint.label}</Badge>
                {isDirty ? <Badge variant="secondary">unsaved</Badge> : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {initial ? 'Loaded from API.' : 'Not loaded.'}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={loadSettings} disabled={isLoadingSettings}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!initial) return
                    setEnabled(initial.enabled)
                    setProvider(initial.provider)
                    setPhoneNumberId(initial.phoneNumberId)
                    setBusinessAccountId(initial.businessAccountId)
                    setAccessTokenField(initial.accessToken)
                    setVerifyToken(initial.verifyToken)
                    setWebhookUrl(initial.webhookUrl)
                    setDefaultSender(initial.defaultSender)
                  }}
                  disabled={!initial || !isDirty}
                >
                  Reset changes
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Enabled</div>
                <div className="text-xs text-muted-foreground">Turns WhatsApp messaging on/off.</div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="meta" />
              </div>
              <div className="space-y-2">
                <Label>Default sender</Label>
                <Input value={defaultSender} onChange={(e) => setDefaultSender(e.target.value)} placeholder="e.g. Support" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone number ID</Label>
                <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="" />
              </div>
              <div className="space-y-2">
                <Label>Business account ID</Label>
                <Input value={businessAccountId} onChange={(e) => setBusinessAccountId(e.target.value)} placeholder="" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Access token</Label>
                <Input type="password" value={accessTokenField} onChange={(e) => setAccessTokenField(e.target.value)} placeholder="" />
                <div className="text-xs text-muted-foreground">Required to send messages.</div>
              </div>
              <div className="space-y-2">
                <Label>Verify token</Label>
                <Input type="password" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} placeholder="" />
                <div className="text-xs text-muted-foreground">Used for webhook verification.</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..." />
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium">Webhook setup (guided)</div>
                <div className="text-xs text-muted-foreground">
                  Use this to connect Meta webhook verification to your callback URL.
                </div>
              </div>

              <Alert>
                <AlertTitle>What Meta expects</AlertTitle>
                <AlertDescription>
                  Meta will call your <span className="font-medium">Webhook URL</span> with query params
                  <span className="font-mono text-xs"> hub.mode</span>, <span className="font-mono text-xs">hub.verify_token</span>,
                  and <span className="font-mono text-xs">hub.challenge</span>. Your server must respond with the raw challenge value.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Test verify token</Label>
                  <Input type="text" value={verifyTokenTest} onChange={(e) => setVerifyTokenTest(e.target.value)} placeholder="(should match Verify token)" />
                  <div className="text-xs text-muted-foreground">For testing the verification flow (should match what you set in Meta).</div>
                </div>
                <div className="space-y-2">
                  <Label>Challenge</Label>
                  <Input type="text" value={verifyChallenge} onChange={(e) => setVerifyChallenge(e.target.value)} placeholder="123456" />
                  <div className="text-xs text-muted-foreground">Expected response body for a successful verification.</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Verification URL preview</Label>
                <Textarea
                  value={webhookVerifyUrl}
                  readOnly
                  className="min-h-[90px] font-mono text-xs"
                  placeholder="Enter Webhook URL + Verify token to generate a preview."
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  If verification URL is cross-origin, the browser may block it. Use curl.
                </div>
                <div className="flex items-center gap-2">
                  <a
                    className="text-xs underline text-muted-foreground hover:text-foreground"
                    href="http://localhost:8090/api/docs#/WhatsApp%3A%20Webhook/WhatsappWebhookController_verify_v1"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Swagger verify docs
                  </a>
                  <Button type="button" variant="outline" size="sm" onClick={onVerifyWebhook} disabled={isVerifyingWebhook || !webhookUrl.trim()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Test verification
                  </Button>
                </div>
              </div>

              {webhookVerifyCurl ? (
                <div className="space-y-2">
                  <Label>curl fallback</Label>
                  <Textarea value={webhookVerifyCurl} readOnly className="min-h-[60px] font-mono text-xs" />
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end">
              <Button onClick={onSave} disabled={isSaving || !isDirty}>
                <Save className="h-4 w-4 mr-2" />
                Save settings
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium">Simulator</div>
                <div className="text-xs text-muted-foreground">Send a test message using free text or an existing template.</div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>To (E.164)</Label>
                  <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+2547..." />
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select value={testMode} onValueChange={(v) => setTestMode(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="freeText">Free text</SelectItem>
                      <SelectItem value="template">From template</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {testMode === 'freeText' ? (
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} className="min-h-[110px]" placeholder="Hello from Axis" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Template</Label>
                      <Select
                        value={selectedTemplateId}
                        onValueChange={(v) => {
                          setSelectedTemplateId(v)
                          setTemplateVars({})
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.length === 0 ? (
                            <SelectItem value="__none__" disabled>
                              No active templates
                            </SelectItem>
                          ) : null}
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={loadTemplates} disabled={isLoadingTemplates}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh templates
                        </Button>
                        <div className="text-xs text-muted-foreground">
                          {selectedTemplate
                            ? `${selectedTemplate.language || '—'} · ${selectedTemplate.status || '—'}`
                            : 'Choose a template to continue.'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Variables</Label>
                      <ScrollArea className="h-[140px] rounded-md border p-2">
                        {selectedTemplateBody ? (
                          selectedPlaceholderKeys.length === 0 ? (
                            <div className="text-xs text-muted-foreground p-2">No variables detected in template body.</div>
                          ) : (
                            <div className="space-y-2">
                              {selectedPlaceholderKeys.map((k) => (
                                <div key={k} className="grid grid-cols-[72px_1fr] items-center gap-2">
                                  <div className="text-xs text-muted-foreground">{`{{${k}}}`}</div>
                                  <Input
                                    value={templateVars[k] || ''}
                                    onChange={(e) => setTemplateVars((prev) => ({ ...prev, [k]: e.target.value }))}
                                    placeholder={`Value for {{${k}}}`}
                                  />
                                </div>
                              ))}
                            </div>
                          )
                        ) : (
                          <div className="text-xs text-muted-foreground p-2">
                            {selectedTemplateId ? 'Template body not available (yet). Try refreshing templates or check template details.' : 'Select a template first.'}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <Textarea value={resolvedTemplateMessage} readOnly className="min-h-[120px] font-mono text-xs" placeholder="(preview will appear here)" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end">
                <Button
                  variant="outline"
                  onClick={onSimulate}
                  disabled={
                    isSimulating ||
                    !testTo.trim() ||
                    (testMode === 'freeText' ? !testMessage.trim() : !resolvedTemplateMessage.trim())
                  }
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug</CardTitle>
            <CardDescription>Last request and response payloads.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Last request</Label>
                <Textarea value={lastRequest} readOnly className="min-h-[180px] font-mono text-xs" placeholder="(empty)" />
              </div>
              <div className="space-y-2">
                <Label>Last response</Label>
                <Textarea value={lastResponse} readOnly className="min-h-[220px] font-mono text-xs" placeholder="(empty)" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
