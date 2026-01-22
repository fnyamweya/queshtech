import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { CornerDownRight, KeyRound, Plus, RefreshCcw, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, getApiBaseUrl } from '@/lib/api'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import { useAdminAuth } from '@/hooks/use-admin-auth'

type GoogleOAuthProfileDto = {
  id?: string
  key?: string
  name?: string
  clientId?: string
  callbackUrl?: string
  allowedRoleIds?: string[]
  allowedDomains?: string[]
  hasClientSecret?: boolean
}

type AppleOAuthConfigDto = {
  clientId?: string
  teamId?: string
  keyId?: string
  callbackUrl?: string
  hasPrivateKey?: boolean
}

type AppleOAuthSecretResponseDto = {
  hasPrivateKey: boolean
}

type Role = {
  id: string
  name: string
  description?: string
}

function normalizeRolesResponse(payload: any): Role[] {
  // Canonical expected shape (per sample): { success: true, data: Role[] }
  if (payload && typeof payload === 'object' && Array.isArray((payload as any).data)) {
    return (payload as any).data
      .map((r: any) => {
        const id = String(r?.id ?? '')
        const name = String(r?.name ?? '')
        return {
          id,
          name,
          description: r?.description ? String(r.description) : undefined,
        } satisfies Role
      })
      .filter((r: Role) => Boolean(r.id) && Boolean(r.name))
  }

  // The backend may wrap results in one or more { data: ... } envelopes.
  let data: any = payload
  for (let i = 0; i < 4; i++) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) break
    if (!('data' in data)) break
    const next = (data as any).data
    if (next === undefined) break
    data = next
  }

  const items =
    data?.items ??
    data?.results ??
    data?.roles ??
    data?.data?.items ??
    data?.data?.results ??
    data?.data?.roles ??
    data

  if (!Array.isArray(items)) return []

  return items
    .map((r: any) => {
      const id = String(r?.id ?? r?._id ?? r?.uuid ?? r?.roleId ?? '')
      const name = String(r?.name ?? r?.title ?? r?.roleName ?? r?.displayName ?? r?.code ?? '')

      return {
        id,
        name,
        description: r?.description ? String(r.description) : undefined,
      } satisfies Role
    })
    .filter((r: Role) => Boolean(r.id) && Boolean(r.name))
}

function normalizeDomain(value: string) {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return ''
  if (trimmed.startsWith('@')) return trimmed.slice(1)
  return trimmed
}

