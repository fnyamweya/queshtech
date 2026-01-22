import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { CornerDownRight, KeyRound, RefreshCcw, Save } from 'lucide-react'
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

type S3ResponseDto = {
  s3Endpoint?: string
  s3Region: string
  bucketName: string
  forcePathStyle: boolean
  s3Enabled: boolean
  s3PublicBaseUrl?: string
  s3PublicDevBaseUrl?: string
  hasAccessKeyId: boolean
  hasSecretAccessKey: boolean
  createdAt: string
  updatedAt: string
}

export function AdminSettingsR2Page() {
  const { accessToken } = useAdminAuth()
  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])

  const [enabled, setEnabled] = useState(true)
  const [endpoint, setEndpoint] = useState('')
  const [region, setRegion] = useState('')
  const [bucketName, setBucketName] = useState('')
  const [forcePathStyle, setForcePathStyle] = useState(false)
  const [publicBaseUrl, setPublicBaseUrl] = useState('')
  const [publicDevBaseUrl, setPublicDevBaseUrl] = useState('')

  const [hasAccessKeyId, setHasAccessKeyId] = useState<boolean | null>(null)
  const [hasSecretAccessKey, setHasSecretAccessKey] = useState<boolean | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState('')

  const [accessKeyId, setAccessKeyId] = useState('')
  const [secretAccessKey, setSecretAccessKey] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingSecrets, setIsSavingSecrets] = useState(false)
  const [lastResponse, setLastResponse] = useState('')

  const load = async () => {
    setIsLoading(true)
    setLastResponse('')
    try {
      const resp = await api.get<S3ResponseDto>(endpoints.settings.r2)
      setLastResponse(safeJson(resp))

      setEnabled(Boolean(resp?.s3Enabled))
      setEndpoint(resp?.s3Endpoint || '')
      setRegion(resp?.s3Region || '')
      setBucketName(resp?.bucketName || '')
      setForcePathStyle(Boolean(resp?.forcePathStyle))
      setPublicBaseUrl(resp?.s3PublicBaseUrl || '')
      setPublicDevBaseUrl(resp?.s3PublicDevBaseUrl || '')

      setHasAccessKeyId(Boolean(resp?.hasAccessKeyId))
      setHasSecretAccessKey(Boolean(resp?.hasSecretAccessKey))
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
        s3Endpoint: endpoint.trim() || undefined,
        s3Region: region.trim(),
        bucketName: bucketName.trim(),
        forcePathStyle: Boolean(forcePathStyle),
        s3Enabled: Boolean(enabled),
        s3PublicBaseUrl: publicBaseUrl.trim() || undefined,
        s3PublicDevBaseUrl: publicDevBaseUrl.trim() || undefined,
      }
      const resp = await api.post(endpoints.settings.r2, payload)
      setLastResponse(safeJson(resp))
      toast.success('R2 settings saved')
      await load()
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('Save failed', { description: message })
    } finally {
      setIsSaving(false)
    }
  }

  const onSaveSecrets = async () => {
    const nextAccessKeyId = accessKeyId.trim()
    const nextSecretAccessKey = secretAccessKey.trim()

    if (!nextAccessKeyId && !nextSecretAccessKey) {
      toast.error('Nothing to update', { description: 'Enter an access key id and/or secret access key.' })
      return
    }

    setIsSavingSecrets(true)
    setLastResponse('')
    try {
      const payload = {
        accessKeyId: nextAccessKeyId || undefined,
        secretAccessKey: nextSecretAccessKey || undefined,
      }
      const resp = await api.post(endpoints.settings.r2Secrets, payload)
      setLastResponse(safeJson(resp))
      toast.success('R2 credentials updated')

      setAccessKeyId('')
      setSecretAccessKey('')
      await load()
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('Update failed', { description: message })
    } finally {
      setIsSavingSecrets(false)
    }
  }

  return (
    <AdminLayout
      title="Settings · R2"
      description="Configure Cloudflare R2 (S3-compatible) object storage and credentials."
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
              <CardTitle>R2 configuration</CardTitle>
              <CardDescription>Connection settings used by uploads and downloads.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Enabled</div>
                  <div className="text-xs text-muted-foreground">Turns object storage on/off.</div>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Endpoint</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://<accountid>.r2.cloudflarestorage.com"
                  />
                  <div className="text-xs text-muted-foreground">Required for R2. Use your Cloudflare R2 S3 API endpoint.</div>
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="auto" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Public base URL</Label>
                <Input
                  value={publicBaseUrl}
                  onChange={(e) => setPublicBaseUrl(e.target.value)}
                  placeholder="https://media.example.com"
                />
                <div className="text-xs text-muted-foreground">
                  Optional. Used to build public URLs for uploaded files (e.g. a CDN/custom domain).
                </div>
              </div>

              <div className="space-y-2">
                <Label>Public development base URL (r2.dev)</Label>
                <Input
                  value={publicDevBaseUrl}
                  onChange={(e) => setPublicDevBaseUrl(e.target.value)}
                  placeholder="https://pub-xxxxxxxxxxxxxxxx.r2.dev"
                />
                <div className="text-xs text-muted-foreground">
                  Optional. Exposes this bucket via the R2 Public Development URL when enabled.
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bucket name</Label>
                  <Input value={bucketName} onChange={(e) => setBucketName(e.target.value)} placeholder="my-app-bucket" />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">Force path style</div>
                    <div className="text-xs text-muted-foreground">Toggle if your R2 endpoint requires it.</div>
                  </div>
                  <Switch checked={forcePathStyle} onCheckedChange={setForcePathStyle} />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Button onClick={onSave} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  Save configuration
                </Button>
              </div>

              {lastUpdatedAt ? <div className="text-xs text-muted-foreground">Last updated: {lastUpdatedAt}</div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credentials</CardTitle>
              <CardDescription>Use your R2 Access Key ID and Secret Access Key. Stored encrypted at rest; values are never returned.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Access key ID</Label>
                  <Input value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} placeholder="AKIA..." />
                  {hasAccessKeyId !== null ? (
                    <div className="text-xs text-muted-foreground">Currently set: {hasAccessKeyId ? 'yes' : 'no'}</div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Secret access key</Label>
                  <Input
                    type="password"
                    value={secretAccessKey}
                    onChange={(e) => setSecretAccessKey(e.target.value)}
                    placeholder="••••••••"
                  />
                  {hasSecretAccessKey !== null ? (
                    <div className="text-xs text-muted-foreground">Currently set: {hasSecretAccessKey ? 'yes' : 'no'}</div>
                  ) : null}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-end">
                <Button variant="outline" onClick={onSaveSecrets} disabled={isSavingSecrets}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Update credentials
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Last response</CardTitle>
            <CardDescription>Response payload from the API.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={lastResponse} readOnly className="min-h-[540px] font-mono text-xs" placeholder="(empty)" />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
