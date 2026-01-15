import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { CornerDownRight, Loader2, Save, Send } from 'lucide-react'
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

export function AdminSettingsSmsPage() {
  const { accessToken } = useAdminAuth()
  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])

  const [enabled, setEnabled] = useState(true)
  const [provider, setProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [senderId, setSenderId] = useState('')
  const [from, setFrom] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [lastResponse, setLastResponse] = useState('')

  const [testTo, setTestTo] = useState('')
  const [testMessage, setTestMessage] = useState('')

  const onSave = async () => {
    setIsSaving(true)
    setLastResponse('')
    try {
      const resp = await api.post(endpoints.settings.sms, {
        enabled,
        provider: provider.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
        apiSecret: apiSecret.trim() || undefined,
        senderId: senderId.trim() || undefined,
        from: from.trim() || undefined,
      })
      setLastResponse(safeJson(resp))
      toast.success('SMS settings saved')
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('Save failed', { description: message })
    } finally {
      setIsSaving(false)
    }
  }

  const onSimulate = async () => {
    if (!testTo.trim() || !testMessage.trim()) {
      toast.error('Missing fields', { description: 'Enter a recipient and a message.' })
      return
    }

    setIsSimulating(true)
    setLastResponse('')
    try {
      const resp = await api.post(endpoints.settings.smsSimulate, {
        to: testTo.trim(),
        message: testMessage.trim(),
      })
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

  return (
    <AdminLayout
      title="Settings · SMS"
      description="Configure SMS provider settings and send a test message."
      actions={
        <Link href="/axis/settings">
          <Button variant="outline" size="sm">
            <CornerDownRight className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>SMS settings</CardTitle>
            <CardDescription>Manage provider credentials and defaults.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Enabled</div>
                <div className="text-xs text-muted-foreground">Turns SMS sending on/off.</div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="" />
              </div>
              <div className="space-y-2">
                <Label>Sender ID</Label>
                <Input value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder="AXIS" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>API key</Label>
                <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="" />
              </div>
              <div className="space-y-2">
                <Label>API secret</Label>
                <Input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>From</Label>
              <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="" />
            </div>

            <div className="flex items-center justify-end">
              <Button onClick={onSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save settings
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium">Simulator</div>
                <div className="text-xs text-muted-foreground">Send a test SMS using the current settings.</div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+2547..." />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="Hello from Axis" />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Button variant="outline" onClick={onSimulate} disabled={isSimulating || !testTo.trim() || !testMessage.trim()}>
                  {isSimulating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last response</CardTitle>
            <CardDescription>Response payload from the API.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={lastResponse} readOnly className="min-h-[420px] font-mono text-xs" placeholder="(empty)" />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