function getOAuthCallbackOrigin() {
  // OAuth callback URLs must point to the API host (NOT the /api/v1 base path).
  // - In local dev, API is proxied through Vite, so same-origin works.
  // - In split-host deployments, VITE_API_BASE_URL is typically absolute; use its origin.
  const apiBase = getApiBaseUrl()
  if (apiBase && /^https?:\/\//i.test(apiBase)) {
    try {
      return new URL(apiBase).origin
    } catch {
      // fall through
    }
  }

  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function AdminSettingsOAuthPage() {
  const { accessToken, authorizedRequest } = useAdminAuth()
  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])

  const [tab, setTab] = useState<'google' | 'apple'>('google')

  const axisGoogleCallbackBaseHint = useMemo(() => {
    const callbackPathTemplate = '/auth/<key>/google/callback'
    if (typeof window === 'undefined') return callbackPathTemplate

    // Callback URL is a BACKEND route and must match the Google Console redirect URI.
    const origin = getOAuthCallbackOrigin().replace(/\/$/, '')
    return origin ? `${origin}${callbackPathTemplate}` : callbackPathTemplate
  }, [])

  const [isLoading, setIsLoading] = useState(false)

  const [roles, setRoles] = useState<Role[]>([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(false)

  // Google (multi-profile)
  const [googleProfiles, setGoogleProfiles] = useState<GoogleOAuthProfileDto[]>([])
  const [selectedGoogleProfileId, setSelectedGoogleProfileId] = useState<string | null>(null)

  const [googleKey, setGoogleKey] = useState('')
  const [googleName, setGoogleName] = useState('')
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleCallbackUrl, setGoogleCallbackUrl] = useState('')
  const [googleAllowedRoleIds, setGoogleAllowedRoleIds] = useState<string[]>([])
  const [isRolesPickerOpen, setIsRolesPickerOpen] = useState(false)
  const [googleAllowedDomains, setGoogleAllowedDomains] = useState<string[]>([])
  const [googleDomainDraft, setGoogleDomainDraft] = useState('')

  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [isSavingGoogleProfile, setIsSavingGoogleProfile] = useState(false)
  const [isSavingGoogleSecret, setIsSavingGoogleSecret] = useState(false)

  const axisGoogleCallbackRecommendedHint = useMemo(() => {
    const key = googleKey.trim()
    if (!key) return axisGoogleCallbackBaseHint

    const origin = getOAuthCallbackOrigin().replace(/\/$/, '')
    if (!origin) return `/auth/${encodeURIComponent(key)}/google/callback`
    return `${origin}/auth/${encodeURIComponent(key)}/google/callback`
  }, [axisGoogleCallbackBaseHint, googleKey])

  // Apple (non-secret)
  const [appleClientId, setAppleClientId] = useState('')
  const [appleTeamId, setAppleTeamId] = useState('')
  const [appleKeyId, setAppleKeyId] = useState('')
  const [appleCallbackUrl, setAppleCallbackUrl] = useState('')
  const [hasApplePrivateKey, setHasApplePrivateKey] = useState<boolean | null>(null)

  // Apple (secret)
  const [applePrivateKey, setApplePrivateKey] = useState('')
  const [isSavingApple, setIsSavingApple] = useState(false)
  const [isSavingAppleSecret, setIsSavingAppleSecret] = useState(false)

  const setGoogleEditorFromProfile = (profile: GoogleOAuthProfileDto | null) => {
    if (!profile) {
      setSelectedGoogleProfileId(null)
      setGoogleKey('')
      setGoogleName('')
      setGoogleClientId('')
      setGoogleCallbackUrl('')
      setGoogleAllowedRoleIds([])
      setGoogleAllowedDomains([])
      setGoogleDomainDraft('')
      setGoogleClientSecret('')
      return
    }

    setSelectedGoogleProfileId(profile.id || null)
    setGoogleKey(profile.key || '')
    setGoogleName(profile.name || '')
    setGoogleClientId(profile.clientId || '')
    setGoogleCallbackUrl(profile.callbackUrl || '')
    setGoogleAllowedRoleIds(Array.isArray(profile.allowedRoleIds) ? profile.allowedRoleIds.filter(Boolean) : [])
    setGoogleAllowedDomains(Array.isArray(profile.allowedDomains) ? profile.allowedDomains.filter(Boolean) : [])
    setGoogleDomainDraft('')
    setGoogleClientSecret('')
  }

  // Auto-suggest distinct callbacks for new profiles.
  useEffect(() => {
    if (selectedGoogleProfileId) return
    const key = googleKey.trim()
    if (!key) return

    const current = googleCallbackUrl.trim()
    if (!current || current === axisGoogleCallbackBaseHint) {
      setGoogleCallbackUrl(axisGoogleCallbackRecommendedHint)
    }
  }, [axisGoogleCallbackBaseHint, axisGoogleCallbackRecommendedHint, googleCallbackUrl, googleKey, selectedGoogleProfileId])

  const load = async () => {
    setIsLoading(true)
    setIsLoadingRoles(true)
    try {
      const [googleResult, appleResult, rolesResult] = await Promise.allSettled([
        api.get<any>(endpoints.settings.oauthGoogleProfiles),
        api.get<any>(endpoints.settings.oauthApple),
        authorizedRequest<any>(endpoints.roles.list('getAll=true'), { method: 'GET' }),
      ])

      if (rolesResult.status === 'fulfilled') {
        const nextRoles = normalizeRolesResponse(rolesResult.value).sort((a, b) => a.name.localeCompare(b.name))
        setRoles(nextRoles)
      } else {
        toast.error('Failed to load roles', { description: 'Please try again.' })
      }

      if (googleResult.status === 'fulfilled') {
        const googlePayload = googleResult.value
        const googleList: GoogleOAuthProfileDto[] = Array.isArray(googlePayload)
          ? googlePayload
          : Array.isArray(googlePayload?.data)
            ? googlePayload.data
            : []

        setGoogleProfiles(googleList)

        // Preserve current selection if possible, else pick first, else reset.
        const existingSelected = selectedGoogleProfileId ? googleList.find((p) => p?.id === selectedGoogleProfileId) : null
        if (existingSelected) {
          setGoogleEditorFromProfile(existingSelected)
        } else if (googleList.length > 0) {
          setGoogleEditorFromProfile(googleList[0])
        } else {
          setGoogleEditorFromProfile(null)
        }
      } else {
        // Keep current editor state; just signal failure.
        toast.error('Failed to load Google OAuth profiles', { description: 'Please try again.' })
      }

      if (appleResult.status === 'fulfilled') {
        const applePayload = appleResult.value
        const apple = (applePayload?.data ?? applePayload) as AppleOAuthConfigDto
        setAppleClientId(apple?.clientId || '')
        setAppleTeamId(apple?.teamId || '')
        setAppleKeyId(apple?.keyId || '')
        setAppleCallbackUrl(apple?.callbackUrl || '')
        setHasApplePrivateKey(typeof apple?.hasPrivateKey === 'boolean' ? apple.hasPrivateKey : null)
      } else {
        toast.error('Failed to load Apple OAuth settings', { description: 'Please try again.' })
      }
    } catch (e: any) {
      toast.error('Failed to load OAuth settings', { description: 'Please try again.' })
    } finally {
      setIsLoadingRoles(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [accessToken])

  const validateGoogleCallbackUrl = (callbackUrl: string) => {
    const key = googleKey.trim()
    const requiredPath = `/auth/${key}/google/callback`
    const expectedFull = axisGoogleCallbackRecommendedHint
    try {
      const asUrl = callbackUrl.startsWith('http') ? new URL(callbackUrl) : new URL(callbackUrl, window.location.origin)
      if (!key || asUrl.pathname !== requiredPath) {
        toast.error('Invalid Google callback URL', {
          description: `Use ${expectedFull} (this must match the Google Console redirect URI).`,
        })
        return false
      }
      return true
    } catch {
      toast.error('Invalid Google callback URL', {
        description: `Use ${expectedFull} (this must match the Google Console redirect URI).`,
      })
      return false
    }
  }

  const saveGoogleProfile = async () => {
    const key = googleKey.trim()
    const name = googleName.trim()
    const clientId = googleClientId.trim()
    const callbackUrl = googleCallbackUrl.trim()
    const allowedRoleIds = Array.from(new Set(googleAllowedRoleIds.map(String).filter(Boolean)))
    const allowedDomains = Array.from(new Set(googleAllowedDomains.map(normalizeDomain).filter(Boolean)))

    if (!key) {
      toast.error('Profile key is required')
      return
    }
    if (!name) {
      toast.error('Profile name is required')
      return
    }
    if (!clientId) {
      toast.error('Google client id is required')
      return
    }
    if (!callbackUrl) {
      toast.error('Google callback URL is required')
      return
    }
    if (!validateGoogleCallbackUrl(callbackUrl)) return

    if (!allowedRoleIds.length) {
      toast.error('Select at least one allowed role', {
        description: 'This is required so the API can decide whether this profile is for Axis (admin) or Storefront (customer).',
      })
      return
    }

    setIsSavingGoogleProfile(true)
    try {
      const body = { key, name, clientId, callbackUrl, allowedRoleIds, allowedDomains }

      let saved: GoogleOAuthProfileDto | null = null
      if (selectedGoogleProfileId) {
        saved = await api.patch<GoogleOAuthProfileDto>(endpoints.settings.oauthGoogleProfileById(selectedGoogleProfileId), body)
      } else {
        saved = await api.post<GoogleOAuthProfileDto>(endpoints.settings.oauthGoogleProfiles, body)
      }

      toast.success('Google OAuth profile saved')
      if (saved?.id) setSelectedGoogleProfileId(saved.id)
      await load()
    } catch (e: unknown) {
      const status = e instanceof ApiError ? e.status : undefined
      const message = e instanceof Error ? e.message : ''

      const isDuplicateKey =
        status === 409 ||
        (message.length > 0 && /\bkey\b/i.test(message) && /duplicate|exists|unique|taken|already/i.test(message))

      if (isDuplicateKey) {
        toast.error('Profile key already in use', {
          description: 'Choose a different key and try again.',
        })
      } else {
        toast.error('Failed to save Google OAuth profile', { description: 'Please try again.' })
      }
    } finally {
      setIsSavingGoogleProfile(false)
    }
  }

  const saveGoogleSecret = async () => {
    const clientSecret = googleClientSecret.trim()

    if (!selectedGoogleProfileId) {
      toast.error('Select a profile to update its secret')
      return
    }
    if (!clientSecret) {
      toast.error('Google client secret is required')
      return
    }

    setIsSavingGoogleSecret(true)
    try {
      await api.post<GoogleOAuthProfileDto>(endpoints.settings.oauthGoogleProfileSecret(selectedGoogleProfileId), { clientSecret })
      setGoogleClientSecret('')
      toast.success('Google OAuth secret updated')
      // Reload to refresh hasClientSecret per profile.
      await load()
    } catch {
      toast.error('Failed to save Google OAuth secret', { description: 'Please try again.' })
    } finally {
      setIsSavingGoogleSecret(false)
    }
  }

  const selectedRoles = useMemo(() => {
    const byId = new Map<string, Role>()
    for (const r of roles) byId.set(r.id, r)
    return googleAllowedRoleIds.map((id) => byId.get(id)).filter(Boolean) as Role[]
  }, [googleAllowedRoleIds, roles])

  const toggleRole = (roleId: string) => {
    setGoogleAllowedRoleIds((prev) => {
      const set = new Set(prev)
      if (set.has(roleId)) set.delete(roleId)
      else set.add(roleId)
      return Array.from(set)
    })
  }

  const addDomain = () => {
    const normalized = normalizeDomain(googleDomainDraft)
    if (!normalized) return
    setGoogleAllowedDomains((prev) => {
      const set = new Set(prev.map(normalizeDomain).filter(Boolean))
      set.add(normalized)
      return Array.from(set)
    })
    setGoogleDomainDraft('')
  }

  const removeDomain = (domain: string) => {
    const normalized = normalizeDomain(domain)
    setGoogleAllowedDomains((prev) => prev.map(normalizeDomain).filter((d) => d && d !== normalized))
  }

  const saveApple = async () => {
    const clientId = appleClientId.trim()
    const teamId = appleTeamId.trim()
    const keyId = appleKeyId.trim()
    const callbackUrl = appleCallbackUrl.trim()

    if (!clientId) {
      toast.error('Apple client id is required')
      return
    }
    if (!teamId) {
      toast.error('Apple team id is required')
      return
    }
    if (!keyId) {
      toast.error('Apple key id is required')
      return
    }
    if (!callbackUrl) {
      toast.error('Apple callback URL is required')
      return
    }

    setIsSavingApple(true)
    try {
      await api.post(endpoints.settings.oauthApple, { clientId, teamId, keyId, callbackUrl })
      toast.success('Apple OAuth settings saved')
      await load()
    } catch (e: any) {
      toast.error('Failed to save Apple OAuth settings', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSavingApple(false)
    }
  }

  const saveAppleSecret = async () => {
    const privateKey = applePrivateKey.trim()

    if (!privateKey) {
      toast.error('Apple private key is required')
      return
    }

    setIsSavingAppleSecret(true)
    try {
      const resp = await api.post<AppleOAuthSecretResponseDto>(endpoints.settings.oauthAppleSecret, { privateKey })
      setHasApplePrivateKey(Boolean(resp?.hasPrivateKey))
      setApplePrivateKey('')
      toast.success('Apple OAuth private key updated')
    } catch (e: any) {
      toast.error('Failed to save Apple OAuth private key', { description: e?.message || 'Please try again.' })
    } finally {
      setIsSavingAppleSecret(false)
    }
  }

  return (
    <AdminLayout title="Settings · OAuth" description="Configure admin OAuth credentials for Google and Apple.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <Link href="/axis/settings">
            <Button variant="outline" size="sm">
              <CornerDownRight className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'google' | 'apple')}>
          <TabsList>
            <TabsTrigger value="google">Google</TabsTrigger>
            <TabsTrigger value="apple">Apple</TabsTrigger>
          </TabsList>

          <TabsContent value="google">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Google OAuth
                </CardTitle>
                <CardDescription>Manage Google sign-in profiles.</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-6 sm:grid-cols-[320px_1fr]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Profiles</div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setGoogleEditorFromProfile(null)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New profile
                    </Button>
                  </div>

                  {googleProfiles.length === 0 ? (
                    <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">No profiles yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {googleProfiles
                        .slice()
                        .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''))
                        .map((p) => {
                          const isActive = Boolean(p?.id) && p.id === selectedGoogleProfileId
                          const roleCount = Array.isArray(p?.allowedRoleIds) ? p.allowedRoleIds.filter(Boolean).length : 0
                          const domainCount = Array.isArray(p?.allowedDomains) ? p.allowedDomains.filter(Boolean).length : 0

                          return (
                            <button
                              key={p?.id || p?.name || Math.random()}
                              type="button"
                              onClick={() => setGoogleEditorFromProfile(p)}
                              className={
                                'w-full rounded-md border p-3 text-left hover:bg-muted/40 ' +
                                (isActive ? 'border-primary bg-muted/20' : 'border-border')
                              }
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{p?.name || 'Unnamed'}</div>
                                  {p?.key ? <div className="mt-0.5 text-xs text-muted-foreground">Key: {p.key}</div> : null}
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {roleCount === 0 ? 'No roles (blocked)' : `${roleCount} role${roleCount === 1 ? '' : 's'}`} •{' '}
                                    {domainCount === 0 ? 'All domains' : `${domainCount} domain${domainCount === 1 ? '' : 's'}`}
                                  </div>
                                </div>

                                {typeof p?.hasClientSecret === 'boolean' ? (
                                  <Badge variant={p.hasClientSecret ? 'secondary' : 'outline'}>
                                    {p.hasClientSecret ? 'Secret set' : 'No secret'}
                                  </Badge>
                                ) : null}
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">Profile details</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedGoogleProfileId ? 'Editing an existing profile.' : 'Creating a new profile.'}
                      </div>
                    </div>
                    {selectedGoogleProfileId ? <Badge variant="secondary">Existing</Badge> : <Badge variant="outline">New</Badge>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Key</Label>
                      <Input
                        value={googleKey}
                        onChange={(e) => setGoogleKey(e.target.value)}
                        placeholder="axis-admin"
                        disabled={Boolean(selectedGoogleProfileId)}
                      />
                      <div className="text-xs text-muted-foreground">
                        A unique identifier for this profile.
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Profile name</Label>
                      <Input value={googleName} onChange={(e) => setGoogleName(e.target.value)} placeholder="Default" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <Input
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      placeholder="123.apps.googleusercontent.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Callback URL</Label>
                    <Input
                      value={googleCallbackUrl}
                      onChange={(e) => setGoogleCallbackUrl(e.target.value)}
                      placeholder={axisGoogleCallbackBaseHint}
                    />
                    <div className="text-xs text-muted-foreground">Recommended: {axisGoogleCallbackRecommendedHint}</div>
                    <div className="text-xs text-muted-foreground">
                      This must be the backend route <span className="font-mono">/auth/&lt;key&gt;/google/callback</span> (do not include <span className="font-mono">/api/v1</span>).
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Allowed roles</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedRoles.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Select at least one role (required).</div>
                      ) : (
                        selectedRoles.map((r) => (
                          <Badge key={r.id} variant="secondary" className="flex items-center gap-1">
                            {r.name}
                            <button type="button" onClick={() => toggleRole(r.id)} className="ml-1">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>

                    <Popover open={isRolesPickerOpen} onOpenChange={setIsRolesPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" disabled={isLoadingRoles || isLoading}>
                          Select roles
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search roles..." />
                          <CommandList>
                            <CommandEmpty>No roles found.</CommandEmpty>
                            {roles.map((r) => {
                              const selected = googleAllowedRoleIds.includes(r.id)
                              return (
                                <CommandItem
                                  key={r.id}
                                  value={`${r.name}${r.description ? ` ${r.description}` : ''}`}
                                  onSelect={() => {
                                    toggleRole(r.id)
                                  }}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                      <span className={selected ? 'font-medium' : ''}>{r.name}</span>
                                      {r.description ? <span className="text-xs text-muted-foreground">{r.description}</span> : null}
                                    </div>
                                    {selected ? <Badge variant="secondary">Selected</Badge> : null}
                                  </div>
                                </CommandItem>
                              )
                            })}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Allowed domains</Label>
                    <div className="flex flex-wrap gap-2">
                      {googleAllowedDomains.length === 0 ? (
                        <div className="text-sm text-muted-foreground">All domains allowed.</div>
                      ) : (
                        googleAllowedDomains.map((d) => (
                          <Badge key={d} variant="secondary" className="flex items-center gap-1">
                            {normalizeDomain(d)}
                            <button type="button" onClick={() => removeDomain(d)} className="ml-1">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={googleDomainDraft}
                        onChange={(e) => setGoogleDomainDraft(e.target.value)}
                        placeholder="example.com"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addDomain()
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={addDomain}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" onClick={saveGoogleProfile} disabled={isSavingGoogleProfile || isLoading}>
                      <Save className="h-4 w-4 mr-2" />
                      Save profile
                    </Button>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <Label>Client secret</Label>
                      <Input
                        value={googleClientSecret}
                        onChange={(e) => setGoogleClientSecret(e.target.value)}
                        placeholder={selectedGoogleProfileId ? 'Paste a new secret' : 'Save the profile first'}
                        disabled={!selectedGoogleProfileId}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={saveGoogleSecret}
                        disabled={!selectedGoogleProfileId || isSavingGoogleSecret || isLoading}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save secret
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apple">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Apple OAuth
                </CardTitle>
                <CardDescription>Manage Apple sign-in configuration.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <Input value={appleClientId} onChange={(e) => setAppleClientId(e.target.value)} placeholder="Client id" />
                  </div>
                  <div className="space-y-2">
                    <Label>Team ID</Label>
                    <Input value={appleTeamId} onChange={(e) => setAppleTeamId(e.target.value)} placeholder="Team id" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Key ID</Label>
                    <Input value={appleKeyId} onChange={(e) => setAppleKeyId(e.target.value)} placeholder="Key id" />
                  </div>
                  <div className="space-y-2">
                    <Label>Callback URL</Label>
                    <Input value={appleCallbackUrl} onChange={(e) => setAppleCallbackUrl(e.target.value)} placeholder="Callback url" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">
                    Private key:{' '}
                    {hasApplePrivateKey === null ? (
                      <span className="text-muted-foreground">Unknown</span>
                    ) : hasApplePrivateKey ? (
                      <Badge variant="secondary">Set</Badge>
                    ) : (
                      <Badge variant="outline">Not set</Badge>
                    )}
                  </div>
                  <Button type="button" onClick={saveApple} disabled={isSavingApple}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    <Label>Private key</Label>
                    <Textarea
                      value={applePrivateKey}
                      onChange={(e) => setApplePrivateKey(e.target.value)}
                      placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
                      className="min-h-[140px]"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="secondary" onClick={saveAppleSecret} disabled={isSavingAppleSecret}>
                      <Save className="h-4 w-4 mr-2" />
                      Save key
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}
